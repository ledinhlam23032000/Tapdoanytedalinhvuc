# Appointment (Phần 5)

`Appointment` là năng lực **generic** cấp Company — KHÔNG mặc định là lịch
khám y tế (mục XLII). Ví dụ dùng ngoài y tế: tư vấn, demo, khảo sát, gặp
khách, dịch vụ. Không có field lâm sàng nào trên model này — Healthcare
Vertical (Phần 7) mở rộng qua context/relation riêng
(`MedicalAppointmentContext`, chưa xây ở Phần 5), KHÔNG thêm field y tế
thẳng vào `Appointment` (mục LV).

## Customer optional (ADR-018)

`customerId` nullable — Company có thể dùng Appointment cho mục đích nội
bộ (họp, demo nội bộ) không gắn khách hàng cụ thể.

## Assignee — chỉ User + OrganizationUnit optional (mục XLV-XLVI)

Không xây resource booking phức tạp (phòng/thiết bị — mục XLVII, DEFER).
`assignedUserId` là User đơn, optional. Bác sĩ (Phần 7) tái dùng
`assignedUserId` + context y tế, KHÔNG có `DoctorAppointment` engine riêng.

## Status

`SCHEDULED → CONFIRMED → COMPLETED`, hoặc `→ CANCELLED`/`→ NO_SHOW` từ
SCHEDULED/CONFIRMED. Reschedule chỉ đổi `startAt`/`endAt` + audit
(`APPOINTMENT_RESCHEDULED`) — KHÔNG tạo bản ghi Appointment thứ 2 (mục
XLIX).

## Conflict check — đơn giản, không tối ưu tài nguyên (mục LII)

`src/lib/domain/appointment-conflict.ts` — so overlap 2 khoảng thời gian
cho cùng `assignedUserId`, dùng thời lượng mặc định 30 phút khi thiếu
`endAt` (chỉ để so sánh, không lưu DB). Không xây resource-conflict
optimization engine.

## Quyền hành động 1-1

`appointment.update` + (chính `assignedUserId`/`createdByUserId` HOẶC có
`appointment.manage`) — cùng pattern `canActOnWorkItem` của Work Core Phần
4, áp dụng riêng cho Appointment (không dùng chung hàm, vì 2 model khác
nhau — xem `canActOnAppointment` trong `appointment-service.ts`).

## Visibility (ADR-022)

`appointment.view` = toàn bộ Company, KHÔNG lọc theo `assignedUserId`.
Riêng `getMyAppointmentsToday()` **CÓ** tự-scope theo actor — đây là view
"của tôi hôm nay" có chủ đích (mục CVII), khác với danh sách chung.

## No-show → Work Core (mục L/LVII/CLXXXIV/CLXXXV)

`markNoShow()` audit `APPOINTMENT_NO_SHOW` rồi gọi `createWorkItem()` (Phần
4) với `appointmentId` attribution — kiểm tra
`hasOpenWorkItemForAppointment()` trước để idempotent (không tạo trùng khi
xử lý lại cùng 1 sự kiện). KHÔNG tự động convert MỌI Appointment thành
WorkItem (mục CIX) — chỉ No-show mới sinh follow-up.

## Rule engine — KHÔNG (mục LVIII-LIX)

Follow-up rule là code xác định (deterministic), không phải AI, không phải
rule engine tổng quát. Chỉ 2 rule cụ thể: No-show → follow-up Work; lịch
hẹn ngày mai → tín hiệu Today.
