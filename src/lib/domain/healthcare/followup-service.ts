import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyContextForActor } from "@/lib/authorization/company-context";
import { AuthorizationError } from "@/lib/authorization/errors";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { assertSameCompanyMedicalCase, assertSameCompanyProcedure, assertSameCompanyMedicalFollowUp } from "@/lib/domain/scope-guards";
import { assertHealthcareModuleEnabled } from "@/lib/domain/healthcare/module-service";
import { createWorkItem } from "@/lib/domain/work-service";
import type { MedicalFollowUpStatus, Prisma, WorkItem } from "@/generated/prisma";

// Domain service — MedicalFollowUp (Phần 7, ADR-045).
//
// MedicalFollowUp ghi nhận Ý NGHĨA LÂM SÀNG của một lần theo dõi, KHÔNG phải
// một task. Việc cần người làm là `WorkItem` của Work Core (Phần 4) — liên kết
// qua `workItemId`. Vì vậy file này KHÔNG có bất kỳ trường/logic assignment
// hay due kiểu task nào (bất biến #42/#104): giao cho ai, hạn chót, nhắc việc
// đều nằm trên WorkItem. Legacy từng đẻ ra `FollowUp` song song với
// `Appointment` chỉ vì `Appointment` bị khoá 1-1 với case — ở target
// MedicalCase 1-N Appointment nên không cần engine việc thứ hai.
//
// Ranh giới quan trọng (bất biến #93/#104): hoàn tất WorkItem KHÔNG BAO GIỜ
// tự sinh kết luận lâm sàng. `recordFollowUpOutcome` là thao tác RIÊNG, do
// clinician thực hiện tường minh, và là đường DUY NHẤT đặt status = DONE.
//
// Mốc follow-up (Day 1/3/7/Month 1...) KHÔNG hard-code ở đây (bất biến #45) —
// `scheduledFor` do caller truyền vào từ cấu hình theo procedure.

/** Trạng thái đặt được qua đường "cập nhật trạng thái" thường.
 *  DONE cố tình KHÔNG nằm trong danh sách này — xem `recordFollowUpOutcome`. */
const MANUAL_STATUSES = ["PLANNED", "DUE", "MISSED", "CANCELLED"] as const;

/** Trạng thái kết thúc hợp lệ khi đóng một lịch theo dõi. */
const CLOSING_STATUSES = ["DONE", "MISSED", "CANCELLED"] as const;

/**
 * Guard company-scope cho WorkItem. `scope-guards.ts` chưa có guard cho
 * WorkItem và file đó không thuộc phạm vi thay đổi của service này, nên kiểm
 * tra tại chỗ — vẫn đúng ADR-038: companyId đọc THẲNG từ chính entity, không
 * suy qua customerId -> Customer.companyId.
 */
async function assertSameCompanyWorkItem(companyId: string, workItemId: string): Promise<WorkItem> {
  const item = await db.workItem.findUnique({ where: { id: workItemId } });
  if (!item || item.companyId !== companyId) {
    throw new AuthorizationError("Công việc không hợp lệ trong công ty này.");
  }
  return item;
}

/** Hình dạng trả về cho Server Action: plain field, không phải object Prisma
 *  thô — service không đẩy entity nguyên khối (kèm quan hệ/Decimal tương lai)
 *  ra ngoài tầng domain. */
export type MedicalFollowUpView = {
  id: string;
  companyId: string;
  medicalCaseId: string;
  procedureId: string | null;
  workItemId: string | null;
  scheduledFor: Date;
  status: MedicalFollowUpStatus;
  clinicalOutcome: string | null;
  closedAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
};

type MedicalFollowUpRow = {
  id: string;
  companyId: string;
  medicalCaseId: string;
  procedureId: string | null;
  workItemId: string | null;
  scheduledFor: Date;
  status: MedicalFollowUpStatus;
  clinicalOutcome: string | null;
  closedAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
};

function toView(row: MedicalFollowUpRow): MedicalFollowUpView {
  return {
    id: row.id,
    companyId: row.companyId,
    medicalCaseId: row.medicalCaseId,
    procedureId: row.procedureId,
    workItemId: row.workItemId,
    scheduledFor: row.scheduledFor,
    status: row.status,
    clinicalOutcome: row.clinicalOutcome,
    closedAt: row.closedAt,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  };
}

/** Cột select dùng chung — khoá luôn tập field được phép rời khỏi service. */
const FOLLOW_UP_SELECT = {
  id: true,
  companyId: true,
  medicalCaseId: true,
  procedureId: true,
  workItemId: true,
  scheduledFor: true,
  status: true,
  clinicalOutcome: true,
  closedAt: true,
  createdByUserId: true,
  createdAt: true,
} as const;

// ===== Tạo lịch theo dõi =====

const createMedicalFollowUpSchema = z.object({
  companyId: z.string().min(1),
  medicalCaseId: z.string().min(1),
  procedureId: z.string().min(1).optional(),
  // Mốc theo dõi do caller quyết định (đọc từ cấu hình theo procedure) —
  // bất biến #45 cấm hard-code Day 1/3/7 trong code sản phẩm.
  scheduledFor: z.coerce.date(),
  /** Liên kết tới một WorkItem CÓ SẴN của Work Core. */
  workItemId: z.string().min(1).optional(),
  /** Nhờ service tạo luôn WorkItem cho lần theo dõi này. Đây là đường duy
   *  nhất sinh việc — gọi `createWorkItem` của Phần 4, không có engine thứ hai. */
  workItem: z
    .object({
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().max(4000).optional(),
      priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
      assigneeUserId: z.string().min(1).optional(),
      /** Hạn việc nằm trên WorkItem, KHÔNG nằm trên MedicalFollowUp (#42).
       *  Mặc định bằng mốc lâm sàng để hai bên không lệch nhau vô cớ. */
      dueAt: z.coerce.date().optional(),
    })
    .optional(),
});

export async function createMedicalFollowUp(actorId: string, input: z.input<typeof createMedicalFollowUpSchema>) {
  const parsed = createMedicalFollowUpSchema.parse(input);
  const { actor, company, permissions } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.followup.manage",
  );
  await assertHealthcareModuleEnabled(company.id);

  if (parsed.workItemId && parsed.workItem) {
    throw new Error("Chỉ chọn một trong hai: liên kết công việc có sẵn hoặc tạo công việc mới.");
  }

  const medicalCase = await assertSameCompanyMedicalCase(company.id, parsed.medicalCaseId);
  // Hồ sơ đã đóng/huỷ thì không mở thêm mốc theo dõi mới — muốn theo dõi tiếp
  // phải mở lại hồ sơ, để trạng thái hồ sơ vẫn nói đúng sự thật lâm sàng.
  if (medicalCase.status === "CLOSED" || medicalCase.status === "CANCELLED") {
    throw new Error("Hồ sơ bệnh án đã đóng hoặc đã huỷ — không thể tạo lịch theo dõi mới.");
  }

  if (parsed.procedureId) {
    const procedure = await assertSameCompanyProcedure(company.id, parsed.procedureId);
    // Cùng Company vẫn chưa đủ: thủ thuật phải thuộc ĐÚNG hồ sơ này, nếu không
    // lần theo dõi sẽ treo vào một ca điều trị khác của cùng phòng khám.
    if (procedure.medicalCaseId !== parsed.medicalCaseId) {
      throw new Error("Thủ thuật không thuộc hồ sơ bệnh án này.");
    }
  }

  if (parsed.workItemId) await assertSameCompanyWorkItem(company.id, parsed.workItemId);

  // Kiểm quyền tạo việc TRƯỚC khi ghi follow-up: `createWorkItem` tự kiểm
  // "work.create" trong transaction riêng của nó, nếu để nó ném lỗi sau khi
  // follow-up đã commit thì người dùng nhận lỗi mà dữ liệu lại đã đổi một nửa.
  if (parsed.workItem && !permissions.has("work.create")) {
    throw new AuthorizationError("Bạn không có quyền tạo công việc cho lần theo dõi này.");
  }

  const created = await db.$transaction(async (tx) => {
    const followUp = await tx.medicalFollowUp.create({
      data: {
        companyId: company.id,
        medicalCaseId: parsed.medicalCaseId,
        procedureId: parsed.procedureId,
        workItemId: parsed.workItemId,
        scheduledFor: parsed.scheduledFor,
        createdByUserId: actor.id,
      },
      select: { id: true },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.MEDICAL_FOLLOWUP_CREATED,
      targetType: "MedicalFollowUp",
      targetId: followUp.id,
      companyId: company.id,
      // Metadata chỉ mang ID + lịch — KHÔNG mang nội dung lâm sàng (bất biến #78).
      metadata: {
        medicalCaseId: parsed.medicalCaseId,
        procedureId: parsed.procedureId ?? undefined,
        workItemId: parsed.workItemId ?? undefined,
        scheduledFor: parsed.scheduledFor.toISOString(),
      },
    });
    return followUp;
  });

  let workItemId = parsed.workItemId ?? null;
  if (parsed.workItem) {
    // Tạo việc SAU khi follow-up đã tồn tại: `createWorkItem` mở transaction
    // riêng nên không lồng được vào transaction trên. Nếu bước này hỏng, cái
    // còn lại là một follow-up chưa gắn việc — trạng thái vô hại và sửa được
    // (gắn việc sau), ngược lại sẽ là một WorkItem mồ côi không ai truy ra.
    const workItem = await createWorkItem(actorId, {
      companyId: company.id,
      title: parsed.workItem.title,
      description: parsed.workItem.description,
      priority: parsed.workItem.priority ?? "NORMAL",
      assigneeUserId: parsed.workItem.assigneeUserId,
      dueAt: parsed.workItem.dueAt ?? parsed.scheduledFor,
      // Gắn khách hàng của hồ sơ để Customer detail thấy "việc đang mở"
      // (ADR-014) — vẫn là WorkItem duy nhất, không phải task lâm sàng riêng.
      customerId: medicalCase.customerId,
    });
    workItemId = workItem.id;

    await db.$transaction(async (tx) => {
      await tx.medicalFollowUp.update({
        where: { id: created.id },
        data: { workItemId: workItem.id },
      });
      await recordAudit(tx, {
        actorUserId: actor.id,
        action: AUDIT_ACTIONS.MEDICAL_FOLLOWUP_UPDATED,
        targetType: "MedicalFollowUp",
        targetId: created.id,
        companyId: company.id,
        metadata: { workItemId: workItem.id },
      });
    });
  }

  return { id: created.id, workItemId };
}

// ===== Cập nhật trạng thái (KHÔNG đụng tới kết luận lâm sàng) =====

const updateFollowUpStatusSchema = z.object({
  companyId: z.string().min(1),
  followUpId: z.string().min(1),
  // DONE cố tình vắng mặt: DONE nghĩa là "đã có kết luận lâm sàng", chỉ
  // `recordFollowUpOutcome` đặt được. Nếu cho phép ở đây thì hoàn tất WorkItem
  // (hoặc bất kỳ nút "đánh dấu xong" nào) sẽ vô tình sinh ra kết luận lâm sàng
  // rỗng — đúng thứ bất biến #93/#104 cấm.
  status: z.enum(MANUAL_STATUSES),
});

export async function updateFollowUpStatus(actorId: string, input: z.input<typeof updateFollowUpStatusSchema>) {
  const parsed = updateFollowUpStatusSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.followup.manage",
  );
  await assertHealthcareModuleEnabled(company.id);

  const existing = await assertSameCompanyMedicalFollowUp(company.id, parsed.followUpId);
  if (existing.closedAt !== null) {
    throw new Error("Lịch theo dõi đã đóng — không thể đổi trạng thái.");
  }
  // Đã có kết luận lâm sàng thì trạng thái không còn là chuyện lịch nữa: lùi
  // về PLANNED/DUE sẽ mâu thuẫn với bản ghi lâm sàng đang tồn tại.
  if (existing.clinicalOutcome !== null) {
    throw new Error("Lịch theo dõi đã có kết luận lâm sàng — không đổi trạng thái qua đường này.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.medicalFollowUp.update({
      where: { id: parsed.followUpId },
      data: { status: parsed.status },
      select: { id: true },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.MEDICAL_FOLLOWUP_UPDATED,
      targetType: "MedicalFollowUp",
      targetId: updated.id,
      companyId: company.id,
      metadata: { fromStatus: existing.status, toStatus: parsed.status },
    });
    return { id: updated.id };
  });
}

// ===== Ghi kết luận lâm sàng — thao tác RIÊNG của clinician =====

const recordFollowUpOutcomeSchema = z.object({
  companyId: z.string().min(1),
  followUpId: z.string().min(1),
  clinicalOutcome: z.string().trim().min(1).max(4000),
});

/**
 * Bất biến #93/#104: đây là đường DUY NHẤT tạo ra kết luận lâm sàng cho một
 * lần theo dõi, và nó luôn do một actor có quyền lâm sàng gọi tường minh.
 * Không có hook nào từ WorkItem gọi vào đây — hoàn tất việc chỉ đóng việc.
 */
export async function recordFollowUpOutcome(actorId: string, input: z.input<typeof recordFollowUpOutcomeSchema>) {
  const parsed = recordFollowUpOutcomeSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.followup.manage",
  );
  await assertHealthcareModuleEnabled(company.id);

  const existing = await assertSameCompanyMedicalFollowUp(company.id, parsed.followUpId);
  if (existing.closedAt !== null) {
    throw new Error("Lịch theo dõi đã đóng — không thể ghi kết luận mới.");
  }
  if (existing.status === "CANCELLED") {
    throw new Error("Lịch theo dõi đã huỷ — không thể ghi kết luận lâm sàng.");
  }
  // Bản ghi lâm sàng đã ghi thì không ghi đè (cùng tinh thần "không overwrite
  // clinical record" của Consultation): sửa nội dung y khoa phải là một hành
  // động có lý do và dấu vết riêng, không phải một lần update lặng lẽ.
  if (existing.clinicalOutcome !== null) {
    throw new Error("Lần theo dõi này đã có kết luận lâm sàng — không thể ghi đè.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.medicalFollowUp.update({
      where: { id: parsed.followUpId },
      data: { status: "DONE", clinicalOutcome: parsed.clinicalOutcome },
      select: { id: true },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.MEDICAL_FOLLOWUP_UPDATED,
      targetType: "MedicalFollowUp",
      targetId: updated.id,
      companyId: company.id,
      // Chỉ ghi ĐỘ DÀI, không ghi nội dung: audit/log không được chứa nội dung
      // y khoa (bất biến #78) — cần nội dung thì đọc chính bản ghi, có kiểm quyền.
      metadata: { outcomeRecorded: true, outcomeLength: parsed.clinicalOutcome.length },
    });
    return { id: updated.id };
  });
}

// ===== Đóng lịch theo dõi =====

const closeMedicalFollowUpSchema = z.object({
  companyId: z.string().min(1),
  followUpId: z.string().min(1),
  finalStatus: z.enum(CLOSING_STATUSES),
});

export async function closeMedicalFollowUp(actorId: string, input: z.input<typeof closeMedicalFollowUpSchema>) {
  const parsed = closeMedicalFollowUpSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.followup.manage",
  );
  await assertHealthcareModuleEnabled(company.id);

  const existing = await assertSameCompanyMedicalFollowUp(company.id, parsed.followUpId);
  if (existing.closedAt !== null) {
    throw new Error("Lịch theo dõi này đã được đóng trước đó.");
  }
  // Đóng với kết quả DONE mà chưa có kết luận lâm sàng = đúng cái bẫy bất biến
  // #93 nói tới: một thao tác "hoàn tất" biến thành kết luận y khoa ngầm.
  // Bắt buộc clinician gọi recordFollowUpOutcome trước.
  if (parsed.finalStatus === "DONE" && existing.clinicalOutcome === null) {
    throw new Error("Chưa có kết luận lâm sàng cho lần theo dõi này — hãy ghi kết luận trước khi đóng.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.medicalFollowUp.update({
      where: { id: parsed.followUpId },
      data: { status: parsed.finalStatus, closedAt: new Date() },
      select: { id: true },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.MEDICAL_FOLLOWUP_CLOSED,
      targetType: "MedicalFollowUp",
      targetId: updated.id,
      companyId: company.id,
      metadata: { finalStatus: parsed.finalStatus, hadOutcome: existing.clinicalOutcome !== null },
    });
    return { id: updated.id };
  });
}

// ===== Đọc =====

const getFollowUpListSchema = z.object({
  companyId: z.string().min(1),
  medicalCaseId: z.string().min(1).optional(),
  procedureId: z.string().min(1).optional(),
  status: z.array(z.enum(["PLANNED", "DUE", "DONE", "MISSED", "CANCELLED"])).nonempty().optional(),
  /** Mặc định ẩn lịch đã đóng để danh sách phản ánh việc còn sống. */
  includeClosed: z.boolean().default(false),
  limit: z.number().int().positive().max(200).default(100),
});

export async function getFollowUpList(
  actorId: string,
  input: z.input<typeof getFollowUpListSchema>,
): Promise<MedicalFollowUpView[]> {
  const parsed = getFollowUpListSchema.parse(input);
  const { company } = await requireCompanyContextForActor(actorId, parsed.companyId, "healthcare.followup.view");
  await assertHealthcareModuleEnabled(company.id);

  // companyId lọc THẲNG trên MedicalFollowUp (ADR-038) — không join ngược qua
  // Customer để suy Company, vì đó là đường rò rỉ cross-company kinh điển.
  const where: Prisma.MedicalFollowUpWhereInput = {
    companyId: company.id,
    medicalCaseId: parsed.medicalCaseId,
    procedureId: parsed.procedureId,
    status: parsed.status ? { in: parsed.status } : undefined,
    closedAt: parsed.includeClosed ? undefined : null,
  };

  const rows = await db.medicalFollowUp.findMany({
    where,
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
    take: parsed.limit,
    select: FOLLOW_UP_SELECT,
  });
  return rows.map(toView);
}

const getDueFollowUpsForTodaySchema = z.object({
  companyId: z.string().min(1),
  /** Mốc "hôm nay" tường minh cho test/caller; mặc định thời điểm hiện tại. */
  asOf: z.coerce.date().default(() => new Date()),
  limit: z.number().int().positive().max(200).default(100),
});

/**
 * Danh sách theo dõi ĐẾN HẠN tính đến hết hôm nay (gồm cả các mốc quá hạn
 * chưa xử lý). Chỉ ĐỌC — không tự chuyển PLANNED sang DUE: một đường đọc mà
 * ghi ngầm trạng thái sẽ khiến audit trail nói dối về ai đã đổi trạng thái.
 */
export async function getDueFollowUpsForToday(
  actorId: string,
  input: z.input<typeof getDueFollowUpsForTodaySchema>,
): Promise<MedicalFollowUpView[]> {
  const parsed = getDueFollowUpsForTodaySchema.parse(input);
  const { company } = await requireCompanyContextForActor(actorId, parsed.companyId, "healthcare.followup.view");
  await assertHealthcareModuleEnabled(company.id);

  // Cắt ngày bằng getUTC*/Date.UTC, KHÔNG dùng giờ địa phương của máy chạy:
  // bài học Phần 6 (PayrollProfile.effectiveFrom) — `scheduledFor` được coerce
  // từ chuỗi date-only ("2026-10-01") nên luôn là UTC midnight; truncate theo
  // giờ địa phương trên máy lệch UTC làm lịch của đúng hôm nay bị đẩy sang
  // ngày khác, sai đúng 1 đơn vị ngày.
  const endOfTodayUtc = new Date(
    Date.UTC(parsed.asOf.getUTCFullYear(), parsed.asOf.getUTCMonth(), parsed.asOf.getUTCDate(), 23, 59, 59, 999),
  );

  const rows = await db.medicalFollowUp.findMany({
    where: {
      companyId: company.id,
      status: { in: ["PLANNED", "DUE"] },
      closedAt: null,
      scheduledFor: { lte: endOfTodayUtc },
    },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
    take: parsed.limit,
    select: FOLLOW_UP_SELECT,
  });
  return rows.map(toView);
}
