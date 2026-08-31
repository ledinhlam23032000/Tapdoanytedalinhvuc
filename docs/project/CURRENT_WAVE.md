# Current Wave

**Phần 5 — CRM + Sales + Appointment + Customer Operations: HOÀN TẤT.**
Implementation thật: Prisma schema (`CustomerSource`/`Lead`/`Customer`/
`CustomerInteraction`/`Appointment`/`CatalogItem`/`Sale`/`SaleLine`, +
`WorkItem` mở rộng), 4 domain service mới + Server Action wrapper, UI
(`Khách hàng`/`Lead`/`Lịch hẹn`/`Kinh doanh`/`Danh mục`), 99 integration
test PASS, adversarial code review 3 agent PASS (2 P1 tìm thấy và đã vá:
tính tiền sai + PII over-fetch), 1 bug Decimal/Server-Action phát hiện qua
browser test và đã vá, 3 browser journey thật (Reception/Sales, Sales
transaction, Follow-up No-show) — xem `docs/checkpoints/LATEST.md`.

**Tiếp theo: Phần 6 — Finance + Payroll + Commission + Inventory.**

Trước khi bắt đầu Phần 6, đọc đúng đoạn tương ứng trong
`MASTER PROMPT — TAPDOANYTEDALINHVUC.docx` (dùng
`pandoc -t markdown "MASTER PROMPT — TAPDOANYTEDALINHVUC.docx" -o master_prompt.md`
rồi `grep -n "PART 6\|PHẦN 7"` để định vị range — không đọc lại toàn bộ file
docx, chỉ đoạn Phần 6).

## Input đã sẵn sàng cho Phần 6

- `Sale` (Phần 5, trạng thái CONFIRMED) là điểm neo tự nhiên cho
  Invoice/Payment/Debt — DB dev hiện có sẵn ít nhất 1 Sale CONFIRMED thật
  (Trần Thị Mai, 500.000đ) để test ngay không cần seed lại.
- **Bài học Decimal quan trọng nhất từ Phần 5** — Prisma `Decimal` KHÔNG
  serialize được qua Server Action → Client Component boundary (React RSC
  chỉ nhận plain object). Phần 6 (Finance/Payroll) có RẤT NHIỀU field tiền
  — mọi Server Action mới phải tự kiểm tra ngay từ đầu, không đợi tới
  browser-test mới phát hiện như Phần 5 đã bị.
- `src/lib/domain/sale-totals.ts` — pattern "module tính tiền thuần,
  DB-free, unit-test riêng, service gọi thẳng hàm đã test thay vì viết lại
  công thức tay" đã chứng minh đúng (P1 tiền Phần 5 chính là do vi phạm
  pattern này) — Phần 6 (Payroll/Commission tính lương/hoa hồng) nên theo
  đúng pattern.
- `src/lib/domain/scope-guards.ts` — tiếp tục dùng cho
  Invoice/Payment/Debt/Payroll/Commission/Inventory thay vì viết lại logic
  assert cross-company riêng.
- ADR-022 (Company-wide visibility theo permission `.view`, không self-scope
  theo owner) — cân nhắc áp dụng tương tự cho Finance/Payroll trừ khi có lý
  do nghiệp vụ thật để self-scope (vd: Payroll cá nhân nên tự nhiên
  self-scope theo employee, cần ADR riêng chốt rõ trước khi code).
- `docs/architecture/LEGACY_TO_TARGET_MAP.md` dòng Invoice/Payment/Debt/
  Payroll/Commission/Inventory tương ứng — đã có Decision từ Phần 2, Phần 6
  chỉ build theo đúng Decision đã chốt, không quyết định lại trừ khi
  evidence mới buộc phải revisit.
- `src/lib/permissions/registry.ts` — `RESERVED_PERMISSION_PREFIXES` còn
  `finance.`/`payroll.` — bỏ khỏi reserved khi Phần 6 thêm permission thật.

## Việc CHƯA làm ở Phần 5 (đúng phạm vi, không phải thiếu sót)

Finance/Payroll/Commission/Inventory/Healthcare — mới có ở
`DATA_OWNERSHIP.md`/`DOMAIN_MODEL.md` conceptual, CHƯA có trong
`prisma/schema.prisma`. Sales Opportunity/Pipeline, Customer Merge, rule
engine chiết khấu — cố tình không tạo (ADR-019/020/021, chưa có bằng chứng
nghiệp vụ thật cần). `updateDraftSale` chưa có UI caller — domain function
có sẵn, chờ nhu cầu thật (vd sửa Sale nháp nhiều dòng cùng lúc thay vì tạo
lại).
