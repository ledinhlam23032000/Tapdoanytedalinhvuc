import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyContextForActor } from "@/lib/authorization/company-context";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import {
  assertSameCompanyCustomer,
  assertSameCompanyOrganizationUnit,
  assertSameCompanyMedicalCase,
  assertActiveMemberOfCompany,
} from "@/lib/domain/scope-guards";
import { assertHealthcareModuleEnabled } from "@/lib/domain/healthcare/module-service";

// Domain service — MedicalCase (Phần 7). Đọc `docs/domain/HEALTHCARE.md` và
// ADR-037/038/050 trước khi sửa.
//
// Hai cổng độc lập ở MỌI hàm: requireCompanyContextForActor (permission) rồi
// assertHealthcareModuleEnabled (module đã bật chưa). Có quyền mà Company
// chưa bật phân hệ Y tế thì vẫn bị từ chối.

const createMedicalCaseSchema = z.object({
  companyId: z.string().min(1),
  customerId: z.string().min(1),
  code: z.string().trim().min(1).max(50).optional(),
  caseType: z.enum(["CONSULTATION", "TREATMENT", "AESTHETIC_PROCEDURE", "FOLLOW_UP", "OTHER"]).optional(),
  chiefComplaint: z.string().trim().min(1).max(2000).optional(),
  primaryClinicianUserId: z.string().min(1).optional(),
  organizationUnitId: z.string().min(1).optional(),
});

/**
 * ADR-037: KHÔNG có auto-create. Case luôn được tạo tường minh — legacy tự
 * sinh một CaseRecord nháp cho MỌI khách vừa tiếp nhận
 * (`tiep-nhan/actions.ts:108`), khiến số hồ sơ không phản ánh số ca thật.
 */
export async function createMedicalCase(actorId: string, input: z.input<typeof createMedicalCaseSchema>) {
  const parsed = createMedicalCaseSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "healthcare.case.create");
  await assertHealthcareModuleEnabled(company.id);

  // Bất biến #53 — Case và Customer PHẢI cùng Company. Verify bằng chính
  // companyId của Customer, không suy ngược lại (ADR-038).
  await assertSameCompanyCustomer(company.id, parsed.customerId);
  if (parsed.organizationUnitId) {
    await assertSameCompanyOrganizationUnit(company.id, parsed.organizationUnitId);
  }
  if (parsed.primaryClinicianUserId) {
    await assertActiveMemberOfCompany(company.id, parsed.primaryClinicianUserId);
  }

  if (parsed.code) {
    const duplicate = await db.medicalCase.findFirst({
      where: { companyId: company.id, code: parsed.code },
      select: { id: true },
    });
    // Bắt trước để trả thông báo hiểu được, thay vì để lỗi unique constraint
    // của Prisma lọt ra UI (bất biến #138: không hiện mã lỗi nội bộ).
    if (duplicate) throw new Error(`Mã hồ sơ "${parsed.code}" đã tồn tại trong công ty này.`);
  }

  return db.$transaction(async (tx) => {
    const record = await tx.medicalCase.create({
      data: {
        companyId: company.id,
        customerId: parsed.customerId,
        code: parsed.code,
        caseType: parsed.caseType ?? "CONSULTATION",
        chiefComplaint: parsed.chiefComplaint,
        primaryClinicianUserId: parsed.primaryClinicianUserId,
        organizationUnitId: parsed.organizationUnitId,
        createdByUserId: actor.id,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.MEDICAL_CASE_CREATED,
      targetType: "MedicalCase",
      targetId: record.id,
      companyId: company.id,
      metadata: { customerId: parsed.customerId, caseType: record.caseType },
    });
    return { id: record.id };
  });
}

const updateMedicalCaseSchema = z.object({
  companyId: z.string().min(1),
  medicalCaseId: z.string().min(1),
  caseType: z.enum(["CONSULTATION", "TREATMENT", "AESTHETIC_PROCEDURE", "FOLLOW_UP", "OTHER"]).optional(),
  status: z.enum(["OPEN", "IN_TREATMENT", "FOLLOW_UP"]).optional(),
  chiefComplaint: z.string().trim().max(2000).optional(),
  primaryClinicianUserId: z.string().min(1).nullable().optional(),
  organizationUnitId: z.string().min(1).nullable().optional(),
});

export async function updateMedicalCase(actorId: string, input: z.input<typeof updateMedicalCaseSchema>) {
  const parsed = updateMedicalCaseSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "healthcare.case.update");
  await assertHealthcareModuleEnabled(company.id);
  const existing = await assertSameCompanyMedicalCase(company.id, parsed.medicalCaseId);

  if (parsed.organizationUnitId) {
    await assertSameCompanyOrganizationUnit(company.id, parsed.organizationUnitId);
  }
  if (parsed.primaryClinicianUserId) {
    await assertActiveMemberOfCompany(company.id, parsed.primaryClinicianUserId);
  }

  return db.$transaction(async (tx) => {
    // Khoá + đọc lại TRONG transaction — chặn đua với closeMedicalCase: nếu
    // không, update có thể ghi đè nội dung lên một case vừa đóng (đọc OPEN ở
    // ngoài trong lúc bên kia đang đóng), và nếu parsed.status được truyền thì
    // còn âm thầm "mở lại" case mà không qua reopenMedicalCase (bỏ qua reason
    // bắt buộc + audit REOPENED tương ứng) — vi phạm bất biến #172.
    await tx.$queryRaw`SELECT id FROM "MedicalCase" WHERE id = ${existing.id} FOR UPDATE`;
    const fresh = await tx.medicalCase.findUniqueOrThrow({ where: { id: existing.id } });
    if (fresh.status === "CLOSED" || fresh.status === "CANCELLED") {
      throw new Error("Hồ sơ đã đóng hoặc đã huỷ — mở lại hồ sơ trước khi sửa.");
    }

    const record = await tx.medicalCase.update({
      where: { id: fresh.id },
      data: {
        caseType: parsed.caseType,
        status: parsed.status,
        chiefComplaint: parsed.chiefComplaint,
        primaryClinicianUserId: parsed.primaryClinicianUserId,
        organizationUnitId: parsed.organizationUnitId,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.MEDICAL_CASE_UPDATED,
      targetType: "MedicalCase",
      targetId: record.id,
      companyId: company.id,
    });
    return { id: record.id };
  });
}

const closeMedicalCaseSchema = z.object({
  companyId: z.string().min(1),
  medicalCaseId: z.string().min(1),
  outcome: z.enum(["CLOSED", "CANCELLED"]),
  reason: z.string().trim().min(1).max(2000),
});

/**
 * Bất biến #88: đóng hồ sơ KHÔNG xoá gì cả — chỉ đổi status + closedAt +
 * closeReason. Toàn bộ consultation/procedure/consent/ảnh/audit vẫn còn
 * nguyên và đọc lại được sau khi đóng.
 */
export async function closeMedicalCase(actorId: string, input: z.input<typeof closeMedicalCaseSchema>) {
  const parsed = closeMedicalCaseSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "healthcare.case.close");
  await assertHealthcareModuleEnabled(company.id);
  const existing = await assertSameCompanyMedicalCase(company.id, parsed.medicalCaseId);

  return db.$transaction(async (tx) => {
    // P0 fix (red-team CONFIRMED): bản cũ đọc status + đếm Procedure
    // IN_PROGRESS NGOÀI transaction rồi mới update — hai request đóng đồng
    // thời đều đọc cùng baseline trước khi bên nào commit (sinh 2 audit mâu
    // thuẫn), và một startProcedure() commit xen giữa lúc đọc và lúc ghi có
    // thể để lại MedicalCase.status=CLOSED trong khi Procedure vẫn
    // IN_PROGRESS — đúng trạng thái không hợp lệ mà mục CCCLIV cấm. Khoá +
    // đọc lại NGAY TRONG transaction, cùng pattern đã dùng ở
    // finalizeConsultation/completeProcedure/signConsent/revokeConsent.
    await tx.$queryRaw`SELECT id FROM "MedicalCase" WHERE id = ${existing.id} FOR UPDATE`;
    const fresh = await tx.medicalCase.findUniqueOrThrow({ where: { id: existing.id } });

    if (fresh.status === "CLOSED" || fresh.status === "CANCELLED") {
      throw new Error("Hồ sơ này đã kết thúc trước đó.");
    }

    // Không đóng được khi còn thủ thuật đang dở — đóng lúc đó sẽ để lại bản
    // ghi mồ côi về mặt nghiệp vụ (thủ thuật IN_PROGRESS thuộc một ca đã đóng).
    const inFlight = await tx.procedure.count({
      where: { medicalCaseId: fresh.id, status: "IN_PROGRESS" },
    });
    if (inFlight > 0) {
      throw new Error(`Còn ${inFlight} thủ thuật đang thực hiện — hoàn tất hoặc huỷ trước khi đóng hồ sơ.`);
    }

    const record = await tx.medicalCase.update({
      where: { id: fresh.id },
      data: { status: parsed.outcome, closedAt: new Date(), closeReason: parsed.reason },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.MEDICAL_CASE_CLOSED,
      targetType: "MedicalCase",
      targetId: record.id,
      companyId: company.id,
      metadata: { outcome: parsed.outcome, reason: parsed.reason },
    });
    return { id: record.id };
  });
}

const reopenSchema = z.object({
  companyId: z.string().min(1),
  medicalCaseId: z.string().min(1),
  reason: z.string().trim().min(1).max(2000),
});

export async function reopenMedicalCase(actorId: string, input: z.input<typeof reopenSchema>) {
  const parsed = reopenSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "healthcare.case.close");
  await assertHealthcareModuleEnabled(company.id);
  const existing = await assertSameCompanyMedicalCase(company.id, parsed.medicalCaseId);

  return db.$transaction(async (tx) => {
    // Khoá + đọc lại TRONG transaction cho nhất quán với updateMedicalCase/
    // closeMedicalCase — hai lần reopen đồng thời hội tụ cùng kết quả nên tác
    // động thấp, nhưng vẫn nên khoá để không đọc status stale.
    await tx.$queryRaw`SELECT id FROM "MedicalCase" WHERE id = ${existing.id} FOR UPDATE`;
    const fresh = await tx.medicalCase.findUniqueOrThrow({ where: { id: existing.id } });
    if (fresh.status !== "CLOSED") {
      throw new Error("Chỉ mở lại được hồ sơ đã đóng.");
    }

    // closedAt/closeReason được xoá về null, nhưng lần đóng trước vẫn còn dấu
    // vết đầy đủ trong AuditEvent — không mất lịch sử (bất biến #88).
    const record = await tx.medicalCase.update({
      where: { id: fresh.id },
      data: { status: "IN_TREATMENT", closedAt: null, closeReason: null },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.MEDICAL_CASE_REOPENED,
      targetType: "MedicalCase",
      targetId: record.id,
      companyId: company.id,
      metadata: { reason: parsed.reason },
    });
    return { id: record.id };
  });
}

// ===== Read =====

// Customer include LUÔN kèm omit SĐT mã hoá. Đây là bug class đã xảy ra thật
// ở Phần 5 (6 vị trí) và lặp lại ở Phần 6 (getPaymentDetail) — không để nó
// xảy ra lần thứ ba.
const CUSTOMER_SAFE_SELECT = {
  omit: { phoneCiphertext: true, phoneHash: true },
} as const;

/**
 * `chiefComplaint` là nội dung lâm sàng thật (lý do khám), cùng nhóm nhạy cảm
 * với SOAP của ClinicalConsultation (ADR-052) — KHÔNG được lộ cho actor chỉ
 * có `healthcare.case.view` (case tồn tại/trạng thái) mà thiếu
 * `healthcare.consultation.view`. P1 fix (adversarial review Phần 7): trước
 * đây field này lộ nguyên vẹn qua getMedicalCaseList/Detail cho pack RECEPTION
 * và mọi role generic OWNER/ADMIN/MANAGER dù các pack/preset đó cố tình không
 * cấp quyền đọc nội dung khám.
 */
function redactChiefComplaint<T extends { chiefComplaint: string | null }>(
  record: T,
  canReadClinicalContent: boolean,
): T {
  return canReadClinicalContent ? record : { ...record, chiefComplaint: null };
}

export async function getMedicalCaseList(
  actorId: string,
  companyId: string,
  filter?: { status?: "OPEN" | "IN_TREATMENT" | "FOLLOW_UP" | "CLOSED" | "CANCELLED"; customerId?: string },
) {
  const { company, permissions } = await requireCompanyContextForActor(actorId, companyId, "healthcare.case.view");
  await assertHealthcareModuleEnabled(company.id);
  const canReadClinicalContent = permissions.has("healthcare.consultation.view");

  // Bất biến #139: KHÔNG tồn tại "get all cases" không scope — companyId luôn
  // nằm trong where, không phải lọc sau khi fetch.
  const cases = await db.medicalCase.findMany({
    where: { companyId: company.id, status: filter?.status, customerId: filter?.customerId },
    include: {
      customer: CUSTOMER_SAFE_SELECT,
      primaryClinician: { omit: { passwordHash: true } },
    },
    orderBy: { openedAt: "desc" },
    take: 200,
  });
  return cases.map((c) => redactChiefComplaint(c, canReadClinicalContent));
}

export async function getMedicalCaseDetail(actorId: string, companyId: string, medicalCaseId: string) {
  const { company, permissions } = await requireCompanyContextForActor(actorId, companyId, "healthcare.case.view");
  await assertHealthcareModuleEnabled(company.id);
  await assertSameCompanyMedicalCase(company.id, medicalCaseId);

  const record = await db.medicalCase.findUnique({
    where: { id: medicalCaseId },
    include: {
      customer: CUSTOMER_SAFE_SELECT,
      primaryClinician: { omit: { passwordHash: true } },
      createdBy: { omit: { passwordHash: true } },
      organizationUnit: true,
    },
  });
  if (!record) return record;
  return redactChiefComplaint(record, permissions.has("healthcare.consultation.view"));
}

/** Dùng cho tab "Hồ sơ chuyên môn" trên trang Customer (bất biến #102). */
export async function getMedicalCasesForCustomer(actorId: string, companyId: string, customerId: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "healthcare.case.view");
  await assertHealthcareModuleEnabled(company.id);
  await assertSameCompanyCustomer(company.id, customerId);

  return db.medicalCase.findMany({
    where: { companyId: company.id, customerId },
    orderBy: { openedAt: "desc" },
  });
}
