# CRM (Phần 5 — tổng quan)

Phần 5 KHÔNG phải "xây một CRM nhiều màn hình". Mục tiêu (mục I Master
Prompt): cho một Company nhìn thấy đủ — khách này đang ở giai đoạn nào, có
lịch hẹn gì, ai đang phụ trách, đã mua gì, và bước tiếp theo là gì — qua
đúng chuỗi domain: `Lead` (nếu có) → `Customer` → `CustomerInteraction`
(chăm sóc) → `Appointment` (lịch hẹn) → `Sale` (giao dịch) → follow-up →
Work Core / Today. Chi tiết từng domain: `CUSTOMER.md`, `LEAD.md`,
`APPOINTMENT.md`, `SALES.md`.

## Ownership

Mọi entity Phần 5 (`CustomerSource`, `Lead`, `Customer`,
`CustomerInteraction`, `Appointment`, `CatalogItem`, `Sale`, `SaleLine`)
thuộc `Company` — không thuộc `Project` (mục III). `Sale`/`Appointment` có
thể attribution thêm vào `OrganizationUnit`/`Project` (optional), giống hệt
pattern `WorkItem` đã có từ Phần 4 — không phải ranh giới sở hữu mới.

## Visibility — khác WorkItem (ADR-022)

`WorkItem` (Phần 4, ADR-015) tự-scope theo actor (MEMBER chỉ thấy việc của
mình). CRM/Appointment/Sales **không** dùng lại pattern đó — bất kỳ ai có
đúng `.view` permission thấy **toàn bộ** Company (mục CLVI: "owner không tự
định nghĩa ranh giới bảo mật"). `ownerUserId`/`assignedUserId`/
`salespersonUserId` là dữ liệu thuộc tính, không phải access control. Xem
ADR-022 để biết lý do nghiệp vụ (lễ tân cần trả lời điện thoại cho bất kỳ
khách nào gọi tới).

## Không có trong Phần 5 (đã kiểm tra bằng chứng, không phải bỏ sót)

- `SalesOpportunity` — không có bằng chứng legacy, mục XXXIX đánh dấu
  optional (ADR-019).
- Customer Merge — không đủ bằng chứng khối lượng duplicate (ADR-020).
- Rule engine chiết khấu/hoa hồng (`ZMechanismDefinition`-style) — engine
  legacy chưa từng chạy thật, không port (ADR-021).
- Bulk Import/SMS, Marketing Automation, Campaign Engine, Email Marketing,
  Omnichannel Chat, Zalo OA, Call Center, Loyalty/Point/Voucher, Advanced
  Price Book, B2B Account Hierarchy, Universal Party Model, Custom Field
  Builder, Dynamic Schema, Sales Workflow DSL, AI Lead Scoring/Forecast/
  Message Generation — tất cả đánh dấu "Defer"/"KHÔNG" tường minh trong
  Master Prompt (mục CCI-CCXXI). Không xây trước khi có Company thật cần.
- Payment/Debt/Commission/Payroll/Invoice/Tax/Inventory deduction/Healthcare
  record — thuộc Phần 6/7, `Sale` chỉ giữ dữ liệu attribution cho các Phần
  đó dùng sau, không tự triển khai.

## Work Core integration

`WorkItem` (Phần 4) được mở rộng thêm 2 field attribution optional:
`customerId`, `appointmentId` — KHÔNG tạo engine việc thứ hai cho CRM
(ADR-014 vẫn áp dụng). No-show Appointment tạo follow-up Work qua đúng
`createWorkItem()` đã có, có kiểm tra idempotent
(`hasOpenWorkItemForAppointment`) để không spam khi xử lý lại cùng 1 sự
kiện (mục CLXXXV).

## Audit

Danh sách đóng — không audit từng thay đổi field (mục CXX/CXXI):
`CUSTOMER_CREATED/UPDATED/OWNER_CHANGED/ARCHIVED`, `LEAD_CREATED/CONVERTED`,
`APPOINTMENT_CREATED/RESCHEDULED/COMPLETED/CANCELLED/NO_SHOW`,
`SALE_CREATED/CONFIRMED/UPDATED/CANCELLED`,
`CATALOG_ITEM_CREATED/UPDATED`. `CustomerInteraction` tự nó là business
record, không duplicate vào audit (mục CXXII).
