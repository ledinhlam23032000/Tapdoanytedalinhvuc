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
  // Phần 4 — Organization + Work Core + Project (mục XCVIII Master Prompt)
  "organization.view",
  "organization.manage",
  "people.view",
  "people.assign",
  "work.view",
  "work.create",
  "work.update",
  "work.assign",
  "work.complete",
  "work.manage",
  "project.view",
  "project.create",
  "project.manage",
  "project.archive",
  // Phần 5 — CRM + Sales + Appointment (mục LXXXIV/LXXXV Master Prompt:
  // "keep minimal, đừng tạo hàng trăm permission" — mỗi domain chỉ đủ
  // action thật cần, không tách quá vụn).
  "customer.view",
  "customer.create",
  "customer.update",
  "customer.archive",
  "customer.assign",
  "customer.interaction.create",
  "lead.view",
  "lead.create",
  "lead.assign",
  "lead.convert",
  "appointment.view",
  "appointment.create",
  "appointment.update",
  "appointment.manage",
  "sales.view",
  "sales.create",
  "sales.update",
  "sales.confirm",
  "sales.cancel",
  "catalog.view",
  "catalog.manage",
  // Phần 6 — Finance + Payroll + Commission + Inventory (HIGH/VERY HIGH
  // RISK — xem ADR-024..ADR-035). Vẫn giữ nguyên tắc "keep minimal": không
  // tách permission riêng cho từng bước Tính/Kiểm tra/Chốt payroll — rủi ro
  // cao hơn (Finalize) được gate thêm bằng ApprovalRequest 2 người
  // (ADR-029), không phải bằng permission key riêng.
  "finance.view",
  "finance.payment.create",
  "finance.payment.void",
  "finance.expense.create",
  "finance.expense.void",
  "finance.correction.create",
  "payroll.view",
  "payroll.manage",
  "commission.view",
  "commission.manage",
  "inventory.view",
  "inventory.receive",
  "inventory.issue",
  "inventory.transfer",
  "inventory.adjust",
  "inventory.manage",
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

// Reserved namespace cho domain tương lai (Part 7+) — CHỈ khai báo tên,
// KHÔNG implement check nào cho tới khi domain đó thực sự tồn tại (mục
// CCXXVI). "work." (Phần 4), "customer."/"lead."/"appointment."/"sales."/
// "catalog." (Phần 5), "finance."/"payroll."/"commission."/"inventory."
// (Phần 6) đã chuyển sang COMPANY_PERMISSIONS thật — bỏ khỏi reserved.
export const RESERVED_PERMISSION_PREFIXES = ["healthcare."] as const;
