import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyContextForActor } from "@/lib/authorization/company-context";
import { AuthorizationError } from "@/lib/authorization/errors";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import type { CompanyModuleType } from "@/generated/prisma";

/**
 * ADR-047 — bật/tắt module theo từng Company qua bảng `CompanyModule`.
 *
 * Bất biến #59/#87: Company chưa bật module thì CẢ navigation LẪN direct
 * route đều bị từ chối — nên `assertHealthcareModuleEnabled` phải được gọi ở
 * MỌI domain service healthcare, không chỉ ở tầng UI.
 *
 * Bất biến #60/#61: bật/tắt module KHÔNG đổi kiến trúc tenant và KHÔNG có
 * nhánh code nào đổi cấu trúc model theo `Company.type`. `CompanyType.HEALTHCARE`
 * chỉ là GỢI Ý lúc tạo Company, không tự cấp quyền gì.
 */

/**
 * Chặn mọi thao tác healthcare khi Company chưa bật module.
 * Gọi NGAY SAU `requireCompanyContextForActor` trong từng domain service —
 * đây là cổng thứ hai, độc lập với permission: có quyền `healthcare.*` mà
 * Company chưa bật module thì vẫn phải bị từ chối.
 */
export async function assertHealthcareModuleEnabled(companyId: string) {
  const record = await db.companyModule.findUnique({
    where: { companyId_module: { companyId, module: "HEALTHCARE" } },
  });
  if (!record || record.disabledAt !== null) {
    throw new AuthorizationError("Công ty này chưa bật phân hệ Y tế.");
  }
  return record;
}

/** Đọc trạng thái module — dùng cho nav/UI, không ném lỗi. */
export async function isHealthcareModuleEnabled(companyId: string): Promise<boolean> {
  const record = await db.companyModule.findUnique({
    where: { companyId_module: { companyId, module: "HEALTHCARE" } },
  });
  return Boolean(record && record.disabledAt === null);
}

export async function getEnabledModules(companyId: string): Promise<CompanyModuleType[]> {
  const records = await db.companyModule.findMany({
    where: { companyId, disabledAt: null },
    orderBy: { enabledAt: "asc" },
  });
  return records.map((r) => r.module);
}

const setModuleSchema = z.object({
  companyId: z.string().min(1),
  module: z.enum(["HEALTHCARE"]),
});

export async function enableCompanyModule(actorId: string, input: z.input<typeof setModuleSchema>) {
  const parsed = setModuleSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.module.manage",
  );

  return db.$transaction(async (tx) => {
    // upsert: bật lại module đã tắt = xoá disabledAt, KHÔNG tạo dòng thứ hai
    // (@@unique([companyId, module]) đảm bảo điều đó ở tầng DB).
    const record = await tx.companyModule.upsert({
      where: { companyId_module: { companyId: company.id, module: parsed.module } },
      create: {
        companyId: company.id,
        module: parsed.module,
        enabledByUserId: actor.id,
      },
      update: { disabledAt: null, enabledByUserId: actor.id, enabledAt: new Date() },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.COMPANY_MODULE_ENABLED,
      targetType: "CompanyModule",
      targetId: record.id,
      companyId: company.id,
      metadata: { module: parsed.module },
    });
    return { id: record.id };
  });
}

export async function disableCompanyModule(actorId: string, input: z.input<typeof setModuleSchema>) {
  const parsed = setModuleSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.module.manage",
  );

  return db.$transaction(async (tx) => {
    const existing = await tx.companyModule.findUnique({
      where: { companyId_module: { companyId: company.id, module: parsed.module } },
    });
    if (!existing || existing.disabledAt !== null) {
      throw new AuthorizationError("Phân hệ này chưa được bật.");
    }
    // Tắt module KHÔNG xoá dữ liệu lâm sàng đã có — chỉ chặn truy cập mới.
    // Xoá dữ liệu y tế là hành động khác hẳn, không nằm trong phạm vi tắt module.
    const record = await tx.companyModule.update({
      where: { id: existing.id },
      data: { disabledAt: new Date() },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.COMPANY_MODULE_DISABLED,
      targetType: "CompanyModule",
      targetId: record.id,
      companyId: company.id,
      metadata: { module: parsed.module },
    });
    return { id: record.id };
  });
}

// ===== Permission pack (ADR-051) =====

const packSchema = z.object({
  companyId: z.string().min(1),
  userId: z.string().min(1),
  pack: z.enum(["HEALTHCARE_RECEPTION", "HEALTHCARE_NURSE", "HEALTHCARE_DOCTOR", "HEALTHCARE_CARE"]),
});

/** Gắn pack chuyên môn cho một thành viên. Pack chỉ CỘNG THÊM quyền. */
export async function grantPermissionPack(actorId: string, input: z.input<typeof packSchema>) {
  const parsed = packSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "company.members.manage",
  );

  const membership = await db.companyMembership.findUnique({
    where: { companyId_userId: { companyId: company.id, userId: parsed.userId } },
  });
  // Bất biến #58: chỉ gắn được cho người ĐÃ có CompanyMembership trên đúng
  // Company này — pack không tự sinh membership và không cấp quyền vượt.
  if (!membership || membership.status !== "ACTIVE") {
    throw new AuthorizationError("Người dùng không phải thành viên đang hoạt động của công ty này.");
  }

  return db.$transaction(async (tx) => {
    const record = await tx.companyMembershipPack.upsert({
      where: { membershipId_pack: { membershipId: membership.id, pack: parsed.pack } },
      create: { membershipId: membership.id, pack: parsed.pack, grantedByUserId: actor.id },
      update: { grantedByUserId: actor.id, grantedAt: new Date() },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.PERMISSION_PACK_GRANTED,
      targetType: "CompanyMembershipPack",
      targetId: record.id,
      companyId: company.id,
      metadata: { userId: parsed.userId, pack: parsed.pack },
    });
    return { id: record.id };
  });
}

export async function revokePermissionPack(actorId: string, input: z.input<typeof packSchema>) {
  const parsed = packSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "company.members.manage",
  );

  const membership = await db.companyMembership.findUnique({
    where: { companyId_userId: { companyId: company.id, userId: parsed.userId } },
  });
  if (!membership) {
    throw new AuthorizationError("Người dùng không phải thành viên của công ty này.");
  }

  return db.$transaction(async (tx) => {
    const existing = await tx.companyMembershipPack.findUnique({
      where: { membershipId_pack: { membershipId: membership.id, pack: parsed.pack } },
    });
    if (!existing) throw new AuthorizationError("Thành viên chưa được gắn gói quyền này.");
    await tx.companyMembershipPack.delete({ where: { id: existing.id } });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.PERMISSION_PACK_REVOKED,
      targetType: "CompanyMembershipPack",
      targetId: existing.id,
      companyId: company.id,
      metadata: { userId: parsed.userId, pack: parsed.pack },
    });
  });
}

export async function getMemberPermissionPacks(actorId: string, companyId: string, userId: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "company.members.view");
  const membership = await db.companyMembership.findUnique({
    where: { companyId_userId: { companyId: company.id, userId } },
    include: { permissionPacks: { orderBy: { grantedAt: "asc" } } },
  });
  return membership?.permissionPacks ?? [];
}
