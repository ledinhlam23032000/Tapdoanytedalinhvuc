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

// Phần 6 — Finance + Payroll + Commission + Inventory
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  CARD: "Thẻ",
  EWALLET: "Ví điện tử",
  OTHER: "Khác",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  POSTED: "Đã ghi nhận",
  VOID: "Đã huỷ",
};

export const EXPENSE_CATEGORY_LABEL: Record<string, string> = {
  RENT: "Thuê mặt bằng",
  MARKETING: "Marketing",
  SALARY: "Lương",
  SUPPLIES: "Vật tư",
  UTILITIES: "Điện nước",
  OTHER: "Khác",
};

export const EXPENSE_STATUS_LABEL: Record<string, string> = PAYMENT_STATUS_LABEL;

export const LEDGER_ENTRY_TYPE_LABEL: Record<string, string> = {
  SALE_RECEIPT: "Thu từ bán hàng",
  EXPENSE: "Chi phí",
  SALARY_PAYMENT: "Trả lương",
  REFUND: "Hoàn tiền",
  ADJUSTMENT: "Điều chỉnh",
  OTHER: "Khác",
};

export const PAYROLL_RUN_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  CALCULATED: "Đã tính",
  APPROVED: "Đã duyệt kiểm tra",
  FINALIZED: "Đã chốt sổ",
  VOIDED: "Đã huỷ",
};

export const COMMISSION_RULE_TYPE_LABEL: Record<string, string> = {
  PERCENTAGE_OF_SALE: "Phần trăm doanh thu",
  FIXED_PER_ITEM: "Cố định theo sản phẩm",
  TIERED_THRESHOLD: "Theo bậc doanh số",
};

export const COMMISSION_RULE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  ACTIVE: "Đang áp dụng",
  RETIRED: "Ngừng áp dụng",
};

export const INVENTORY_LOCATION_TYPE_LABEL: Record<string, string> = {
  WAREHOUSE: "Kho tổng",
  BRANCH: "Chi nhánh",
  STORAGE: "Kho phụ",
};

export const STOCK_MOVEMENT_TYPE_LABEL: Record<string, string> = {
  IN: "Nhập kho",
  OUT: "Xuất kho",
  ADJUSTMENT_IN: "Điều chỉnh tăng",
  ADJUSTMENT_OUT: "Điều chỉnh giảm",
  TRANSFER_IN: "Chuyển đến",
  TRANSFER_OUT: "Chuyển đi",
};

export const APPROVAL_REQUEST_STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ duyệt lần 1",
  PENDING_SECOND: "Chờ duyệt lần 2",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
  EXPIRED: "Hết hạn",
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

// ===== Phần 7 — Healthcare Vertical =====

export const MEDICAL_CASE_STATUS_LABEL: Record<string, string> = {
  OPEN: "Mới mở",
  IN_TREATMENT: "Đang điều trị",
  FOLLOW_UP: "Đang theo dõi",
  CLOSED: "Đã đóng",
  CANCELLED: "Đã huỷ",
};

export const MEDICAL_CASE_TYPE_LABEL: Record<string, string> = {
  CONSULTATION: "Tư vấn",
  TREATMENT: "Điều trị",
  AESTHETIC_PROCEDURE: "Thẩm mỹ",
  FOLLOW_UP: "Tái khám",
  OTHER: "Khác",
};

export const CLINICAL_RECORD_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  FINAL: "Đã chốt",
};

export const PROCEDURE_STATUS_LABEL: Record<string, string> = {
  PLANNED: "Đã lên lịch",
  READY: "Sẵn sàng",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Đã hoàn tất",
  CANCELLED: "Đã huỷ",
};

export const CONSENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  SIGNED: "Đã ký",
  REVOKED: "Đã rút lại",
  EXPIRED: "Hết hạn",
};

export const CONSENT_TYPE_LABEL: Record<string, string> = {
  PROCEDURE: "Đồng ý thủ thuật",
  ANESTHESIA: "Đồng ý gây tê/mê",
  PHOTO_USAGE: "Đồng ý dùng hình ảnh",
  DATA_PROCESSING: "Đồng ý xử lý dữ liệu",
  OTHER: "Khác",
};

export const CLINICAL_PHOTO_TYPE_LABEL: Record<string, string> = {
  BEFORE: "Trước",
  AFTER: "Sau",
  PROGRESS: "Tiến triển",
  CLINICAL_FINDING: "Phát hiện lâm sàng",
  OTHER: "Khác",
};

export const MEDICAL_FOLLOWUP_STATUS_LABEL: Record<string, string> = {
  PLANNED: "Đã lên lịch",
  DUE: "Đến hạn",
  DONE: "Hoàn tất",
  MISSED: "Bỏ lỡ",
  CANCELLED: "Đã huỷ",
};

/** answer NULLABLE — "Chưa ghi nhận" KHÁC "Không" (ADR-048). Không bao giờ
 *  gộp null vào nhánh NO khi hiển thị. */
export function screeningAnswerLabel(answer: "YES" | "NO" | null): string {
  if (answer === null) return "Chưa ghi nhận";
  return answer === "YES" ? "Có" : "Không";
}
