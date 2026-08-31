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

// Phần 4 bổ sung organization/people/work/project permissions (mục XCVIII).
// MANAGER có people.assign/work.assign/project.create nhưng KHÔNG có
// organization.manage/work.manage/project.manage/project.archive — những
// quyền "quản trị cấu trúc" đó giữ ở OWNER/COMPANY_ADMIN, đúng nguyên tắc
// "không hard-code Manager = Owner" (mục XXVIII).
const OWNER_ADMIN_PART4: CompanyPermission[] = [
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
];

const MANAGER_PART4: CompanyPermission[] = [
  "organization.view",
  "people.view",
  "people.assign",
  "work.view",
  "work.create",
  "work.update",
  "work.assign",
  "work.complete",
  "project.view",
  "project.create",
];

const MEMBER_PART4: CompanyPermission[] = [
  "organization.view",
  "people.view",
  "work.view",
  "work.create",
  "work.update",
  "work.complete",
  "project.view",
];

const VIEWER_PART4: CompanyPermission[] = ["organization.view", "people.view", "work.view", "project.view"];

// Phần 5 bổ sung customer/lead/appointment/sales/catalog permissions (mục
// LXXXIV/LXXXV: "keep minimal"). Cùng nguyên tắc Phần 4: quyền "quản trị/
// override toàn Company" (appointment.manage/catalog.manage) giữ ở OWNER/
// COMPANY_ADMIN; MANAGER vận hành rộng (thấy + tạo + sửa + customer.assign —
// mục XCVII bắt buộc Manager mới đổi được owner của Customer); MEMBER vận
// hành hẹp (dữ liệu/việc liên quan chính mình, KHÔNG có customer.archive/
// customer.assign/lead.assign/sales.cancel — huỷ 1 Sale đã confirm là hành
// động rủi ro cao hơn, mục CCXLIV/CCXLV). KHÔNG có "sales.manage" — khác
// Appointment/WorkItem, Sale không có canActOnX theo ownership (ADR-022:
// company-wide, không self-scope) nên không có gì để 1 quyền "override" cần
// vượt qua — sales.update/confirm/cancel đã áp dụng cho MỌI Sale trong
// Company rồi (red-team review Phần 5 phát hiện đây là permission chết,
// đã gỡ thay vì giữ lại "phòng khi cần").
const OWNER_ADMIN_PART5: CompanyPermission[] = [
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
];

const MANAGER_PART5: CompanyPermission[] = [
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
  "sales.view",
  "sales.create",
  "sales.update",
  "sales.confirm",
  "sales.cancel",
  "catalog.view",
];

const MEMBER_PART5: CompanyPermission[] = [
  "customer.view",
  "customer.create",
  "customer.update",
  "customer.interaction.create",
  "lead.view",
  "lead.create",
  "lead.convert",
  "appointment.view",
  "appointment.create",
  "appointment.update",
  "sales.view",
  "sales.create",
  "sales.update",
  "sales.confirm",
  "catalog.view",
];

const VIEWER_PART5: CompanyPermission[] = [
  "customer.view",
  "lead.view",
  "appointment.view",
  "sales.view",
  "catalog.view",
];

export const COMPANY_ROLE_PERMISSIONS: Record<CompanyRolePreset, CompanyPermission[]> = {
  OWNER: [
    "company.view",
    "company.manage",
    "company.members.view",
    "company.members.manage",
    ...OWNER_ADMIN_PART4,
    ...OWNER_ADMIN_PART5,
  ],
  COMPANY_ADMIN: [
    "company.view",
    "company.manage",
    "company.members.view",
    "company.members.manage",
    ...OWNER_ADMIN_PART4,
    ...OWNER_ADMIN_PART5,
  ],
  MANAGER: ["company.view", "company.members.view", ...MANAGER_PART4, ...MANAGER_PART5],
  MEMBER: ["company.view", ...MEMBER_PART4, ...MEMBER_PART5],
  VIEWER: ["company.view", ...VIEWER_PART4, ...VIEWER_PART5],
};
