// Nhãn tiếng Việt dùng chung cho các trang Work/Project — ngôn ngữ kinh
// doanh, không rò rỉ tên enum kỹ thuật ra UI (mục CXLIX Master Prompt).

export const WORK_STATUS_LABEL: Record<string, string> = {
  TODO: "Cần làm",
  IN_PROGRESS: "Đang làm",
  DONE: "Hoàn thành",
  CANCELLED: "Đã huỷ",
};

export const WORK_PRIORITY_LABEL: Record<string, string> = {
  LOW: "Thấp",
  NORMAL: "Bình thường",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  PLANNED: "Lên kế hoạch",
  ACTIVE: "Đang chạy",
  ON_HOLD: "Tạm hoãn",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã huỷ",
  ARCHIVED: "Lưu trữ",
};

// Phần 5 — CRM + Sales + Appointment
export const CUSTOMER_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Tạm ngưng",
  ARCHIVED: "Lưu trữ",
};

export const CUSTOMER_JOURNEY_STAGE_LABEL: Record<string, string> = {
  NEW: "Mới",
  CONTACTING: "Đang liên hệ",
  ENGAGED: "Đã kết nối",
  APPOINTED: "Đã có lịch hẹn",
  ACTIVE: "Đang giao dịch",
  FOLLOW_UP: "Cần theo dõi",
  INACTIVE: "Không hoạt động",
};

export const LEAD_STATUS_LABEL: Record<string, string> = {
  NEW: "Mới",
  CONTACTED: "Đã liên hệ",
  QUALIFIED: "Đủ điều kiện",
  CONVERTED: "Đã chuyển đổi",
  LOST: "Đã mất",
};

export const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Đã lên lịch",
  CONFIRMED: "Đã xác nhận",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã huỷ",
  NO_SHOW: "Không đến",
};

export const CUSTOMER_INTERACTION_TYPE_LABEL: Record<string, string> = {
  CALL: "Gọi điện",
  SMS: "SMS",
  CHAT: "Chat",
  MEETING: "Gặp trực tiếp",
  EMAIL: "Email",
  NOTE: "Ghi chú",
};

export const SALE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  CONFIRMED: "Đã xác nhận",
  CANCELLED: "Đã huỷ",
};

export const CATALOG_ITEM_TYPE_LABEL: Record<string, string> = {
  PRODUCT: "Sản phẩm",
  SERVICE: "Dịch vụ",
};

export function formatDueDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function formatDateTime(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatMoney(amount: number | string): string {
  return new Intl.NumberFormat("vi-VN").format(Number(amount)) + " ₫";
}
