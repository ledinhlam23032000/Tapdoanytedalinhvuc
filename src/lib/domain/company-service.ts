import { z } from "zod";
import { db } from "@/lib/db";
import {
  requireEcosystemContextForActor,
} from "@/lib/authorization/ecosystem-context";
import { requireCompanyContextForActor } from "@/lib/authorization/company-context";
import { AuthorizationError } from "@/lib/authorization/errors";
import { canGrantOwnerRole } from "@/lib/permissions/registry";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import type { CompanyRolePreset } from "@/generated/prisma";

// Domain service layer — logic thật (policy/transaction/audit), tách khỏi
// Server Action "use server" wrapper (src/lib/actions/company-actions.ts) để
// integration test có thể gọi trực tiếp với actorId giả lập, không cần giả
// lập cookie/HTTP request (mục LXXXIX Master Prompt Phần 2: domain service
// chỉ khi có logic thật — ở đây có transaction + policy + audit).

// ===== Company creation (mục XLIV-XLVII) =====

const createCompanySchema = z.object({
  ecosystemId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Mã công ty chỉ gồm chữ thường, số và dấu gạch ngang")
    .min(2)
    .max(40),
  type: z.enum(["GENERAL", "HEALTHCARE", "OTHER"]).default("GENERAL"),
  currency: z.string().trim().min(3).max(6).default("VND"),
  timezone: z.string().trim().min(3).max(60).default("Asia/Ho_Chi_Minh"),
});

export type CreateCompanyInput = z.input<typeof createCompanySchema>;

export async function createCompany(actorId: string, input: CreateCompanyInput) {
  const parsed = createCompanySchema.parse(input);
  const { actor, ecosystem } = await requireEcosystemContextForActor(
    actorId,
    parsed.ecosystemId,
    "ecosystem.company.create",
  );

  const existing = await db.company.findUnique({
    where: { ecosystemId_code: { ecosystemId: ecosystem.id, code: parsed.code } },
  });
  if (existing) {
    throw new Error("Mã công ty đã tồn tại trong hệ sinh thái này.");
  }

  return db.$transaction(async (tx) => {
    const created = await tx.company.create({
      data: {
        ecosystemId: ecosystem.id,
        code: parsed.code,
        name: parsed.name,
        type: parsed.type,
        currency: parsed.currency,
        timezone: parsed.timezone,
        status: "ACTIVE",
      },
    });

    // Người tạo trở thành OWNER ngay (mục XLV/XLVII) — transaction đảm bảo
    // không tồn tại Company "mồ côi" không ai quản lý được.
    await tx.companyMembership.create({
      data: {
        companyId: created.id,
        userId: actor.id,
        rolePreset: "OWNER",
        status: "ACTIVE",
      },
    });

    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.COMPANY_CREATED,
      targetType: "Company",
      targetId: created.id,
      ecosystemId: ecosystem.id,
      companyId: created.id,
      metadata: { name: created.name, code: created.code },
    });

    return created;
  });
}

// ===== Company lifecycle: suspend / resume / archive (mục LIV-LIX) =====
// Ecosystem-tier action — KHÔNG cần CompanyMembership trên Company đích,
// nhưng vẫn phải là actor có "ecosystem.company.lifecycle" trên đúng
// Ecosystem chứa Company đó (không phải bất kỳ Ecosystem nào).

async function requireCompanyForLifecycle(actorId: string, companyId: string) {
  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AuthorizationError();
  const { actor, ecosystem } = await requireEcosystemContextForActor(
    actorId,
    company.ecosystemId,
    "ecosystem.company.lifecycle",
  );
  return { actor, ecosystem, company };
}

export async function suspendCompany(actorId: string, companyId: string, reason?: string) {
  const { actor, ecosystem, company } = await requireCompanyForLifecycle(actorId, companyId);
  if (company.status !== "ACTIVE") {
    throw new Error("Chỉ công ty đang hoạt động mới có thể tạm dừng.");
  }
  await db.$transaction(async (tx) => {
    await tx.company.update({ where: { id: company.id }, data: { status: "SUSPENDED" } });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.COMPANY_SUSPENDED,
      targetType: "Company",
      targetId: company.id,
      ecosystemId: ecosystem.id,
      companyId: company.id,
      metadata: reason ? { reason: reason.slice(0, 500) } : undefined,
    });
  });
}

export async function resumeCompany(actorId: string, companyId: string) {
  const { actor, ecosystem, company } = await requireCompanyForLifecycle(actorId, companyId);
  if (company.status !== "SUSPENDED") {
    throw new Error("Chỉ công ty đang tạm dừng mới có thể tiếp tục hoạt động.");
  }
  await db.$transaction(async (tx) => {
    await tx.company.update({ where: { id: company.id }, data: { status: "ACTIVE" } });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.COMPANY_RESUMED,
      targetType: "Company",
      targetId: company.id,
      ecosystemId: ecosystem.id,
      companyId: company.id,
    });
  });
}

export async function archiveCompany(actorId: string, companyId: string) {
  const { actor, ecosystem, company } = await requireCompanyForLifecycle(actorId, companyId);
  if (company.status === "ARCHIVED") {
    throw new Error("Công ty đã được lưu trữ.");
  }
  await db.$transaction(async (tx) => {
    await tx.company.update({ where: { id: company.id }, data: { status: "ARCHIVED" } });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.COMPANY_ARCHIVED,
      targetType: "Company",
      targetId: company.id,
      ecosystemId: ecosystem.id,
      companyId: company.id,
    });
  });
}

// ===== Company membership management (mục XLVIII, LI, CLXX) =====

async function countActiveOwners(companyId: string): Promise<number> {
  return db.companyMembership.count({
    where: { companyId, rolePreset: "OWNER", status: "ACTIVE" },
  });
}

const addMemberSchema = z.object({
  companyId: z.string().min(1),
  email: z.string().trim().toLowerCase().email(),
  rolePreset: z.enum(["OWNER", "COMPANY_ADMIN", "MANAGER", "MEMBER", "VIEWER"]),
});

export async function addCompanyMember(actorId: string, input: z.input<typeof addMemberSchema>) {
  const parsed = addMemberSchema.parse(input);
  const { actor, company, membership } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "company.members.manage",
  );
  requireOwnerToGrantOwner(parsed.rolePreset, membership?.rolePreset);

  const targetUser = await db.user.findUnique({ where: { email: parsed.email } });
  if (!targetUser) {
    throw new Error("Không tìm thấy người dùng với email này. Người dùng cần được tạo tài khoản trước.");
  }

  const existing = await db.companyMembership.findUnique({
    where: { companyId_userId: { companyId: company.id, userId: targetUser.id } },
  });
  if (existing) {
    throw new Error("Người dùng này đã là thành viên công ty.");
  }

  await db.$transaction(async (tx) => {
    const created = await tx.companyMembership.create({
      data: {
        companyId: company.id,
        userId: targetUser.id,
        rolePreset: parsed.rolePreset,
        status: "ACTIVE",
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.COMPANY_MEMBER_ADDED,
      targetType: "CompanyMembership",
      targetId: created.id,
      companyId: company.id,
      metadata: { targetUserId: targetUser.id, rolePreset: parsed.rolePreset },
    });
  });
}

const updateMemberRoleSchema = z.object({
  companyId: z.string().min(1),
  membershipId: z.string().min(1),
  rolePreset: z.enum(["OWNER", "COMPANY_ADMIN", "MANAGER", "MEMBER", "VIEWER"]),
});

export async function updateCompanyMemberRole(
  actorId: string,
  input: z.input<typeof updateMemberRoleSchema>,
) {
  const parsed = updateMemberRoleSchema.parse(input);
  const { actor, company, membership: actorMembership } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "company.members.manage",
  );

  const target = await db.companyMembership.findUnique({ where: { id: parsed.membershipId } });
  if (!target || target.companyId !== company.id) throw new AuthorizationError();

  // Chống tự nâng quyền (mục CLXX) — không cho phép actor đổi role của
  // chính mình qua đường này, kể cả OWNER.
  if (target.userId === actor.id) {
    throw new Error("Không thể tự thay đổi vai trò của chính mình.");
  }

  requireOwnerToGrantOwner(parsed.rolePreset, actorMembership?.rolePreset);

  // Bảo vệ Owner cuối cùng (mục LI/LXXX): nếu target hiện là OWNER active
  // duy nhất và role mới không phải OWNER, chặn.
  if (target.rolePreset === "OWNER" && target.status === "ACTIVE" && parsed.rolePreset !== "OWNER") {
    const ownerCount = await countActiveOwners(company.id);
    if (ownerCount <= 1) {
      throw new Error("Không thể đổi vai trò của Chủ sở hữu cuối cùng. Hãy chuyển quyền sở hữu cho người khác trước.");
    }
  }

  await db.$transaction(async (tx) => {
    await tx.companyMembership.update({
      where: { id: target.id },
      data: { rolePreset: parsed.rolePreset },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.COMPANY_MEMBER_ROLE_CHANGED,
      targetType: "CompanyMembership",
      targetId: target.id,
      companyId: company.id,
      metadata: { from: target.rolePreset, to: parsed.rolePreset, targetUserId: target.userId },
    });
  });
}

export async function removeCompanyMember(actorId: string, companyId: string, membershipId: string) {
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, "company.members.manage");

  const target = await db.companyMembership.findUnique({ where: { id: membershipId } });
  if (!target || target.companyId !== company.id) throw new AuthorizationError();

  if (target.userId === actor.id) {
    throw new Error("Không thể tự xoá chính mình khỏi công ty.");
  }

  if (target.rolePreset === "OWNER" && target.status === "ACTIVE") {
    const ownerCount = await countActiveOwners(company.id);
    if (ownerCount <= 1) {
      throw new Error("Không thể xoá Chủ sở hữu cuối cùng. Hãy chuyển quyền sở hữu cho người khác trước.");
    }
  }

  await db.$transaction(async (tx) => {
    // Không hard-delete — giữ lịch sử audit (mục L), chỉ chuyển INACTIVE.
    await tx.companyMembership.update({ where: { id: target.id }, data: { status: "INACTIVE" } });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.COMPANY_MEMBER_REMOVED,
      targetType: "CompanyMembership",
      targetId: target.id,
      companyId: company.id,
      metadata: { targetUserId: target.userId },
    });
  });
}

/**
 * Chỉ actor đang là OWNER mới được cấp/giữ role OWNER cho người khác — tránh
 * COMPANY_ADMIN tự leo lên ngang Owner qua đường quản lý thành viên. Dùng
 * chung `canGrantOwnerRole` với UI (src/lib/permissions/registry.ts) để 2
 * nơi không định nghĩa lệch nhau. Quyết định ghi ở
 * docs/security/AUTHORIZATION_MODEL.md.
 */
function requireOwnerToGrantOwner(
  targetRole: CompanyRolePreset,
  actorRole: CompanyRolePreset | undefined,
) {
  if (targetRole === "OWNER" && !canGrantOwnerRole(actorRole)) {
    throw new AuthorizationError("Chỉ Chủ sở hữu mới có thể cấp quyền Chủ sở hữu cho người khác.");
  }
}
