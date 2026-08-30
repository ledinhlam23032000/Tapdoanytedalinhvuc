import type { EcosystemRolePreset, CompanyRolePreset } from "@/generated/prisma";
import type { EcosystemPermission, CompanyPermission } from "@/lib/permissions/registry";

// Role preset = named permission package (Master Prompt mục XVI/XXV/XXXIV).
// Static, versioned qua code — KHÔNG cần role builder UI ở Phần 3. Không có
// nhánh nào ở đây tương đương `role === "ADMIN" → return true`: mỗi preset
// liệt kê tường minh permission của chính nó, không có preset nào ngầm định
// "có tất cả".

export const ECOSYSTEM_ROLE_PERMISSIONS: Record<EcosystemRolePreset, EcosystemPermission[]> = {
  FOUNDER: [
    "ecosystem.view",
    "ecosystem.manage",
    "ecosystem.membership.manage",
    "ecosystem.company.create",
    "ecosystem.company.lifecycle",
    "ecosystem.company.view_all",
  ],
  ECOSYSTEM_ADMIN: [
    "ecosystem.view",
    "ecosystem.manage",
    "ecosystem.company.create",
    "ecosystem.company.lifecycle",
    "ecosystem.company.view_all",
    // Cố ý KHÔNG có "ecosystem.membership.manage" — ECOSYSTEM_ADMIN không tự
    // cấp/thu hồi quyền FOUNDER hay ECOSYSTEM_ADMIN khác (chống privilege
    // escalation, xem TENANT_INVARIANTS.md).
  ],
  AUDITOR: ["ecosystem.view", "ecosystem.company.view_all"],
  VIEWER: ["ecosystem.view"],
};

export const COMPANY_ROLE_PERMISSIONS: Record<CompanyRolePreset, CompanyPermission[]> = {
  OWNER: ["company.view", "company.manage", "company.members.view", "company.members.manage"],
  COMPANY_ADMIN: ["company.view", "company.manage", "company.members.view", "company.members.manage"],
  MANAGER: ["company.view", "company.members.view"],
  MEMBER: ["company.view"],
  VIEWER: ["company.view"],
};
