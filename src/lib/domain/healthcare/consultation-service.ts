import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyContextForActor } from "@/lib/authorization/company-context";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { assertSameCompanyMedicalCase, assertSameCompanyConsultation } from "@/lib/domain/scope-guards";
import { assertHealthcareModuleEnabled } from "@/lib/domain/healthcare/module-service";

// Domain service — ClinicalConsultation + Addendum + ScreeningItem (Phần 7).
//
// ADR-039 là trung tâm của file này: sau khi FINAL thì bản ghi BẤT BIẾN.
// Không có đường nào sửa nội dung gốc — thay đổi duy nhất được phép là tạo
// addendum trỏ về bản gốc. Legacy không có tính toàn vẹn tác giả:
// `ho-so/actions.ts:178-189` dùng chung một object `data` cho cả create lẫn
// update nên `createdById` bị ghi đè mỗi lần sửa.

const createConsultationSchema = z.object({
  companyId: z.string().min(1),
  medicalCaseId: z.string().min(1),
  subjective: z.string().trim().max(5000).optional(),
  objective: z.string().trim().max(5000).optional(),
  assessment: z.string().trim().max(5000).optional(),
  plan: z.string().trim().max(5000).optional(),
});

export async function createConsultation(actorId: string, input: z.input<typeof createConsultationSchema>) {
  const parsed = createConsultationSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.consultation.create",
  );
  await assertHealthcareModuleEnabled(company.id);
  const medicalCase = await assertSameCompanyMedicalCase(company.id, parsed.medicalCaseId);

  if (medicalCase.status === "CLOSED" || medicalCase.status === "CANCELLED") {
    throw new Error("Hồ sơ đã kết thúc — không tạo phiếu khám mới được.");
  }

  return db.$transaction(async (tx) => {
    const record = await tx.clinicalConsultation.create({
      data: {
        companyId: company.id,
        medicalCaseId: medicalCase.id,
        // Tác giả = người tạo, và KHÔNG BAO GIỜ bị ghi đè ở update (khác legacy).
        clinicianUserId: actor.id,
        status: "DRAFT",
        subjective: parsed.subjective,
        objective: parsed.objective,
        assessment: parsed.assessment,
        plan: parsed.plan,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.CONSULTATION_CREATED,
      targetType: "ClinicalConsultation",
      targetId: record.id,
      companyId: company.id,
      metadata: { medicalCaseId: medicalCase.id },
    });
    return { id: record.id };
  });
}

const updateDraftSchema = z.object({
  companyId: z.string().min(1),
  consultationId: z.string().min(1),
  subjective: z.string().trim().max(5000).optional(),
  objective: z.string().trim().max(5000).optional(),
  assessment: z.string().trim().max(5000).optional(),
  plan: z.string().trim().max(5000).optional(),
});

/**
 * CHỈ sửa được khi còn DRAFT (bất biến #22/#89/#125/#167).
 * Autosave của UI gọi đúng hàm này — nên không có code path nào để autosave
 * đẩy bản ghi sang FINAL (bất biến #109).
 */
export async function updateDraftConsultation(actorId: string, input: z.input<typeof updateDraftSchema>) {
  const parsed = updateDraftSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.consultation.create",
  );
  await assertHealthcareModuleEnabled(company.id);
  const existing = await assertSameCompanyConsultation(company.id, parsed.consultationId);

  if (existing.status === "FINAL") {
    throw new Error(
      "Phiếu khám đã chốt — không sửa được nội dung gốc. Dùng chức năng bổ sung (addendum).",
    );
  }

  return db.$transaction(async (tx) => {
    const record = await tx.clinicalConsultation.update({
      where: { id: existing.id },
      data: {
        subjective: parsed.subjective,
        objective: parsed.objective,
        assessment: parsed.assessment,
        plan: parsed.plan,
        // clinicianUserId CỐ Ý không nằm ở đây: tác giả bản ghi không đổi khi
        // người khác sửa nháp. Ai sửa được truy ra từ AuditEvent.
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.CONSULTATION_UPDATED,
      targetType: "ClinicalConsultation",
      targetId: record.id,
      companyId: company.id,
    });
    return { id: record.id };
  });
}

const finalizeSchema = z.object({
  companyId: z.string().min(1),
  consultationId: z.string().min(1),
});

/** Bất biến #166: không finalize được hai lần trên cùng một bản ghi. */
export async function finalizeConsultation(actorId: string, input: z.input<typeof finalizeSchema>) {
  const parsed = finalizeSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.consultation.finalize",
  );
  await assertHealthcareModuleEnabled(company.id);
  const existing = await assertSameCompanyConsultation(company.id, parsed.consultationId);

  return db.$transaction(async (tx) => {
    // Khoá + đọc lại TRONG transaction: hai lần bấm "Chốt" đồng thời đều đọc
    // status DRAFT ở ngoài rồi cùng ghi. Cùng lớp lỗi với 4 P0 của Phần 6.
    await tx.$queryRaw`SELECT id FROM "ClinicalConsultation" WHERE id = ${existing.id} FOR UPDATE`;
    const fresh = await tx.clinicalConsultation.findUniqueOrThrow({ where: { id: existing.id } });
    if (fresh.status === "FINAL") {
      throw new Error("Phiếu khám này đã được chốt trước đó.");
    }

    const record = await tx.clinicalConsultation.update({
      where: { id: fresh.id },
      data: { status: "FINAL", finalizedAt: new Date(), finalizedByUserId: actor.id },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.CONSULTATION_FINALIZED,
      targetType: "ClinicalConsultation",
      targetId: record.id,
      companyId: company.id,
    });
    return { id: record.id };
  });
}

const addendumSchema = z.object({
  companyId: z.string().min(1),
  consultationId: z.string().min(1),
  content: z.string().trim().min(1).max(5000),
  reason: z.string().trim().min(1).max(2000),
});

/**
 * Đường sửa DUY NHẤT sau khi chốt (ADR-039). Tạo bản ghi MỚI trỏ về bản gốc;
 * bản gốc giữ nguyên vĩnh viễn, không có field nào của nó bị đụng tới.
 */
export async function addConsultationAddendum(actorId: string, input: z.input<typeof addendumSchema>) {
  const parsed = addendumSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.consultation.create",
  );
  await assertHealthcareModuleEnabled(company.id);
  const existing = await assertSameCompanyConsultation(company.id, parsed.consultationId);

  if (existing.status !== "FINAL") {
    throw new Error("Chỉ bổ sung được cho phiếu khám đã chốt. Phiếu còn nháp thì sửa trực tiếp.");
  }

  return db.$transaction(async (tx) => {
    const record = await tx.clinicalConsultationAddendum.create({
      data: {
        companyId: company.id,
        consultationId: existing.id,
        authorUserId: actor.id,
        content: parsed.content,
        reason: parsed.reason,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.CONSULTATION_ADDENDUM_ADDED,
      targetType: "ClinicalConsultationAddendum",
      targetId: record.id,
      companyId: company.id,
      metadata: { consultationId: existing.id, reason: parsed.reason },
    });
    return { id: record.id };
  });
}

const screeningSchema = z.object({
  companyId: z.string().min(1),
  consultationId: z.string().min(1),
  itemKey: z.string().trim().min(1).max(100),
  question: z.string().trim().min(1).max(500),
  // ADR-048 — null nghĩa là CHƯA GHI NHẬN, KHÁC HẲN "ghi nhận là không".
  // Truyền null một cách tường minh để xoá kết quả đã ghi (vd ghi nhầm).
  answer: z.enum(["YES", "NO"]).nullable(),
  note: z.string().trim().max(2000).optional(),
});

/**
 * ADR-048 / bất biến #111/#148 — ba trạng thái phải phân biệt được:
 *   answer === null  -> chưa ghi nhận  (recordedAt cũng null)
 *   answer === "NO"  -> ĐÃ hỏi, bệnh nhân trả lời không
 *   answer === "YES" -> đã hỏi, có
 * TUYỆT ĐỐI không quy null thành "NO". Legacy nhét screening vào cột Json
 * không schema và hiện chứa ít nhất 2 thế hệ dữ liệu khác nhau.
 */
export async function recordScreeningItem(actorId: string, input: z.input<typeof screeningSchema>) {
  const parsed = screeningSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.consultation.create",
  );
  await assertHealthcareModuleEnabled(company.id);
  const consultation = await assertSameCompanyConsultation(company.id, parsed.consultationId);

  if (consultation.status === "FINAL") {
    throw new Error("Phiếu khám đã chốt — không sửa sàng lọc được. Dùng chức năng bổ sung.");
  }

  return db.$transaction(async (tx) => {
    const record = await tx.clinicalScreeningItem.upsert({
      where: { consultationId_itemKey: { consultationId: consultation.id, itemKey: parsed.itemKey } },
      create: {
        companyId: company.id,
        consultationId: consultation.id,
        itemKey: parsed.itemKey,
        question: parsed.question,
        answer: parsed.answer,
        note: parsed.note,
        // recordedAt chỉ có giá trị khi thực sự đã ghi nhận câu trả lời.
        recordedAt: parsed.answer === null ? null : new Date(),
      },
      update: {
        question: parsed.question,
        answer: parsed.answer,
        note: parsed.note,
        recordedAt: parsed.answer === null ? null : new Date(),
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.SCREENING_RECORDED,
      targetType: "ClinicalScreeningItem",
      targetId: record.id,
      companyId: company.id,
      metadata: { itemKey: parsed.itemKey, answer: parsed.answer },
    });
    return { id: record.id };
  });
}

/**
 * Số mục sàng lọc CHƯA ghi nhận trên phiếu khám mới nhất của một ca — dùng
 * làm input cho `evaluateProcedureReadiness`. Không tự quyết định gì, chỉ đếm.
 */
export async function countUnrecordedRequiredScreening(companyId: string, medicalCaseId: string): Promise<number> {
  const latest = await db.clinicalConsultation.findFirst({
    where: { companyId, medicalCaseId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!latest) return 0;
  return db.clinicalScreeningItem.count({
    where: { companyId, consultationId: latest.id, answer: null },
  });
}

// ===== Read =====

export async function getConsultationList(actorId: string, companyId: string, medicalCaseId: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "healthcare.consultation.view");
  await assertHealthcareModuleEnabled(company.id);
  await assertSameCompanyMedicalCase(company.id, medicalCaseId);

  return db.clinicalConsultation.findMany({
    where: { companyId: company.id, medicalCaseId },
    include: { clinician: { omit: { passwordHash: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getConsultationDetail(actorId: string, companyId: string, consultationId: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "healthcare.consultation.view");
  await assertHealthcareModuleEnabled(company.id);
  await assertSameCompanyConsultation(company.id, consultationId);

  return db.clinicalConsultation.findUnique({
    where: { id: consultationId },
    include: {
      clinician: { omit: { passwordHash: true } },
      finalizedBy: { omit: { passwordHash: true } },
      addenda: {
        include: { author: { omit: { passwordHash: true } } },
        orderBy: { createdAt: "asc" },
      },
      screeningItems: { orderBy: { itemKey: "asc" } },
    },
  });
}
