// Permission registry — nguồn duy nhất cho mọi permission key (Master Prompt
// Phần 3 mục XXXI-XXXIII). Không viết permission string tay rải rác nơi
// khác. Convention: "resource.action".
//
// Hai tier tách biệt, KHÔNG được trộn (đây chính là ranh giới đã bị vi phạm
// ở ZenithTasks — user.role === "ADMIN" cấp quyền xuyên mọi Company):
//   - EcosystemPermission: chỉ dùng trong Ecosystem scope, KHÔNG tự động cấp
//     quyền ghi vào một Company cụ thể.
//   - CompanyPermission: luôn đánh giá trong phạm vi MỘT Company cụ thể mà
//     actor có CompanyMembership ACTIVE.

export const ECOSYSTEM_PERMISSIONS = [
  "ecosystem.view",
  "ecosystem.manage",
  "ecosystem.membership.manage",
  "ecosystem.company.create",
  "ecosystem.company.lifecycle", // suspend / resume / archive
  "ecosystem.company.view_all", // aggregate read xuyên Company theo mục CIX
] as const;

export const COMPANY_PERMISSIONS = [
  "company.view",
  "company.manage",
  "company.members.view",
  "company.members.manage",
] as const;

export type EcosystemPermission = (typeof ECOSYSTEM_PERMISSIONS)[number];
export type CompanyPermission = (typeof COMPANY_PERMISSIONS)[number];
export type PermissionKey = EcosystemPermission | CompanyPermission;

// Chỉ Owner mới cấp/giữ vai trò OWNER cho người khác (không phải permission
// key riêng — đây là rule cấu trúc trên chính role preset, dùng chung bởi
// domain service (server, có hiệu lực thật) VÀ UI (chỉ để hiện/ẩn lựa chọn)
// để tránh 2 nơi định nghĩa lệch nhau — sửa sau red-team review Phần 3.
export function canGrantOwnerRole(actorRolePreset: string | undefined): boolean {
  return actorRolePreset === "OWNER";
}

// Reserved namespace cho domain tương lai (Part 4+) — CHỈ khai báo tên, KHÔNG
// implement check nào cho tới khi domain đó thực sự tồn tại (mục CCXXVI).
export const RESERVED_PERMISSION_PREFIXES = [
  "work.",
  "customer.",
  "finance.",
  "payroll.",
  "healthcare.",
] as const;
