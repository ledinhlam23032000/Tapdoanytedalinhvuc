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

export function formatDueDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}
