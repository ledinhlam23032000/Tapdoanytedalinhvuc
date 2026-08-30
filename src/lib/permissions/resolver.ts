import { db } from "@/lib/db";
import { ECOSYSTEM_ROLE_PERMISSIONS, COMPANY_ROLE_PERMISSIONS } from "@/lib/permissions/presets";
import type { EcosystemPermission, CompanyPermission } from "@/lib/permissions/registry";

// Authorization resolver — nguồn canonical DUY NHẤT để hỏi "actor này được
// làm gì trong scope nào?" (Master Prompt mục XXXVII). Không nơi nào khác
// trong app được viết `if (membership.rolePreset === "OWNER") ...` trực
// tiếp — luôn đi qua đây.
//
// Nguyên tắc bắt buộc: DEFAULT DENY (mục LXXXIII) + FAIL CLOSED (mục
// LXXXIV) — không membership hợp lệ => không quyền, không có nhánh fallback
// "authenticated => allow".

export async function resolveEcosystemPermissions(
  userId: string,
  ecosystemId: string,
): Promise<Set<EcosystemPermission>> {
  const membership = await db.ecosystemMembership.findUnique({
    where: { ecosystemId_userId: { ecosystemId, userId } },
  });
  if (!membership || membership.status !== "ACTIVE") return new Set();
  return new Set(ECOSYSTEM_ROLE_PERMISSIONS[membership.rolePreset]);
}

export async function resolveCompanyPermissions(
  userId: string,
  companyId: string,
): Promise<Set<CompanyPermission>> {
  const membership = await db.companyMembership.findUnique({
    where: { companyId_userId: { companyId, userId } },
  });
  if (!membership || membership.status !== "ACTIVE") return new Set();
  return new Set(COMPANY_ROLE_PERMISSIONS[membership.rolePreset]);
}

export async function hasEcosystemPermission(
  userId: string,
  ecosystemId: string,
  permission: EcosystemPermission,
): Promise<boolean> {
  const perms = await resolveEcosystemPermissions(userId, ecosystemId);
  return perms.has(permission);
}

export async function hasCompanyPermission(
  userId: string,
  companyId: string,
  permission: CompanyPermission,
): Promise<boolean> {
  const perms = await resolveCompanyPermissions(userId, companyId);
  return perms.has(permission);
}
