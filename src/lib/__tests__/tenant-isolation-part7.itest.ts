// Integration test — Tenant Isolation + bất biến lâm sàng cho Phần 7
// (Healthcare / Aesthetics Vertical). Dữ liệu y tế là loại nhạy cảm nhất
// trong toàn hệ thống — xem ADR-036..ADR-051 và docs/legacy/PART7_SPEC_DIGEST.md.
//
// Điểm khác mọi Phần trước: Phần 7 có HAI CỔNG độc lập (permission VÀ module
// enablement). Test phải chứng minh cả hai chiều, không chỉ một.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { AuthorizationError } from "@/lib/authorization/errors";
import * as moduleService from "@/lib/domain/healthcare/module-service";
import * as caseService from "@/lib/domain/healthcare/medical-case-service";
import * as consultationService from "@/lib/domain/healthcare/consultation-service";
import * as procedureService from "@/lib/domain/healthcare/procedure-service";
import * as consentService from "@/lib/domain/healthcare/consent-service";
import * as inventoryService from "@/lib/domain/inventory-service";

const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (/clinic|production|hongphuc|zenith/i.test(DATABASE_URL)) {
  throw new Error(
    `Refusing to run tenant-isolation-part7.itest.ts against a DB URL that looks like production/clinic: ${DATABASE_URL}`,
  );
}

type Fixtures = Awaited<ReturnType<typeof seed>>;
let fx: Fixtures;

async function seed() {
  const suffix = Math.random().toString(36).slice(2, 8);
  const pw = await hashPassword("Test-Password-123");

  const mkUser = (name: string) =>
    db.user.create({
      data: { displayName: name, email: `${name.toLowerCase()}-${suffix}@test.local`, passwordHash: pw },
    });

  const [ownerA, doctorA, nurseA, receptionA, ownerB, doctorB, outsider] = await Promise.all([
    mkUser("OwnerA7"),
    mkUser("DoctorA7"),
    mkUser("NurseA7"),
    mkUser("ReceptionA7"),
    mkUser("OwnerB7"),
    mkUser("DoctorB7"),
    mkUser("Outsider7"),
  ]);

  const ecosystem = await db.ecosystem.create({ data: { code: `e7-${suffix}`, name: "E7" } });

  // companyA: bật module Healthcare. companyC: KHÔNG bật — dùng để chứng minh
  // cổng module là thật, độc lập với permission.
  const companyA = await db.company.create({
    data: { ecosystemId: ecosystem.id, code: `p7-a-${suffix}`, name: "Company A7", status: "ACTIVE", type: "HEALTHCARE" },
  });
  const companyB = await db.company.create({
    data: { ecosystemId: ecosystem.id, code: `p7-b-${suffix}`, name: "Company B7", status: "ACTIVE", type: "HEALTHCARE" },
  });
  const companyC = await db.company.create({
    data: { ecosystemId: ecosystem.id, code: `p7-c-${suffix}`, name: "Company C7 (module off)", status: "ACTIVE" },
  });

  await db.companyMembership.createMany({
    data: [
      { companyId: companyA.id, userId: ownerA.id, rolePreset: "OWNER" },
      { companyId: companyA.id, userId: doctorA.id, rolePreset: "MEMBER" },
      { companyId: companyA.id, userId: nurseA.id, rolePreset: "MEMBER" },
      { companyId: companyA.id, userId: receptionA.id, rolePreset: "MEMBER" },
      { companyId: companyB.id, userId: ownerB.id, rolePreset: "OWNER" },
      { companyId: companyB.id, userId: doctorB.id, rolePreset: "MEMBER" },
      { companyId: companyC.id, userId: ownerA.id, rolePreset: "OWNER" },
    ],
  });

  // Pack chuyên môn (ADR-051) — bác sĩ là MEMBER về tổ chức nhưng có quyền
  // lâm sàng; reception cũng MEMBER nhưng KHÔNG có quyền đọc nội dung khám.
  const grantPack = async (companyId: string, userId: string, pack: "HEALTHCARE_DOCTOR" | "HEALTHCARE_NURSE" | "HEALTHCARE_RECEPTION") => {
    const m = await db.companyMembership.findUniqueOrThrow({ where: { companyId_userId: { companyId, userId } } });
    await db.companyMembershipPack.create({ data: { membershipId: m.id, pack, grantedByUserId: userId } });
  };
  await grantPack(companyA.id, doctorA.id, "HEALTHCARE_DOCTOR");
  await grantPack(companyA.id, nurseA.id, "HEALTHCARE_NURSE");
  await grantPack(companyA.id, receptionA.id, "HEALTHCARE_RECEPTION");
  await grantPack(companyB.id, doctorB.id, "HEALTHCARE_DOCTOR");

  await db.companyModule.createMany({
    data: [
      { companyId: companyA.id, module: "HEALTHCARE", enabledByUserId: ownerA.id },
      { companyId: companyB.id, module: "HEALTHCARE", enabledByUserId: ownerB.id },
    ],
  });

  const customerA = await db.customer.create({ data: { companyId: companyA.id, name: "Khách A7" } });
  const customerB = await db.customer.create({ data: { companyId: companyB.id, name: "Khách B7" } });

  const locationA = await db.inventoryLocation.create({ data: { companyId: companyA.id, name: "Kho A7" } });
  const locationB = await db.inventoryLocation.create({ data: { companyId: companyB.id, name: "Kho B7" } });
  const itemA = await db.inventoryItem.create({ data: { companyId: companyA.id, name: "Kim tiêm A7", unit: "cái" } });
  const itemB = await db.inventoryItem.create({ data: { companyId: companyB.id, name: "Vật tư B7", unit: "cái" } });

  return {
    suffix, ownerA, doctorA, nurseA, receptionA, ownerB, doctorB, outsider,
    ecosystem, companyA, companyB, companyC,
    customerA, customerB, locationA, locationB, itemA, itemB,
  };
}

async function cleanup(f: Fixtures) {
  const userIds = [f.ownerA, f.doctorA, f.nurseA, f.receptionA, f.ownerB, f.doctorB, f.outsider].map((u) => u.id);
  const companyIds = [f.companyA.id, f.companyB.id, f.companyC.id];
  await db.auditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
  await db.medicalFollowUp.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.clinicalPhoto.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.procedureMaterialUsage.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.procedure.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.consentRecord.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.consentTemplate.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.clinicalScreeningItem.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.clinicalConsultationAddendum.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.clinicalConsultation.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.medicalCase.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.stockMovement.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.inventoryItem.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.inventoryLocation.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.customer.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.companyModule.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.companyMembershipPack.deleteMany({ where: { membership: { companyId: { in: companyIds } } } });
  await db.companyMembership.deleteMany({ where: { userId: { in: userIds } } });
  await db.company.deleteMany({ where: { id: { in: companyIds } } });
  await db.ecosystem.deleteMany({ where: { id: f.ecosystem.id } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
}

beforeAll(async () => {
  fx = await seed();
}, 60_000);

afterAll(async () => {
  if (fx) await cleanup(fx);
}, 60_000);

// ============================================================================

describe("Cổng module Healthcare — độc lập với permission (ADR-047)", () => {
  it("#59/#87 Company chưa bật module: có quyền vẫn bị từ chối", async () => {
    // ownerA là OWNER của companyC nên có đủ healthcare.case.view/create,
    // nhưng companyC không bật module.
    // ownerA la OWNER nhung preset OWNER CO Y khong co healthcare.case.create
    // (quyen lam sang den tu pack, ADR-051). Khong cap pack thi permission
    // chan truoc va test se khong cham toi cong module — cap pack de co lap
    // dung thu can kiem: module chua bat.
    const mC = await db.companyMembership.findUniqueOrThrow({
      where: { companyId_userId: { companyId: fx.companyC.id, userId: fx.ownerA.id } },
    });
    await db.companyMembershipPack.create({
      data: { membershipId: mC.id, pack: "HEALTHCARE_DOCTOR", grantedByUserId: fx.ownerA.id },
    });
    const customerC = await db.customer.create({ data: { companyId: fx.companyC.id, name: "Khách C7" } });
    await expect(
      caseService.createMedicalCase(fx.ownerA.id, {
        companyId: fx.companyC.id,
        customerId: customerC.id,
      }),
    ).rejects.toThrow(/chưa bật phân hệ/i);
    await db.customer.delete({ where: { id: customerC.id } });
    await db.companyMembershipPack.deleteMany({ where: { membershipId: mC.id } });
  });

  it("Company đã bật module + có quyền: thành công", async () => {
    const r = await caseService.createMedicalCase(fx.doctorA.id, {
      companyId: fx.companyA.id,
      customerId: fx.customerA.id,
      chiefComplaint: "Khám tổng quát",
    });
    expect(r.id).toBeTruthy();
  });

  it("bật module Company A không làm Company C truy cập được (#60)", async () => {
    expect(await moduleService.isHealthcareModuleEnabled(fx.companyA.id)).toBe(true);
    expect(await moduleService.isHealthcareModuleEnabled(fx.companyC.id)).toBe(false);
  });
});

describe("Permission pack (ADR-051)", () => {
  it("#50 reception KHÔNG đọc được nội dung khám dù cùng Company", async () => {
    await expect(
      consultationService.getConsultationList(fx.receptionA.id, fx.companyA.id, "bat-ky-id"),
    ).rejects.toThrow(AuthorizationError);
  });

  it("reception VẪN tạo được hồ sơ (pack có case.create)", async () => {
    const r = await caseService.createMedicalCase(fx.receptionA.id, {
      companyId: fx.companyA.id,
      customerId: fx.customerA.id,
    });
    expect(r.id).toBeTruthy();
  });

  it("#99 thu hồi membership vô hiệu hoá pack ngay lập tức", async () => {
    const m = await db.companyMembership.findUniqueOrThrow({
      where: { companyId_userId: { companyId: fx.companyA.id, userId: fx.nurseA.id } },
    });
    await db.companyMembership.update({ where: { id: m.id }, data: { status: "INACTIVE" } });
    await expect(
      caseService.getMedicalCaseList(fx.nurseA.id, fx.companyA.id),
    ).rejects.toThrow(AuthorizationError);
    await db.companyMembership.update({ where: { id: m.id }, data: { status: "ACTIVE" } });
  });

  it("#58 không gắn pack được cho người ngoài Company", async () => {
    await expect(
      moduleService.grantPermissionPack(fx.ownerA.id, {
        companyId: fx.companyA.id,
        userId: fx.outsider.id,
        pack: "HEALTHCARE_NURSE",
      }),
    ).rejects.toThrow(AuthorizationError);
  });
});

describe("Cross-company (ADR-038)", () => {
  it("#53 tạo Case với Customer của Company khác: DENY", async () => {
    await expect(
      caseService.createMedicalCase(fx.doctorA.id, {
        companyId: fx.companyA.id,
        customerId: fx.customerB.id,
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("#54 bác sĩ Company B đọc Case Company A: DENY", async () => {
    const c = await caseService.createMedicalCase(fx.doctorA.id, {
      companyId: fx.companyA.id,
      customerId: fx.customerA.id,
    });
    await expect(
      caseService.getMedicalCaseDetail(fx.doctorB.id, fx.companyB.id, c.id),
    ).rejects.toThrow(AuthorizationError);
  });

  it("#56 dùng vật tư Company B cho thủ thuật Company A: DENY", async () => {
    const c = await caseService.createMedicalCase(fx.doctorA.id, {
      companyId: fx.companyA.id,
      customerId: fx.customerA.id,
    });
    const p = await procedureService.planProcedure(fx.doctorA.id, {
      companyId: fx.companyA.id,
      medicalCaseId: c.id,
      primaryClinicianUserId: fx.doctorA.id,
      procedureType: "consult",
    });
    await procedureService.startProcedure(fx.doctorA.id, { companyId: fx.companyA.id, procedureId: p.id });
    await expect(
      procedureService.completeProcedure(fx.doctorA.id, {
        companyId: fx.companyA.id,
        procedureId: p.id,
        materials: [{ inventoryItemId: fx.itemB.id, inventoryLocationId: fx.locationB.id, quantity: 1 }],
      }),
    ).rejects.toThrow(AuthorizationError);
  });
});

describe("Bản ghi lâm sàng bất biến sau FINAL (ADR-039)", () => {
  async function makeConsultation() {
    const c = await caseService.createMedicalCase(fx.doctorA.id, {
      companyId: fx.companyA.id,
      customerId: fx.customerA.id,
    });
    const con = await consultationService.createConsultation(fx.doctorA.id, {
      companyId: fx.companyA.id,
      medicalCaseId: c.id,
      assessment: "Ban đầu",
    });
    return { caseId: c.id, consultationId: con.id };
  }

  it("#22 sửa nội dung sau FINAL: DENY", async () => {
    const { consultationId } = await makeConsultation();
    await consultationService.finalizeConsultation(fx.doctorA.id, { companyId: fx.companyA.id, consultationId });
    await expect(
      consultationService.updateDraftConsultation(fx.doctorA.id, {
        companyId: fx.companyA.id,
        consultationId,
        assessment: "Sửa lén",
      }),
    ).rejects.toThrow(/đã chốt/i);
  });

  it("#166 finalize hai lần: DENY", async () => {
    const { consultationId } = await makeConsultation();
    await consultationService.finalizeConsultation(fx.doctorA.id, { companyId: fx.companyA.id, consultationId });
    await expect(
      consultationService.finalizeConsultation(fx.doctorA.id, { companyId: fx.companyA.id, consultationId }),
    ).rejects.toThrow(/đã được chốt/i);
  });

  it("addendum KHÔNG đụng tới bản gốc", async () => {
    const { consultationId } = await makeConsultation();
    await consultationService.finalizeConsultation(fx.doctorA.id, { companyId: fx.companyA.id, consultationId });
    const before = await db.clinicalConsultation.findUniqueOrThrow({ where: { id: consultationId } });

    await consultationService.addConsultationAddendum(fx.doctorA.id, {
      companyId: fx.companyA.id,
      consultationId,
      content: "Bổ sung sau khi chốt",
      reason: "Quên ghi dị ứng",
    });

    const after = await db.clinicalConsultation.findUniqueOrThrow({ where: { id: consultationId } });
    expect(after.assessment).toBe(before.assessment);
    expect(after.finalizedAt).toEqual(before.finalizedAt);
    const addenda = await db.clinicalConsultationAddendum.findMany({ where: { consultationId } });
    expect(addenda).toHaveLength(1);
  });
});

describe("Chưa ghi nhận ≠ ghi nhận là không (ADR-048)", () => {
  it("#111 answer null giữ nguyên null, recordedAt cũng null", async () => {
    const c = await caseService.createMedicalCase(fx.doctorA.id, {
      companyId: fx.companyA.id,
      customerId: fx.customerA.id,
    });
    const con = await consultationService.createConsultation(fx.doctorA.id, {
      companyId: fx.companyA.id,
      medicalCaseId: c.id,
    });
    await consultationService.recordScreeningItem(fx.doctorA.id, {
      companyId: fx.companyA.id,
      consultationId: con.id,
      itemKey: "allergy",
      question: "Có dị ứng thuốc không?",
      answer: null,
    });
    const item = await db.clinicalScreeningItem.findFirstOrThrow({
      where: { consultationId: con.id, itemKey: "allergy" },
    });
    // Điểm mấu chốt: KHÔNG được là "NO". Chưa hỏi khác hẳn đã hỏi và không có.
    expect(item.answer).toBeNull();
    expect(item.recordedAt).toBeNull();
  });

  it('ghi nhận "NO" thì answer=NO và recordedAt có giá trị', async () => {
    const c = await caseService.createMedicalCase(fx.doctorA.id, {
      companyId: fx.companyA.id,
      customerId: fx.customerA.id,
    });
    const con = await consultationService.createConsultation(fx.doctorA.id, {
      companyId: fx.companyA.id,
      medicalCaseId: c.id,
    });
    await consultationService.recordScreeningItem(fx.doctorA.id, {
      companyId: fx.companyA.id,
      consultationId: con.id,
      itemKey: "allergy",
      question: "Có dị ứng thuốc không?",
      answer: "NO",
    });
    const item = await db.clinicalScreeningItem.findFirstOrThrow({
      where: { consultationId: con.id, itemKey: "allergy" },
    });
    expect(item.answer).toBe("NO");
    expect(item.recordedAt).not.toBeNull();
  });
});

describe("Procedure readiness + vật tư (ADR-043/044)", () => {
  async function readyProcedureWithStock(qty: number) {
    const c = await caseService.createMedicalCase(fx.doctorA.id, {
      companyId: fx.companyA.id,
      customerId: fx.customerA.id,
    });
    const p = await procedureService.planProcedure(fx.doctorA.id, {
      companyId: fx.companyA.id,
      medicalCaseId: c.id,
      primaryClinicianUserId: fx.doctorA.id,
      procedureType: "consult", // policy lỏng — mục CVI
    });
    await inventoryService.receiveStock(fx.ownerA.id, {
      companyId: fx.companyA.id,
      inventoryItemId: fx.itemA.id,
      locationId: fx.locationA.id,
      quantity: qty,
    });
    await procedureService.startProcedure(fx.doctorA.id, { companyId: fx.companyA.id, procedureId: p.id });
    return p.id;
  }

  it("#168 chưa đủ điều kiện thì không start được, và nêu rõ lý do", async () => {
    const c = await caseService.createMedicalCase(fx.doctorA.id, {
      companyId: fx.companyA.id,
      customerId: fx.customerA.id,
    });
    // procedureType không phải "consult" -> policy mặc định, cần consent +
    // phiếu khám đã chốt, mà chưa có gì cả.
    const p = await procedureService.planProcedure(fx.doctorA.id, {
      companyId: fx.companyA.id,
      medicalCaseId: c.id,
      primaryClinicianUserId: fx.doctorA.id,
      procedureType: "tiem-filler",
    });
    await expect(
      procedureService.startProcedure(fx.doctorA.id, { companyId: fx.companyA.id, procedureId: p.id }),
    ).rejects.toThrow(/Chưa đủ điều kiện[^]*phiếu đồng ý/i);
  });

  it("#94 hoàn tất thủ thuật trừ kho ĐÚNG MỘT LẦN", async () => {
    const procedureId = await readyProcedureWithStock(10);
    await procedureService.completeProcedure(fx.doctorA.id, {
      companyId: fx.companyA.id,
      procedureId,
      materials: [{ inventoryItemId: fx.itemA.id, inventoryLocationId: fx.locationA.id, quantity: 3 }],
    });
    const outs = await db.stockMovement.findMany({
      where: { companyId: fx.companyA.id, sourceType: "PROCEDURE_MATERIAL_USAGE", type: "OUT" },
    });
    const forThis = outs.filter((m) => m.reason?.includes(procedureId));
    expect(forThis).toHaveLength(1);
    expect(Number(forThis[0].quantity)).toBe(3);
  });

  it("#94/CLIX hoàn tất lần 2: DENY, không trừ kho thêm", async () => {
    const procedureId = await readyProcedureWithStock(10);
    await procedureService.completeProcedure(fx.doctorA.id, {
      companyId: fx.companyA.id,
      procedureId,
      materials: [{ inventoryItemId: fx.itemA.id, inventoryLocationId: fx.locationA.id, quantity: 2 }],
    });
    const before = await db.stockMovement.count({
      where: { companyId: fx.companyA.id, sourceType: "PROCEDURE_MATERIAL_USAGE" },
    });
    await expect(
      procedureService.completeProcedure(fx.doctorA.id, {
        companyId: fx.companyA.id,
        procedureId,
        materials: [{ inventoryItemId: fx.itemA.id, inventoryLocationId: fx.locationA.id, quantity: 2 }],
      }),
    ).rejects.toThrow(/đã được hoàn tất/i);
    const after = await db.stockMovement.count({
      where: { companyId: fx.companyA.id, sourceType: "PROCEDURE_MATERIAL_USAGE" },
    });
    expect(after).toBe(before);
  });

  it("CCCLXV thiếu tồn kho -> KHÔNG chuyển COMPLETED (rollback toàn bộ)", async () => {
    const c = await caseService.createMedicalCase(fx.doctorA.id, {
      companyId: fx.companyA.id,
      customerId: fx.customerA.id,
    });
    const p = await procedureService.planProcedure(fx.doctorA.id, {
      companyId: fx.companyA.id,
      medicalCaseId: c.id,
      primaryClinicianUserId: fx.doctorA.id,
      procedureType: "consult",
    });
    await procedureService.startProcedure(fx.doctorA.id, { companyId: fx.companyA.id, procedureId: p.id });

    await expect(
      procedureService.completeProcedure(fx.doctorA.id, {
        companyId: fx.companyA.id,
        procedureId: p.id,
        materials: [{ inventoryItemId: fx.itemA.id, inventoryLocationId: fx.locationA.id, quantity: 999_999 }],
      }),
    ).rejects.toThrow(/Không đủ tồn kho/i);

    // Đây là điểm quan trọng nhất: thủ thuật KHÔNG được báo hoàn tất nửa vời.
    const after = await db.procedure.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.status).toBe("IN_PROGRESS");
    const usages = await db.procedureMaterialUsage.count({ where: { procedureId: p.id } });
    expect(usages).toBe(0);
  });

  it("#96 hoàn trả vật tư khôi phục tồn kho, không xoá cứng", async () => {
    const procedureId = await readyProcedureWithStock(10);
    await procedureService.completeProcedure(fx.doctorA.id, {
      companyId: fx.companyA.id,
      procedureId,
      materials: [{ inventoryItemId: fx.itemA.id, inventoryLocationId: fx.locationA.id, quantity: 4 }],
    });
    const usage = await db.procedureMaterialUsage.findFirstOrThrow({ where: { procedureId } });

    await procedureService.reverseProcedureMaterial(fx.doctorA.id, {
      companyId: fx.companyA.id,
      usageId: usage.id,
      reason: "Ghi nhầm số lượng",
    });

    const still = await db.procedureMaterialUsage.findUniqueOrThrow({ where: { id: usage.id } });
    expect(still.status).toBe("REVERSED");
    expect(still.reversalReason).toBe("Ghi nhầm số lượng");
    const back = await db.stockMovement.findFirst({
      where: { companyId: fx.companyA.id, sourceId: usage.id, type: "IN" },
    });
    expect(back).not.toBeNull();
  });
});

describe("Consent — snapshot + REVOKED, không xoá (ADR-042)", () => {
  it("#90 sửa template KHÔNG đổi consent đã tạo", async () => {
    const t = await consentService.createConsentTemplate(fx.ownerA.id, {
      companyId: fx.companyA.id,
      code: `tpl-${fx.suffix}`,
      title: "Đồng ý thủ thuật",
      body: "Nội dung bản 1",
    });
    const c = await caseService.createMedicalCase(fx.doctorA.id, {
      companyId: fx.companyA.id,
      customerId: fx.customerA.id,
    });
    const rec = await consentService.createConsentRecord(fx.doctorA.id, {
      companyId: fx.companyA.id,
      medicalCaseId: c.id,
      consentTemplateId: t.id,
    });

    // Tạo version mới của template
    await consentService.createConsentTemplate(fx.ownerA.id, {
      companyId: fx.companyA.id,
      code: `tpl-${fx.suffix}`,
      title: "Đồng ý thủ thuật",
      body: "Nội dung bản 2 ĐÃ SỬA",
    });

    const stored = await db.consentRecord.findUniqueOrThrow({ where: { id: rec.id } });
    expect(stored.bodySnapshot).toBe("Nội dung bản 1");
    expect(stored.bodySnapshot).not.toContain("ĐÃ SỬA");
  });

  it("#91 thu hồi = REVOKED + reason, bản ghi VẪN CÒN", async () => {
    const c = await caseService.createMedicalCase(fx.doctorA.id, {
      companyId: fx.companyA.id,
      customerId: fx.customerA.id,
    });
    const rec = await consentService.createConsentRecord(fx.doctorA.id, {
      companyId: fx.companyA.id,
      medicalCaseId: c.id,
      title: "Đồng ý chụp ảnh",
      body: "Tôi đồng ý",
    });
    await consentService.signConsent(fx.doctorA.id, {
      companyId: fx.companyA.id,
      consentRecordId: rec.id,
      signedByCustomerId: fx.customerA.id,
    });
    await consentService.revokeConsent(fx.doctorA.id, {
      companyId: fx.companyA.id,
      consentRecordId: rec.id,
      reason: "Khách đổi ý",
    });

    // Legacy chỉ có cách XOÁ bản ghi — mất sạch bằng chứng đã từng đồng ý.
    const stored = await db.consentRecord.findUnique({ where: { id: rec.id } });
    expect(stored).not.toBeNull();
    expect(stored?.status).toBe("REVOKED");
    expect(stored?.revokeReason).toBe("Khách đổi ý");
    expect(stored?.signedAt).not.toBeNull();
  });
});

describe("Company Suspended chặn ghi lâm sàng (#98)", () => {
  it("Suspended: không tạo được Case mới", async () => {
    await db.company.update({ where: { id: fx.companyB.id }, data: { status: "SUSPENDED" } });
    await expect(
      caseService.createMedicalCase(fx.doctorB.id, {
        companyId: fx.companyB.id,
        customerId: fx.customerB.id,
      }),
    ).rejects.toThrow(AuthorizationError);
    await db.company.update({ where: { id: fx.companyB.id }, data: { status: "ACTIVE" } });
  });
});
