import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyContextForActor } from "@/lib/authorization/company-context";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import {
  assertSameCompanyMedicalCase,
  assertSameCompanyProcedure,
  assertSameCompanyCatalogItem,
  assertSameCompanyOrganizationUnit,
  assertSameCompanyInventoryItem,
  assertSameCompanyInventoryLocation,
} from "@/lib/domain/scope-guards";
import { assertHealthcareModuleEnabled } from "@/lib/domain/healthcare/module-service";
import { issueStockTx, reverseStockIssueTx } from "@/lib/domain/inventory-service";
import { countUnrecordedRequiredScreening } from "@/lib/domain/healthcare/consultation-service";
import {
  evaluateProcedureReadiness,
  DEFAULT_PROCEDURE_POLICY,
  CONSULTATION_ONLY_POLICY,
  type ProcedureReadiness,
} from "@/lib/domain/healthcare/procedure-readiness";

// Domain service — Procedure + ProcedureMaterialUsage (Phần 7).
//
// File này có 3 ràng buộc khó nhất của Phần 7:
//  1. Readiness tính bằng hàm THUẦN, không viết lại logic ở đây (ADR-044).
//  2. Hoàn tất thủ thuật KHÔNG được báo thành công nếu trừ kho bắt buộc thất
//     bại (mục CCCLXV) -> mọi thứ nằm trong CÙNG một transaction.
//  3. Trừ kho idempotent, gọi lại lần 2 là no-op (ADR-043, bất biến #39 —
//     spec đánh dấu "Critical").

/** Prefix namespace cho idempotencyKey do SERVER sinh.
 *  Vì sao có prefix: cột `StockMovement.idempotencyKey` dùng CHUNG constraint
 *  với key client tự đặt ở receive/issue/transfer. Phần 6 đã bị đúng lỗi này —
 *  `executeApprovedStockAdjustment` dùng bare `request.id` nên một actor quyền
 *  thấp hơn có thể "chiếm" key trước để chặn vĩnh viễn một điều chỉnh hợp lệ
 *  (sabotage namespace-collision, tìm ra qua adversarial review). */
const MATERIAL_KEY_PREFIX = "procmat:";
const MATERIAL_REVERSAL_KEY_PREFIX = "procmat-rev:";

const planProcedureSchema = z.object({
  companyId: z.string().min(1),
  medicalCaseId: z.string().min(1),
  catalogItemId: z.string().min(1).optional(),
  saleLineId: z.string().min(1).optional(),
  procedureType: z.string().trim().min(1).max(100).optional(),
  primaryClinicianUserId: z.string().min(1).optional(),
  organizationUnitId: z.string().min(1).optional(),
  scheduledAt: z.coerce.date().optional(),
  clinicalNotes: z.string().trim().max(5000).optional(),
});

export async function planProcedure(actorId: string, input: z.input<typeof planProcedureSchema>) {
  const parsed = planProcedureSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.procedure.plan",
  );
  await assertHealthcareModuleEnabled(company.id);
  const medicalCase = await assertSameCompanyMedicalCase(company.id, parsed.medicalCaseId);

  if (medicalCase.status === "CLOSED" || medicalCase.status === "CANCELLED") {
    throw new Error("Hồ sơ đã kết thúc — không lên lịch thủ thuật mới được.");
  }
  if (parsed.catalogItemId) await assertSameCompanyCatalogItem(company.id, parsed.catalogItemId);
  if (parsed.organizationUnitId) await assertSameCompanyOrganizationUnit(company.id, parsed.organizationUnitId);

  // ADR-050: saleLineId là OPTIONAL và không ràng buộc 1-1. Một Sale có thể
  // có N Procedure; một thủ thuật có thể chưa gắn giao dịch nào (bất biến #48:
  // tạo và hoàn tất được thủ thuật trên khách chưa từng có Sale).
  if (parsed.saleLineId) {
    const line = await db.saleLine.findUnique({
      where: { id: parsed.saleLineId },
      include: { sale: { select: { companyId: true } } },
    });
    if (!line || line.sale.companyId !== company.id) {
      throw new Error("Dòng giao dịch không hợp lệ trong công ty này.");
    }
  }

  return db.$transaction(async (tx) => {
    const record = await tx.procedure.create({
      data: {
        companyId: company.id,
        medicalCaseId: medicalCase.id,
        catalogItemId: parsed.catalogItemId,
        saleLineId: parsed.saleLineId,
        procedureType: parsed.procedureType,
        primaryClinicianUserId: parsed.primaryClinicianUserId,
        organizationUnitId: parsed.organizationUnitId,
        scheduledAt: parsed.scheduledAt,
        clinicalNotes: parsed.clinicalNotes,
        createdByUserId: actor.id,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.PROCEDURE_PLANNED,
      targetType: "Procedure",
      targetId: record.id,
      companyId: company.id,
      metadata: { medicalCaseId: medicalCase.id, procedureType: parsed.procedureType },
    });
    return { id: record.id };
  });
}

/** Dịch vụ chỉ tư vấn dùng policy lỏng hơn (mục CVI) — nếu bắt buộc consent
 *  và screening cho mọi loại thì sẽ chặn nhầm chính luồng phổ biến nhất. */
function policyFor(procedureType: string | null): typeof DEFAULT_PROCEDURE_POLICY {
  if (procedureType && /consult|tư vấn|tu van/i.test(procedureType)) return CONSULTATION_ONLY_POLICY;
  return DEFAULT_PROCEDURE_POLICY;
}

/**
 * Đọc dữ liệu rồi giao cho hàm THUẦN quyết định (ADR-044). Không có nhánh
 * logic readiness nào viết lại ở đây, và không có đường nào cho LLM tham gia
 * (mục CX-CXI: AI không authorize thủ thuật).
 */
export async function getProcedureReadiness(
  actorId: string,
  companyId: string,
  procedureId: string,
): Promise<ProcedureReadiness> {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "healthcare.procedure.view");
  await assertHealthcareModuleEnabled(company.id);
  const procedure = await assertSameCompanyProcedure(company.id, procedureId);
  return computeReadiness(company.id, procedure);
}

async function computeReadiness(
  companyId: string,
  procedure: { id: string; medicalCaseId: string; status: string; primaryClinicianUserId: string | null; procedureType: string | null },
): Promise<ProcedureReadiness> {
  const medicalCase = await db.medicalCase.findUniqueOrThrow({
    where: { id: procedure.medicalCaseId },
    select: { status: true },
  });

  const now = new Date();
  const signedConsent = await db.consentRecord.findFirst({
    where: {
      companyId,
      medicalCaseId: procedure.medicalCaseId,
      status: "SIGNED",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true },
  });

  const finalConsultation = await db.clinicalConsultation.findFirst({
    where: { companyId, medicalCaseId: procedure.medicalCaseId, status: "FINAL" },
    select: { id: true },
  });

  const unrecorded = await countUnrecordedRequiredScreening(companyId, procedure.medicalCaseId);

  return evaluateProcedureReadiness(
    {
      caseStatus: medicalCase.status as "OPEN" | "IN_TREATMENT" | "FOLLOW_UP" | "CLOSED" | "CANCELLED",
      procedureStatus: procedure.status as "PLANNED" | "READY" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
      hasPrimaryClinician: procedure.primaryClinicianUserId !== null,
      hasValidSignedConsent: signedConsent !== null,
      hasFinalizedConsultation: finalConsultation !== null,
      unrecordedRequiredScreeningCount: unrecorded,
    },
    policyFor(procedure.procedureType),
  );
}

const procedureIdSchema = z.object({
  companyId: z.string().min(1),
  procedureId: z.string().min(1),
});

export async function startProcedure(actorId: string, input: z.input<typeof procedureIdSchema>) {
  const parsed = procedureIdSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.procedure.perform",
  );
  await assertHealthcareModuleEnabled(company.id);
  const procedure = await assertSameCompanyProcedure(company.id, parsed.procedureId);

  if (procedure.status !== "PLANNED" && procedure.status !== "READY") {
    throw new Error("Chỉ bắt đầu được thủ thuật đang ở trạng thái lên lịch.");
  }

  // Bất biến #24/#168: không chuyển IN_PROGRESS khi chưa đủ điều kiện, và lý
  // do phải liệt kê rõ ràng cho người dùng chứ không phải "thao tác thất bại".
  const readiness = await computeReadiness(company.id, procedure);
  if (!readiness.ready) {
    throw new Error(`Chưa đủ điều kiện thực hiện: ${readiness.reasons.join(" ")}`);
  }

  return db.$transaction(async (tx) => {
    const record = await tx.procedure.update({
      where: { id: procedure.id },
      data: { status: "IN_PROGRESS" },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.PROCEDURE_STARTED,
      targetType: "Procedure",
      targetId: record.id,
      companyId: company.id,
    });
    return { id: record.id };
  });
}

const materialInputSchema = z.object({
  inventoryItemId: z.string().min(1),
  inventoryLocationId: z.string().min(1),
  quantity: z.number().positive(),
});

const completeProcedureSchema = z.object({
  companyId: z.string().min(1),
  procedureId: z.string().min(1),
  performedAt: z.coerce.date().optional(),
  clinicalNotes: z.string().trim().max(5000).optional(),
  /** Vật tư tiêu hao BẮT BUỘC trừ kho cùng lúc hoàn tất. Nếu trừ kho hỏng thì
   *  toàn bộ hoàn tất bị rollback — không bao giờ báo thành công nửa vời. */
  materials: z.array(materialInputSchema).optional(),
});

/**
 * Mục CCCLXIII-CCCLXV — orchestration: ghi Procedure + trừ kho nằm trong CÙNG
 * một transaction. Nếu `issueStockTx` ném lỗi (vd không đủ tồn kho) thì
 * `procedure.status` KHÔNG chuyển sang COMPLETED. Đây là yêu cầu tường minh
 * của spec: "Procedure completion should not claim success if material issue
 * is required".
 *
 * Gọi lần 2 (bất biến #94, mục CLIX): bị TỪ CHỐI ở tầng trạng thái. Ngay cả
 * khi ai đó lách được, `issueStockTx` vẫn idempotent theo key server-derived
 * nên tồn kho không bị trừ hai lần — hai lớp bảo vệ độc lập.
 */
export async function completeProcedure(actorId: string, input: z.input<typeof completeProcedureSchema>) {
  const parsed = completeProcedureSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.procedure.perform",
  );
  await assertHealthcareModuleEnabled(company.id);
  const procedure = await assertSameCompanyProcedure(company.id, parsed.procedureId);

  for (const m of parsed.materials ?? []) {
    // Bất biến #56: vật tư phải cùng Company với thủ thuật.
    await assertSameCompanyInventoryItem(company.id, m.inventoryItemId);
    await assertSameCompanyInventoryLocation(company.id, m.inventoryLocationId);
  }

  return db.$transaction(async (tx) => {
    // Khoá + đọc lại trong transaction — hai lần bấm "Hoàn tất" đồng thời đều
    // đọc status IN_PROGRESS ở ngoài rồi cùng ghi (cùng lớp lỗi với 4 P0 Phần 6).
    await tx.$queryRaw`SELECT id FROM "Procedure" WHERE id = ${procedure.id} FOR UPDATE`;
    const fresh = await tx.procedure.findUniqueOrThrow({ where: { id: procedure.id } });

    if (fresh.status === "COMPLETED") {
      throw new Error("Thủ thuật này đã được hoàn tất trước đó.");
    }
    if (fresh.status !== "IN_PROGRESS") {
      throw new Error("Chỉ hoàn tất được thủ thuật đang thực hiện.");
    }

    for (const m of parsed.materials ?? []) {
      const usage = await tx.procedureMaterialUsage.create({
        data: {
          companyId: company.id,
          procedureId: fresh.id,
          inventoryItemId: m.inventoryItemId,
          inventoryLocationId: m.inventoryLocationId,
          quantity: m.quantity,
          recordedByUserId: actor.id,
        },
      });

      // Key do SERVER sinh từ id vừa tạo — client không tham gia (ADR-043).
      const movement = await issueStockTx(tx, {
        companyId: company.id,
        inventoryItemId: m.inventoryItemId,
        locationId: m.inventoryLocationId,
        quantity: m.quantity,
        reason: `Vật tư thủ thuật ${fresh.id}`,
        sourceType: "PROCEDURE_MATERIAL_USAGE",
        sourceId: usage.id,
        idempotencyKey: `${MATERIAL_KEY_PREFIX}${usage.id}`,
        actorUserId: actor.id,
      });

      await tx.procedureMaterialUsage.update({
        where: { id: usage.id },
        data: { stockMovementId: movement.id },
      });

      await recordAudit(tx, {
        actorUserId: actor.id,
        action: AUDIT_ACTIONS.PROCEDURE_MATERIAL_RECORDED,
        targetType: "ProcedureMaterialUsage",
        targetId: usage.id,
        companyId: company.id,
        metadata: { procedureId: fresh.id, stockMovementId: movement.id },
      });
    }

    const record = await tx.procedure.update({
      where: { id: fresh.id },
      data: {
        status: "COMPLETED",
        performedAt: parsed.performedAt ?? new Date(),
        completedByUserId: actor.id,
        clinicalNotes: parsed.clinicalNotes ?? fresh.clinicalNotes,
      },
    });

    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.PROCEDURE_COMPLETED,
      targetType: "Procedure",
      targetId: record.id,
      companyId: company.id,
      metadata: { materialCount: parsed.materials?.length ?? 0 },
    });

    return { id: record.id };
  });
}

const cancelSchema = z.object({
  companyId: z.string().min(1),
  procedureId: z.string().min(1),
  reason: z.string().trim().min(1).max(2000),
});

export async function cancelProcedure(actorId: string, input: z.input<typeof cancelSchema>) {
  const parsed = cancelSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.procedure.plan",
  );
  await assertHealthcareModuleEnabled(company.id);
  const procedure = await assertSameCompanyProcedure(company.id, parsed.procedureId);

  // Đã hoàn tất thì không huỷ — sai sót sau khi thực hiện xử lý bằng
  // reversal vật tư + addendum lâm sàng, không phải bằng cách xoá trạng thái.
  if (procedure.status === "COMPLETED") {
    throw new Error("Thủ thuật đã hoàn tất — không huỷ được. Dùng hoàn trả vật tư nếu ghi nhầm.");
  }
  if (procedure.status === "CANCELLED") {
    throw new Error("Thủ thuật này đã bị huỷ trước đó.");
  }

  return db.$transaction(async (tx) => {
    const record = await tx.procedure.update({
      where: { id: procedure.id },
      data: { status: "CANCELLED", clinicalNotes: procedure.clinicalNotes },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.PROCEDURE_CANCELLED,
      targetType: "Procedure",
      targetId: record.id,
      companyId: company.id,
      metadata: { reason: parsed.reason },
    });
    return { id: record.id };
  });
}

const reverseMaterialSchema = z.object({
  companyId: z.string().min(1),
  usageId: z.string().min(1),
  reason: z.string().trim().min(1).max(2000),
});

/**
 * Bất biến #44/#96 — sửa sai vật tư CHỈ qua reversal có kiểm soát + audit.
 * Không xoá cứng bản ghi đã trừ kho, và tồn kho được hoàn đúng bằng một
 * movement ngược (không sửa movement cũ — StockMovement là sổ bất biến).
 */
export async function reverseProcedureMaterial(actorId: string, input: z.input<typeof reverseMaterialSchema>) {
  const parsed = reverseMaterialSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.procedure.perform",
  );
  await assertHealthcareModuleEnabled(company.id);

  const usage = await db.procedureMaterialUsage.findUnique({ where: { id: parsed.usageId } });
  if (!usage || usage.companyId !== company.id) {
    throw new Error("Bản ghi vật tư không hợp lệ trong công ty này.");
  }
  if (usage.status === "REVERSED") {
    throw new Error("Bản ghi vật tư này đã được hoàn trả trước đó.");
  }

  return db.$transaction(async (tx) => {
    await reverseStockIssueTx(tx, {
      companyId: company.id,
      inventoryItemId: usage.inventoryItemId,
      locationId: usage.inventoryLocationId,
      quantity: Number(usage.quantity),
      reason: parsed.reason,
      sourceType: "PROCEDURE_MATERIAL_USAGE",
      sourceId: usage.id,
      idempotencyKey: `${MATERIAL_REVERSAL_KEY_PREFIX}${usage.id}`,
      actorUserId: actor.id,
    });

    const record = await tx.procedureMaterialUsage.update({
      where: { id: usage.id },
      data: { status: "REVERSED", reversalReason: parsed.reason },
    });

    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.PROCEDURE_MATERIAL_REVERSED,
      targetType: "ProcedureMaterialUsage",
      targetId: record.id,
      companyId: company.id,
      metadata: { reason: parsed.reason },
    });

    return { id: record.id };
  });
}

// ===== Read =====

export async function getProcedureList(actorId: string, companyId: string, medicalCaseId?: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "healthcare.procedure.view");
  await assertHealthcareModuleEnabled(company.id);
  if (medicalCaseId) await assertSameCompanyMedicalCase(company.id, medicalCaseId);

  return db.procedure.findMany({
    where: { companyId: company.id, medicalCaseId },
    include: { primaryClinician: { omit: { passwordHash: true } }, catalogItem: true },
    orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
}

export async function getProcedureDetail(actorId: string, companyId: string, procedureId: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "healthcare.procedure.view");
  await assertHealthcareModuleEnabled(company.id);
  await assertSameCompanyProcedure(company.id, procedureId);

  return db.procedure.findUnique({
    where: { id: procedureId },
    include: {
      primaryClinician: { omit: { passwordHash: true } },
      completedBy: { omit: { passwordHash: true } },
      catalogItem: true,
      materialUsages: {
        include: { inventoryItem: true, inventoryLocation: true },
        orderBy: { recordedAt: "asc" },
      },
    },
  });
}
