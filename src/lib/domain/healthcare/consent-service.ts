import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyContextForActor } from "@/lib/authorization/company-context";
import { AuthorizationError } from "@/lib/authorization/errors";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import {
  assertSameCompanyConsentTemplate,
  assertSameCompanyConsentRecord,
  assertSameCompanyMedicalCase,
  assertSameCompanyCustomer,
} from "@/lib/domain/scope-guards";
import { assertHealthcareModuleEnabled } from "@/lib/domain/healthcare/module-service";
import type { ConsentStatus, ConsentType } from "@/generated/prisma";

/**
 * Domain service — Consent (ConsentTemplate + ConsentRecord). Master Prompt
 * Phần 7, ADR-042.
 *
 * Hai cột trụ của file này, đều là bài học khảo cổ từ legacy:
 *
 * 1. SNAPSHOT (bất biến #30/#90/#156/#176) — ConsentRecord giữ bản sao
 *    title/body/version TẠI THỜI ĐIỂM TẠO. Sau đó template đổi bao nhiêu lần
 *    cũng không chạm được vào phiếu đã tạo, nên bản in luôn khớp đúng thứ
 *    khách đã đọc và ký. Vì vậy không hàm nào ở đây đọc lại
 *    `consentTemplate.title/body` để hiển thị — quan hệ FK giữ lại chỉ để
 *    truy nguyên nguồn gốc, KHÔNG phải để render.
 *
 * 2. REVOKE, KHÔNG XOÁ (bất biến #91) — legacy chỉ có `deleteConsent`, tức
 *    khách rút lại đồng ý thì mất sạch bằng chứng đã từng đồng ý. Đây là
 *    khoảng trống nghiệp vụ thật đã phát hiện khi khảo cổ, nên service này
 *    KHÔNG export bất kỳ hàm xoá nào — thu hồi là đổi trạng thái + reason +
 *    audit.
 *
 * Mọi hàm public đi qua HAI cổng độc lập: permission (`healthcare.*`) và
 * module gate (`assertHealthcareModuleEnabled`) — bất biến #59/#87: có quyền
 * mà Company chưa bật phân hệ Y tế thì vẫn phải bị từ chối.
 */

// ===== Kiểu trả ra ngoài =====
// Server Action gọi service này, nên không trả thẳng object Prisma ra biên —
// chỉ plain field. (ConsentTemplate/ConsentRecord hiện không có cột Decimal,
// nhưng giữ đúng khuôn để sau này thêm cột cũng không rò Decimal ra client.)

export type ConsentTemplateView = {
  id: string;
  code: string;
  title: string;
  body: string;
  version: number;
  consentType: ConsentType;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: Date;
};

export type ConsentRecordView = {
  id: string;
  medicalCaseId: string;
  consentTemplateId: string | null;
  consentType: ConsentType;
  /** Trạng thái ĐÃ LƯU trong DB. */
  status: ConsentStatus;
  /** Trạng thái SAU KHI tính hạn — xem `deriveEffectiveStatus`. */
  effectiveStatus: ConsentStatus;
  titleSnapshot: string;
  bodySnapshot: string;
  templateVersion: number | null;
  signedAt: Date | null;
  signedByCustomerId: string | null;
  signerName: string | null;
  signerRelationship: string | null;
  revokedAt: Date | null;
  revokedByUserId: string | null;
  revokeReason: string | null;
  expiresAt: Date | null;
  createdAt: Date;
};

/**
 * Hết hạn được TÍNH lúc đọc, không có job nền nào đi ghi `status = EXPIRED`.
 * Lý do: một cron chạy trễ/chết sẽ khiến phiếu hết hạn vẫn mang trạng thái
 * SIGNED trong DB — đúng loại sai lệch nguy hiểm nhất ở đây (readiness của
 * thủ thuật đọc trạng thái này). Tính tại chỗ thì không có cửa sổ sai.
 * Cột `status` trong DB vẫn giữ nguyên giá trị lịch sử (SIGNED), phần dẫn
 * xuất nằm ở `effectiveStatus`.
 */
function deriveEffectiveStatus(
  record: { status: ConsentStatus; expiresAt: Date | null },
  now: Date,
): ConsentStatus {
  if (record.status === "SIGNED" && record.expiresAt !== null && record.expiresAt <= now) {
    return "EXPIRED";
  }
  return record.status;
}

function toConsentRecordView(
  record: {
    id: string;
    medicalCaseId: string;
    consentTemplateId: string | null;
    consentType: ConsentType;
    status: ConsentStatus;
    titleSnapshot: string;
    bodySnapshot: string;
    templateVersion: number | null;
    signedAt: Date | null;
    signedByCustomerId: string | null;
    signerName: string | null;
    signerRelationship: string | null;
    revokedAt: Date | null;
    revokedByUserId: string | null;
    revokeReason: string | null;
    expiresAt: Date | null;
    createdAt: Date;
  },
  now: Date,
): ConsentRecordView {
  return {
    id: record.id,
    medicalCaseId: record.medicalCaseId,
    consentTemplateId: record.consentTemplateId,
    consentType: record.consentType,
    status: record.status,
    effectiveStatus: deriveEffectiveStatus(record, now),
    titleSnapshot: record.titleSnapshot,
    bodySnapshot: record.bodySnapshot,
    templateVersion: record.templateVersion,
    signedAt: record.signedAt,
    signedByCustomerId: record.signedByCustomerId,
    signerName: record.signerName,
    signerRelationship: record.signerRelationship,
    revokedAt: record.revokedAt,
    revokedByUserId: record.revokedByUserId,
    revokeReason: record.revokeReason,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
  };
}

const consentTypeSchema = z.enum(["PROCEDURE", "ANESTHESIA", "PHOTO_USAGE", "DATA_PROCESSING", "OTHER"]);

// ===== ConsentTemplate =====

const createConsentTemplateSchema = z.object({
  companyId: z.string().min(1),
  code: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(50000),
  consentType: consentTypeSchema.optional(),
});

/**
 * Tạo mẫu phiếu đồng ý. Cũng chính là đường DUY NHẤT để "sửa nội dung mẫu":
 * truyền lại `code` đã có → sinh bản ghi MỚI với `version + 1`, bản cũ giữ
 * nguyên từng chữ (bất biến #176 — mẫu đã dùng là immutable; ADR-042).
 * Không có hàm updateConsentTemplate và sẽ không bao giờ có: sửa tại chỗ sẽ
 * làm bản in của phiếu đã ký lệch khỏi nội dung khách từng đọc.
 *
 * `version` do SERVER tính, không nhận từ client — client tự chọn version sẽ
 * phá khả năng truy nguyên "phiên bản nào đã được ký" (bất biến #170).
 */
export async function createConsentTemplate(
  actorId: string,
  input: z.input<typeof createConsentTemplateSchema>,
): Promise<{ id: string; version: number }> {
  const parsed = createConsentTemplateSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.template.manage",
  );
  await assertHealthcareModuleEnabled(company.id);

  try {
    return await db.$transaction(async (tx) => {
      const latest = await tx.consentTemplate.findFirst({
        where: { companyId: company.id, code: parsed.code },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const nextVersion = (latest?.version ?? 0) + 1;

      // Chỉ để ĐÚNG MỘT version ACTIVE cho mỗi code: bản cũ chuyển ARCHIVED
      // để danh sách chọn mẫu không hiện 5 phiên bản gần giống nhau (chọn
      // nhầm bản cũ là lỗi thật, không phải phiền toái UI). Đổi `status`
      // KHÔNG vi phạm tính bất biến của mẫu — title/body/version của bản cũ
      // không bị chạm, và phiếu đã tạo vốn đọc từ snapshot của chính nó.
      await tx.consentTemplate.updateMany({
        where: { companyId: company.id, code: parsed.code, status: "ACTIVE" },
        data: { status: "ARCHIVED" },
      });

      const template = await tx.consentTemplate.create({
        data: {
          companyId: company.id,
          code: parsed.code,
          title: parsed.title,
          body: parsed.body,
          version: nextVersion,
          consentType: (parsed.consentType ?? "PROCEDURE") as ConsentType,
          createdByUserId: actor.id,
        },
      });
      await recordAudit(tx, {
        actorUserId: actor.id,
        action: AUDIT_ACTIONS.CONSENT_TEMPLATE_CREATED,
        targetType: "ConsentTemplate",
        targetId: template.id,
        companyId: company.id,
        // Không ghi `body` vào audit metadata — audit log là nơi đọc rộng
        // hơn hồ sơ bệnh án, không nhân bản nội dung y tế vào đó.
        metadata: { code: template.code, version: template.version, consentType: template.consentType },
      });
      return { id: template.id, version: template.version };
    });
  } catch (err) {
    // @@unique([companyId, code, version]) chặn hai lần tạo song song cùng
    // tính ra một `nextVersion` dưới READ COMMITTED — DB là nơi phân xử,
    // không tự chế lock cho một thao tác hiếm như soạn mẫu.
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      throw new Error("Vừa có người tạo phiên bản mới cho mẫu này. Tải lại và thử lại.");
    }
    throw err;
  }
}

const archiveConsentTemplateSchema = z.object({
  companyId: z.string().min(1),
  consentTemplateId: z.string().min(1),
});

/**
 * Ngưng dùng một mẫu. Là ARCHIVE, không phải xoá — phiếu đã tạo vẫn trỏ về
 * đây để truy nguyên nguồn gốc (bất biến #170).
 */
export async function archiveConsentTemplate(
  actorId: string,
  input: z.input<typeof archiveConsentTemplateSchema>,
): Promise<{ id: string }> {
  const parsed = archiveConsentTemplateSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.template.manage",
  );
  await assertHealthcareModuleEnabled(company.id);
  const template = await assertSameCompanyConsentTemplate(company.id, parsed.consentTemplateId);

  if (template.status === "ARCHIVED") {
    throw new Error("Mẫu phiếu đồng ý này đã được lưu trữ trước đó.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.consentTemplate.update({
      where: { id: template.id },
      data: { status: "ARCHIVED" },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.CONSENT_TEMPLATE_ARCHIVED,
      targetType: "ConsentTemplate",
      targetId: updated.id,
      companyId: company.id,
      metadata: { code: updated.code, version: updated.version },
    });
    return { id: updated.id };
  });
}

/**
 * Danh sách mẫu. Gate bằng `healthcare.consent.view` chứ KHÔNG phải
 * `healthcare.template.manage`: bác sĩ cần chọn mẫu để lập phiếu nhưng theo
 * preset chỉ ADMIN mới có quyền quản trị mẫu — gate bằng template.manage sẽ
 * khoá luôn luồng lập phiếu của chính người dùng chính.
 */
export async function getConsentTemplateList(
  actorId: string,
  companyId: string,
  options?: { includeArchived?: boolean; consentType?: ConsentType },
): Promise<ConsentTemplateView[]> {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "healthcare.consent.view");
  await assertHealthcareModuleEnabled(company.id);

  const templates = await db.consentTemplate.findMany({
    where: {
      companyId: company.id,
      ...(options?.includeArchived ? {} : { status: "ACTIVE" }),
      ...(options?.consentType ? { consentType: options.consentType } : {}),
    },
    orderBy: [{ code: "asc" }, { version: "desc" }],
  });

  return templates.map((t) => ({
    id: t.id,
    code: t.code,
    title: t.title,
    body: t.body,
    version: t.version,
    consentType: t.consentType,
    status: t.status,
    createdAt: t.createdAt,
  }));
}

// ===== ConsentRecord =====

const createConsentRecordSchema = z
  .object({
    companyId: z.string().min(1),
    medicalCaseId: z.string().min(1),
    consentTemplateId: z.string().min(1).optional(),
    consentType: consentTypeSchema.optional(),
    /** Chỉ dùng khi KHÔNG có template (nhập tay). Có template thì bị bỏ qua. */
    title: z.string().trim().min(1).max(300).optional(),
    body: z.string().trim().min(1).max(50000).optional(),
    expiresAt: z.coerce.date().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.consentTemplateId && (!value.title || !value.body)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Phải chọn mẫu phiếu, hoặc nhập đủ tiêu đề và nội dung phiếu đồng ý.",
      });
    }
  });

/**
 * Tạo phiếu đồng ý ở trạng thái DRAFT.
 *
 * SNAPSHOT ngay tại đây (không đợi lúc ký): title/body/version được sao chép
 * vào chính bản ghi, nên từ giây này trở đi mọi thay đổi template không còn
 * đường nào chạm tới phiếu (bất biến #30/#90/#156/#176). Đây cũng là lý do
 * bản ghi lưu `templateVersion` dạng số chứ không chỉ FK: FK đọc ra version
 * "mới nhất" là đúng cái sai mà ADR-042 chặn.
 *
 * Cho phép KHÔNG có template (`consentTemplateId` optional) — phòng khám
 * gặp tình huống ngoài mẫu vẫn phải lập được phiếu; khi đó `templateVersion`
 * để null (không có version để truy nguyên vì vốn không có mẫu nào).
 */
export async function createConsentRecord(
  actorId: string,
  input: z.input<typeof createConsentRecordSchema>,
): Promise<{ id: string }> {
  const parsed = createConsentRecordSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.consent.manage",
  );
  await assertHealthcareModuleEnabled(company.id);
  // companyId đọc thẳng từ MedicalCase (ADR-038) — KHÔNG suy qua
  // customerId -> Customer.companyId. Guard này cũng chính là thứ bảo đảm
  // bất biến #28: không tồn tại ConsentRecord trỏ sang Case của Company khác.
  const medicalCase = await assertSameCompanyMedicalCase(company.id, parsed.medicalCaseId);

  if (medicalCase.status === "CLOSED" || medicalCase.status === "CANCELLED") {
    throw new Error("Hồ sơ bệnh án đã đóng hoặc đã huỷ — không lập thêm phiếu đồng ý.");
  }

  let titleSnapshot = parsed.title ?? "";
  let bodySnapshot = parsed.body ?? "";
  let templateVersion: number | null = null;
  let consentType: ConsentType = (parsed.consentType ?? "PROCEDURE") as ConsentType;

  if (parsed.consentTemplateId) {
    const template = await assertSameCompanyConsentTemplate(company.id, parsed.consentTemplateId);
    if (template.status === "ARCHIVED") {
      throw new Error("Mẫu phiếu đồng ý này đã ngưng sử dụng — chọn phiên bản đang hiệu lực.");
    }
    // Snapshot: đọc một lần, chép vào bản ghi, từ đây không đọc lại template nữa.
    titleSnapshot = template.title;
    bodySnapshot = template.body;
    templateVersion = template.version;
    // consentType truyền vào chỉ dùng khi nhập tay — có mẫu thì loại phiếu
    // phải theo mẫu, tránh phiếu "gây mê" mang nội dung "xử lý dữ liệu".
    consentType = template.consentType;
  }

  return db.$transaction(async (tx) => {
    const record = await tx.consentRecord.create({
      data: {
        companyId: company.id,
        medicalCaseId: medicalCase.id,
        consentTemplateId: parsed.consentTemplateId,
        consentType,
        status: "DRAFT",
        titleSnapshot,
        bodySnapshot,
        templateVersion,
        expiresAt: parsed.expiresAt,
        createdByUserId: actor.id,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.CONSENT_CREATED,
      targetType: "ConsentRecord",
      targetId: record.id,
      companyId: company.id,
      metadata: {
        medicalCaseId: medicalCase.id,
        consentType,
        consentTemplateId: parsed.consentTemplateId ?? null,
        templateVersion,
      },
    });
    return { id: record.id };
  });
}

const signConsentSchema = z
  .object({
    companyId: z.string().min(1),
    consentRecordId: z.string().min(1),
    /** Khách tự ký — phải đúng khách của ca bệnh này. */
    signedByCustomerId: z.string().min(1).optional(),
    /** Người nhà ký thay — khi đó bắt buộc kèm quan hệ với khách. */
    signerName: z.string().trim().min(1).max(200).optional(),
    signerRelationship: z.string().trim().min(1).max(100).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.signedByCustomerId && !value.signerName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Phải ghi nhận người ký: khách hàng của ca, hoặc tên người ký thay.",
      });
    }
    // Ký thay mà không ghi quan hệ thì bản ghi mất giá trị pháp lý — chặn
    // ngay ở input thay vì để phát hiện lúc tranh chấp.
    if (!value.signedByCustomerId && value.signerName && !value.signerRelationship) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Người ký thay phải ghi rõ quan hệ với khách hàng.",
      });
    }
  });

/**
 * Ký phiếu: DRAFT -> SIGNED, một chiều và MỘT LẦN. Ký lần hai bị từ chối —
 * cho ký đè sẽ ghi lại `signedAt`/người ký của lần ký cũ, tức sửa bằng chứng
 * đã ký (bất biến #187: bản ghi lâm sàng đã chốt không sửa ngầm).
 */
export async function signConsent(
  actorId: string,
  input: z.input<typeof signConsentSchema>,
): Promise<{ id: string }> {
  const parsed = signConsentSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.consent.manage",
  );
  await assertHealthcareModuleEnabled(company.id);
  const record = await assertSameCompanyConsentRecord(company.id, parsed.consentRecordId);
  const medicalCase = await assertSameCompanyMedicalCase(company.id, record.medicalCaseId);

  if (parsed.signedByCustomerId) {
    // Hai lớp: cùng Company (chặn cross-company), VÀ đúng khách của ca này
    // (chặn thay ID khách cùng Company — ma trận ID của bất biến #86).
    await assertSameCompanyCustomer(company.id, parsed.signedByCustomerId);
    if (parsed.signedByCustomerId !== medicalCase.customerId) {
      throw new AuthorizationError("Người ký không phải khách hàng của hồ sơ bệnh án này.");
    }
  }

  const now = new Date();
  if (record.expiresAt !== null && record.expiresAt <= now) {
    throw new Error("Phiếu đồng ý này đã quá hạn hiệu lực — lập phiếu mới trước khi ký.");
  }

  return db.$transaction(async (tx) => {
    // Khoá row rồi RE-VERIFY trạng thái NGAY TRONG transaction: check DRAFT ở
    // ngoài không chặn được hai lần bấm "Ký" gần như đồng thời (2 tab / retry
    // mạng) — cả hai đọc DRAFT trước khi bên nào commit, cả hai cùng ghi
    // SIGNED, người ký cuối đè lên người ký đầu mà không để lại dấu vết.
    // Cùng khuôn với payroll-service.finalizePayrollRun.
    await tx.$queryRaw`SELECT id FROM "ConsentRecord" WHERE id = ${record.id} FOR UPDATE`;
    const locked = await tx.consentRecord.findUniqueOrThrow({ where: { id: record.id } });
    if (locked.status !== "DRAFT") {
      throw new Error("Chỉ phiếu đồng ý ở trạng thái nháp mới ký được.");
    }

    const updated = await tx.consentRecord.update({
      where: { id: locked.id },
      data: {
        status: "SIGNED",
        signedAt: now,
        signedByCustomerId: parsed.signedByCustomerId,
        signerName: parsed.signerName,
        signerRelationship: parsed.signerRelationship,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.CONSENT_SIGNED,
      targetType: "ConsentRecord",
      targetId: updated.id,
      companyId: company.id,
      metadata: {
        medicalCaseId: updated.medicalCaseId,
        consentType: updated.consentType,
        templateVersion: updated.templateVersion,
        signedByCustomerId: updated.signedByCustomerId ?? null,
        signerRelationship: updated.signerRelationship ?? null,
      },
    });
    return { id: updated.id };
  });
}

const revokeConsentSchema = z.object({
  companyId: z.string().min(1),
  consentRecordId: z.string().min(1),
  /** BẮT BUỘC (bất biến #91) — thu hồi không lý do là thu hồi không giải trình được. */
  reason: z.string().trim().min(1).max(2000),
});

/**
 * Thu hồi phiếu đồng ý. KHÔNG XOÁ bản ghi trong bất kỳ hoàn cảnh nào — đây
 * chính là khoảng trống nghiệp vụ thật của legacy (chỉ có `deleteConsent`,
 * rút đồng ý là mất luôn bằng chứng đã từng đồng ý; bất biến #91, ADR-042).
 * Bản ghi ở lại vĩnh viễn với đủ dấu vết: ai thu hồi, lúc nào, vì sao.
 *
 * Cho phép thu hồi cả từ DRAFT: vì không có đường xoá, phiếu nháp lập nhầm
 * cũng phải có lối thoát hợp lệ thay vì nằm lại danh sách như phiếu chờ ký.
 */
export async function revokeConsent(
  actorId: string,
  input: z.input<typeof revokeConsentSchema>,
): Promise<{ id: string }> {
  const parsed = revokeConsentSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.consent.manage",
  );
  await assertHealthcareModuleEnabled(company.id);
  const record = await assertSameCompanyConsentRecord(company.id, parsed.consentRecordId);

  return db.$transaction(async (tx) => {
    // Khoá + re-verify: hai lần thu hồi đồng thời sẽ ghi đè reason/người thu
    // hồi của nhau, làm hỏng đúng thứ duy nhất khiến thu hồi có giá trị.
    await tx.$queryRaw`SELECT id FROM "ConsentRecord" WHERE id = ${record.id} FOR UPDATE`;
    const locked = await tx.consentRecord.findUniqueOrThrow({ where: { id: record.id } });
    if (locked.status === "REVOKED") {
      throw new Error("Phiếu đồng ý này đã được thu hồi trước đó.");
    }
    if (locked.status === "EXPIRED") {
      throw new Error("Phiếu đồng ý này đã hết hiệu lực — không cần thu hồi.");
    }

    const updated = await tx.consentRecord.update({
      where: { id: locked.id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedByUserId: actor.id,
        revokeReason: parsed.reason,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.CONSENT_REVOKED,
      targetType: "ConsentRecord",
      targetId: updated.id,
      companyId: company.id,
      metadata: {
        medicalCaseId: updated.medicalCaseId,
        consentType: updated.consentType,
        previousStatus: locked.status,
        reason: parsed.reason,
      },
    });
    return { id: updated.id };
  });
}

// ===== Read =====

const consentRecordFilterSchema = z.object({
  medicalCaseId: z.string().min(1).optional(),
  consentType: consentTypeSchema.optional(),
  status: z.enum(["DRAFT", "SIGNED", "REVOKED", "EXPIRED"]).optional(),
});

export async function getConsentRecordList(
  actorId: string,
  companyId: string,
  filter?: z.input<typeof consentRecordFilterSchema>,
): Promise<ConsentRecordView[]> {
  const parsed = consentRecordFilterSchema.parse(filter ?? {});
  const { company } = await requireCompanyContextForActor(actorId, companyId, "healthcare.consent.view");
  await assertHealthcareModuleEnabled(company.id);
  if (parsed.medicalCaseId) {
    await assertSameCompanyMedicalCase(company.id, parsed.medicalCaseId);
  }

  const records = await db.consentRecord.findMany({
    where: {
      // Lọc theo companyId của CHÍNH ConsentRecord (ADR-038) — không join
      // ngược qua medicalCase.companyId; bất biến #29: không đường nào đọc
      // consent cross-company.
      companyId: company.id,
      ...(parsed.medicalCaseId ? { medicalCaseId: parsed.medicalCaseId } : {}),
      ...(parsed.consentType ? { consentType: parsed.consentType } : {}),
      ...(parsed.status ? { status: parsed.status } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  return records.map((r) => toConsentRecordView(r, now));
}

/**
 * Phiếu đồng ý CÒN HIỆU LỰC của một ca: đã SIGNED, chưa thu hồi, chưa hết hạn.
 * Đây là nguồn cho `hasValidSignedConsent` của `evaluateProcedureReadiness`
 * (bất biến #68/#69/#168: thiếu consent thì thủ thuật không ready, và kết quả
 * do code deterministic quyết định — không có đường nào cho LLM chen vào).
 *
 * `revokedAt: null` là kiểm tra thừa so với `status: "SIGNED"` — cố ý giữ:
 * nếu về sau có đường ghi nào set `revokedAt` mà quên đổi `status`, phiếu đã
 * bị rút vẫn sẽ KHÔNG lọt qua cổng readiness của thủ thuật.
 */
export async function getActiveSignedConsentForCase(
  actorId: string,
  companyId: string,
  medicalCaseId: string,
  consentType?: ConsentType,
): Promise<ConsentRecordView | null> {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "healthcare.consent.view");
  await assertHealthcareModuleEnabled(company.id);
  await assertSameCompanyMedicalCase(company.id, medicalCaseId);

  const now = new Date();
  const record = await db.consentRecord.findFirst({
    where: {
      companyId: company.id,
      medicalCaseId,
      status: "SIGNED",
      revokedAt: null,
      ...(consentType ? { consentType } : {}),
      // Hết hạn lọc bằng chính `now` này, không dựa vào job nền đi ghi
      // EXPIRED (xem `deriveEffectiveStatus`).
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    // Phiếu ký gần nhất — khi một ca có nhiều phiếu cùng loại (ký lại sau khi
    // thu hồi phiếu cũ), phiếu mới nhất mới là phiếu đang có hiệu lực.
    orderBy: { signedAt: "desc" },
  });

  return record ? toConsentRecordView(record, now) : null;
}
