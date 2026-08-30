// Standard shape cho authorization failure (Master Prompt mục CXIII) — không
// stack trace, không chi tiết nội bộ cho user. Server Action bắt lỗi này và
// hiển thị thông báo chung; page loader dùng notFound() thay vì throw lỗi
// này (xem ecosystem-context.ts / company-context.ts).
export class AuthorizationError extends Error {
  constructor(message = "Bạn không có quyền thực hiện thao tác này.") {
    super(message);
    this.name = "AuthorizationError";
  }
}
