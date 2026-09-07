import type { EcosystemRolePreset, CompanyRolePreset, PermissionPack } from "@/generated/prisma";
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

// Phần 6 bổ sung finance/payroll/commission/inventory permissions (HIGH/
// VERY HIGH RISK — ADR-024..ADR-035). Khác nguyên tắc "VIEWER thấy mọi
// .view key" đồng nhất của Phần 4/5: `payroll.view` KHÔNG cấp cho
// MEMBER/VIEWER — trả lời trực tiếp anti-drift Q12 của Master Prompt
// ("User bình thường có thấy payroll? NO unless permission") vì lương là
// dữ liệu nhạy cảm hơn hẳn Customer/Sales. `finance.correction.create` và
// `inventory.manage` (cấu trúc/surgical) chỉ OWNER/COMPANY_ADMIN — Void
// Payment/Expense vẫn để MANAGER (thao tác vận hành hằng ngày, không cần
// hai người duyệt theo ADR-029). Chỉ `payroll.manage`
// (Finalize)/`inventory.adjust` mới bắt buộc qua ApprovalRequest 2 người —
// permission ở đây chỉ quyết định AI được PHÉP khởi tạo hành động đó.
const OWNER_ADMIN_PART6: CompanyPermission[] = [
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
];

const MANAGER_PART6: CompanyPermission[] = [
  "finance.view",
  "finance.payment.create",
  "finance.payment.void",
  "finance.expense.create",
  "finance.expense.void",
  "payroll.view",
  "payroll.manage",
  "commission.view",
  "commission.manage",
  "inventory.view",
  "inventory.receive",
  "inventory.issue",
  "inventory.transfer",
  "inventory.adjust",
];

const MEMBER_PART6: CompanyPermission[] = [
  "finance.view",
  "finance.payment.create",
  "commission.view",
  "inventory.view",
  "inventory.receive",
  "inventory.issue",
];

const VIEWER_PART6: CompanyPermission[] = ["finance.view", "inventory.view"];


// ===== Phần 7 — Healthcare Vertical =====
// Preset role generic CHỈ mở phần quản trị module + xem. Mọi quyền lâm sàng
// thật (create/finalize/perform/consent/photo) đến từ PERMISSION PACK gắn
// theo từng CompanyMembership (ADR-051) — không phải từ rolePreset, vì
// "bác sĩ" không phải một tier quản lý.
const OWNER_ADMIN_PART7: CompanyPermission[] = [
  "healthcare.module.manage",
  "healthcare.case.view",
  "healthcare.template.manage",
];

const MANAGER_PART7: CompanyPermission[] = ["healthcare.case.view"];

// MEMBER/VIEWER KHÔNG mặc định thấy dữ liệu lâm sàng — cùng lý do payroll ở
// Phần 6, và bất biến #200: "Reception không được đọc toàn bộ clinical note
// chỉ vì tên role".
const MEMBER_PART7: CompanyPermission[] = [];
const VIEWER_PART7: CompanyPermission[] = [];

/** Pack theo vai trò chuyên môn (ADR-051). Gắn vào CompanyMembership, cộng
 *  dồn với quyền của rolePreset. Ràng buộc âm tính có test riêng:
 *   - RECEPTION KHÔNG có healthcare.consultation.view (#50)
 *   - NURSE KHÔNG có bất kỳ finance / payroll nào (#51)
 *   - DOCTOR KHÔNG có company.manage / company.members.manage (#52) */
export const PERMISSION_PACKS: Record<PermissionPack, CompanyPermission[]> = {
  HEALTHCARE_RECEPTION: [
    "healthcare.case.view",
    "healthcare.case.create",
    "healthcare.followup.view",
  ],
  HEALTHCARE_NURSE: [
    "healthcare.case.view",
    "healthcare.consultation.view",
    "healthcare.procedure.view",
    "healthcare.procedure.plan",
    "healthcare.consent.view",
    "healthcare.photo.view",
    "healthcare.photo.manage",
    "healthcare.followup.view",
    "healthcare.followup.manage",
  ],
  HEALTHCARE_DOCTOR: [
    "healthcare.case.view",
    "healthcare.case.create",
    "healthcare.case.update",
    "healthcare.case.close",
    "healthcare.consultation.view",
    "healthcare.consultation.create",
    "healthcare.consultation.finalize",
    "healthcare.procedure.view",
    "healthcare.procedure.plan",
    "healthcare.procedure.perform",
    "healthcare.consent.view",
    "healthcare.consent.manage",
    "healthcare.photo.view",
    "healthcare.photo.manage",
    "healthcare.followup.view",
    "healthcare.followup.manage",
  ],
  HEALTHCARE_CARE: [
    "healthcare.case.view",
    "healthcare.followup.view",
    "healthcare.followup.manage",
  ],
};

export const COMPANY_ROLE_PERMISSIONS: Record<CompanyRolePreset, CompanyPermission[]> = {
  OWNER: [
    "company.view",
    "company.manage",
    "company.members.view",
    "company.members.manage",
    ...OWNER_ADMIN_PART4,
    ...OWNER_ADMIN_PART5,
    ...OWNER_ADMIN_PART6,
    ...OWNER_ADMIN_PART7,
  ],
  COMPANY_ADMIN: [
    "company.view",
    "company.manage",
    "company.members.view",
    "company.members.manage",
    ...OWNER_ADMIN_PART4,
    ...OWNER_ADMIN_PART5,
    ...OWNER_ADMIN_PART6,
    ...OWNER_ADMIN_PART7,
  ],
  MANAGER: [
    "company.view",
    "company.members.view",
    ...MANAGER_PART4,
    ...MANAGER_PART5,
    ...MANAGER_PART6,
    ...MANAGER_PART7,
  ],
  MEMBER: ["company.view", ...MEMBER_PART4, ...MEMBER_PART5, ...MEMBER_PART6, ...MEMBER_PART7],
  VIEWER: ["company.view", ...VIEWER_PART4, ...VIEWER_PART5, ...VIEWER_PART6, ...VIEWER_PART7],
};
