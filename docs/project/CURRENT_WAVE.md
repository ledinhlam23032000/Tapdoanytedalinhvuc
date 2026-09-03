# Current Wave

**Phần 6 — Finance + Payroll + Commission + Inventory: HOÀN TẤT.**
Implementation thật: Prisma schema 12 model mới (`Payment`/`Expense`/
`LedgerEntry`/`PayrollProfile`/`PayrollRun`/`PayrollItem`/`ApprovalRequest`/
`CommissionRule`/`CommissionCalculation`/`InventoryLocation`/
`InventoryItem`/`StockMovement`, 4 migration), 3 module tính thuần +
`approval-service.ts` + 4 domain service, Server Action wrapper, UI
(`Tài chính`/`Lương`/`Tồn kho` + profiles/commission-rules/adjustments),
133 integration test PASS, adversarial code review **5 agent** (4 P0 thật
tìm thấy và đã vá — đều cùng root cause class: thiếu `SELECT...FOR UPDATE`
cho check-then-write trên tiền/kho), 2 lớp bug thật phát hiện ngoài review
(browser-test + re-verify test trước checkpoint), 3 browser journey thật
(Finance/Payment, Payroll two-person-approval, Inventory two-person-approval)
— xem `docs/checkpoints/LATEST.md`.

**Tiếp theo: Phần 7 — Healthcare Vertical + Legacy Clinic Parity.**

Trước khi bắt đầu Phần 7, đọc đúng đoạn tương ứng trong
`MASTER PROMPT — TAPDOANYTEDALINHVUC.docx` (dùng
`pandoc -t markdown "MASTER PROMPT — TAPDOANYTEDALINHVUC.docx" -o master_prompt.md`
rồi `grep -n "PART 7\|PHẦN 8"` để định vị range — không đọc lại toàn bộ file
docx, chỉ đoạn Phần 7).

## Input đã sẵn sàng cho Phần 7

- `Appointment` (Phần 5) là điểm neo tự nhiên cho MedicalCase/Consultation —
  DB dev hiện có sẵn Appointment thật (Trần Thị Mai) để test ngay không cần
  seed lại.
- `Customer` + mã hoá SĐT AES-256-GCM (ADR-023, Phần 5) — dữ liệu y tế nhạy
  cảm HƠN PII SĐT, cần quyết định tường minh (ADR mới) về mã hoá/at-rest cho
  `ClinicalPhoto`/`MedicalCase` TRƯỚC khi code, không mặc định "giống
  Customer là đủ".
- `ApprovalRequest` (Phần 6, ADR-028) — primitive 2-người-duyệt DÙNG CHUNG
  đã chứng minh chạy đúng trên 2 domain độc lập (Payroll + Inventory,
  live-verify qua browser cả hai). Phần 7 nếu cần duyệt 2 người (vd xoá hồ
  sơ y tế, sửa chẩn đoán đã chốt) thì DÙNG LẠI, không tạo model duyệt thứ 2.
- `RESERVED_PERMISSION_PREFIXES` giờ CHỈ còn `"healthcare."` — bỏ khỏi
  reserved khi Phần 7 thêm permission thật (cùng pattern đã làm với
  `customer.` ở Phần 5, `finance.`/`payroll.` ở Phần 6).
- `InventoryItem`/`StockMovement` (Phần 6) — vật tư y tế tiêu hao trong 1 ca
  điều trị nên trừ kho qua đúng `issueStock()` đã có, KHÔNG tạo engine kho
  thứ 2 cho Healthcare (cùng tinh thần ADR-014 với WorkItem).
- `Sale`/`CommissionCalculation` (Phần 5/6) — dịch vụ y tế đã bán + hoa hồng
  bác sĩ/tư vấn viên đi qua đúng đường Sale→Commission đã có, không tạo
  đường tiền riêng cho Healthcare.
- **Bài học concurrency quan trọng nhất từ Phần 6** — mọi hàm domain có
  pattern "đọc số dư/kiểm tra hợp lệ → ghi" PHẢI khoá dòng bằng
  `SELECT...FOR UPDATE` trong `db.$transaction` (Postgres READ COMMITTED
  không tự chặn). Phần 7 có slot lịch khám/giường/phòng — cùng class rủi ro,
  áp dụng ngay từ đầu, không đợi review tìm ra như Phần 6.
- **Bài học ngày/timezone từ Phần 6** — mọi so sánh/truncate ngày hiệu lực
  dùng `getUTC*`/`Date.UTC`, không dùng giờ địa phương.

## Việc CHƯA làm ở Phần 6 (đúng phạm vi, không phải thiếu sót)

Healthcare (MedicalCase/Consultation/Procedure/Consent/ClinicalPhoto/
MedicalFollowUp) — mới có ở `DATA_OWNERSHIP.md`/`DOMAIN_MODEL.md`
conceptual, CHƯA có trong `prisma/schema.prisma`. Invoice/hoá đơn điện tử,
AccountsPayable, đa tiền tệ, kế toán kép, định giá tồn kho FIFO/LIFO,
barcode/serial/lot, Purchase Order/Supplier — cố tình không tạo
(ADR-033/035 + `docs/domain/INVENTORY.md`, chưa có bằng chứng nghiệp vụ thật
cần). DB-level trigger chống UPDATE/DELETE trên `LedgerEntry`/
`StockMovement`/`AuditEvent` — bất biến hiện chỉ ở tầng application, ghi
nhận là rủi ro mở (xem `LATEST.md` mục SECURITY RISKS).
