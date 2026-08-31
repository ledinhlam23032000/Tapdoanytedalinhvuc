# Red-team Code Review — Phần 5 (CRM + Lead + Appointment + Sales/Catalog)

Cùng khuôn mẫu Phần 4 (`RED_TEAM_CODE_REVIEW_PART4.md`), mở rộng thành **3
agent độc lập** (thay vì 2) do phạm vi Phần 5 lớn hơn — CRM/Lead/Appointment/
Sales là 4 domain mới, và có thêm rủi ro đặc thù (tiền, PII) không có ở
Phần 4:

1. **Tenant-isolation attacker** — cố vượt Company boundary.
2. **Simplicity/spec-fidelity reviewer** — đối chiếu ADR-017→023 với code
   thật, tìm over-engineering hoặc thiếu bám spec.
3. **Money/PII integrity reviewer** (mới) — riêng cho tính đúng của phép
   tính tiền Sale và bảo vệ SĐT mã hoá, 2 rủi ro không tồn tại ở Phần 4.

**Kết quả sau khi sửa: PASS** (0 P0, 0 P1 còn mở). Trước khi sửa: 2 P1 thật
(1 lỗi tính tiền, 1 lỗi over-fetch PII) + nhiều P2.

## Agent 1 — Tenant isolation (8 câu hỏi)

| # | Câu hỏi | Kết luận |
|---|---|---|
| 1 | Cross-company ID injection trên mọi FK (Lead/Customer/Interaction/Appointment/Sale/SaleLine) | NONE — mọi FK có `assertSameCompany*` tường minh |
| 2 | `convertLead` (dedup/reuse/create Customer, tạo WorkItem sau transaction) | NONE — dedup scope đúng company, WorkItem tạo đúng companyId |
| 3 | WorkItem mở rộng (`customerId`/`appointmentId`) có leak cross-company | NONE — `createWorkItem` validate cả 2 FK; `getOpenWorkForCustomer`/`hasOpenWorkItemForAppointment` lọc `companyId` ngay trong WHERE |
| 4 | Money/business-logic tampering (status transitions, negative total) | NONE cho lỗ hổng nghiêm trọng — xem Agent 3 cho bug tính toán thật (không phải tenant-isolation) |
| 5 | Phone PII trong audit metadata / phoneHash reversibility | NONE cho audit; **P2** cho over-fetch (trùng phát hiện Agent 3, xem dưới) |
| 6 | Suspended-Company write gating (không lặp lại P1 Phần 4) | NONE — không hàm ghi nào Phần 5 gate bằng permission `.view` |
| 7 | Server Action / UI layer trust client actorId/companyId | NONE — mọi action dùng `requireCurrentActor()`, mọi companyId re-validate server-side |
| 8 | Đường nào khác cho Company A đọc/ghi Company B | NONE |

Ghi nhận thêm (P2, không khai thác được): permission `sales.manage` không
được check ở đâu trong `sales-service.ts` (đã sửa — xem bên dưới); vài gap
coverage test cho `WorkItem.customerId/appointmentId`/`organizationUnitId`
cross-company (đã sửa — xem bên dưới).

## Agent 2 — Simplicity / spec-fidelity (11 câu hỏi)

Toàn bộ 11 mục đều **NONE** — Lead là entity thật tách biệt (ADR-017),
Customer optional trên Appointment/Sale ở mọi tầng schema+domain+UI
(ADR-018), zero SalesOpportunity (ADR-019), zero Customer Merge (ADR-020),
discountAmount là số phẳng không rule engine (ADR-021), ADR-022
(Company-wide visibility, khác hẳn self-scope của WorkItem Phần 4) đúng ở
cả domain service lẫn UI, mã hoá SĐT không kèm reveal-audit (ADR-023),
không raw enum lộ UI, navigation budget giữ đúng (Lead/Catalog không có
nav-item riêng). 2 P2: `assertSameCompanySale` định nghĩa cục bộ thay vì
trong `scope-guards.ts` (đã sửa); `updateDraftSale` không có UI caller mà
chưa ghi rõ đây là chủ đích (đã sửa — thêm ghi chú trong SALES.md).

## Agent 3 — Money & PII integrity (12 câu hỏi) — tìm ra 2 P1 thật

**P1 #1 — Sale.totalAmount có thể lệch với sum(SaleLine.lineTotal).**
`calculateSaleTotals` (cũ) cộng dồn `discountAmount` THÔ của từng dòng rồi
mới clamp MỘT LẦN ở cấp Sale, trong khi `buildLineTotals` (viết tay, không
gọi `calculateLineTotal` đã unit-test) clamp RIÊNG từng dòng. Khi 1 dòng có
chiết khấu vượt chính giá trị dòng đó (lỗi nhập liệu hoàn toàn hợp lý, không
phải tấn công), `Sale.totalAmount` bị lưu sai và `confirmSale` đóng băng
vĩnh viễn con số sai đó. Agent 3 verify bằng số cụ thể (60.000đ vs
100.000đ thật). **Đã sửa**: viết lại `calculateSaleTotals` để tính
`discountAmount` = phần chiết khấu ĐÃ THỰC SỰ ÁP DỤNG (`gross - lineTotal`
của chính dòng đó) thay vì số đề nghị thô — bất biến
`subtotalAmount - discountAmount === totalAmount === sum(lineTotal)` giờ
đúng bằng cấu trúc, không phụ thuộc dữ liệu. Đồng thời sửa
`buildLineTotals` trong `sales-service.ts` gọi thẳng `calculateLineTotal`
đã unit-test thay vì viết lại công thức tay (nguồn gốc thật của lệch số).
Test hồi quy: `sale-totals.test.ts` — 2 test mới assert bất biến này với
input ngẫu nhiên và với chính case đã phát hiện bug.

**P1 #2 — `phoneCiphertext`/`phoneHash` bị over-fetch ra khỏi tầng service
ở mọi list/detail query không phải Customer/Lead detail.**
`getCustomerList`, `getLeadList` (không `select`/`omit`) và
`getAppointmentList`/`getMyAppointmentsToday`/`getAppointmentDetail`/
`getSaleList`/`getSaleDetail` (nested `include: { customer: true }`) đều
kéo theo `phoneCiphertext`+`phoneHash` vào object trả về, dù không hàm nào
trong số đó decrypt hay render — vi phạm invariant "chỉ `getCustomerDetail`/
`getLeadDetail` được chạm 2 field này". Agent 3 xác nhận **chưa** leak ra
browser thật (không Client Component nào nhận object đầy đủ), nhưng
`phoneHash` là SHA-256 không salt trên keyspace nhỏ (SĐT VN ~10⁹ khả năng)
— gần như tương đương lộ SĐT thật nếu rò rỉ dù chỉ 1 lần (export CSV, API
route tương lai, `console.log` debug). **Đã sửa**: dùng Prisma `omit`
(`{ phoneCiphertext: true, phoneHash: true }`) ở cả 2 query top-level và
nested `include: { customer: {...} }` trong toàn bộ 6 hàm liên quan.

## Đã sửa sau review (tổng hợp)

1. **P1 Money** — `sale-totals.ts` tính lại `calculateSaleTotals`;
   `sales-service.ts` `buildLineTotals` gọi `calculateLineTotal` thay vì
   công thức tay; thêm `.max(100_000)`/`.max(1_000_000_000)` cho
   `quantity`/`unitPrice`/`discountAmount` (P2 liên quan — chặn số cực đoan
   gây sai số double, dù biên độ VNĐ thật không chạm ngưỡng này).
2. **P1 PII** — `omit: { phoneCiphertext, phoneHash }` ở `getCustomerList`,
   `getLeadList`, và 6 chỗ `include: { customer: {...} }` trong
   `appointment-service.ts`/`sales-service.ts`.
3. **P2** — gỡ permission chết `sales.manage` khỏi `registry.ts`/
   `presets.ts` (Sale không có `canActOnX`-theo-ownership để override, khác
   Appointment/WorkItem — ADR-022 đã bỏ self-scope nên MANAGER+ vốn đã ghi
   được mọi Sale).
4. **P2** — chuyển `assertSameCompanySale` từ `sales-service.ts` vào
   `scope-guards.ts` cho nhất quán với 5 guard Phần 5 khác.
5. **P2** — bỏ prop `code` không dùng trong `create-appointment-form.tsx`.
6. **P2** — ghi rõ trong `docs/domain/SALES.md`: `updateDraftSale` cố ý
   chưa có UI ở Phần 5 (không phải bỏ sót).
7. **P2** — `customers/[customerId]/page.tsx` và
   `customers/leads/[leadId]/page.tsx`: phân biệt `AuthorizationError` (ca
   bình thường, 404 im lặng đúng chủ đích) với lỗi khác (vd `decryptPhone`
   thất bại do ciphertext hỏng — log `console.error` trước khi 404, tránh
   nuốt hoàn toàn im lặng một sự cố toàn vẹn dữ liệu thật).
8. **P2 test coverage** — thêm test cross-company cho
   `organizationUnitId` trên Customer/Appointment/Sale, và test
   `WorkItem.customerId`/`appointmentId` cross-company trực tiếp trên
   `createWorkItem`/`getOpenWorkForCustomer` trong
   `tenant-isolation-part5.itest.ts` (93 → 99 test).

## Không sửa (chấp nhận, ghi lại lý do)

- Agent 3 P2: không có `try/catch` riêng quanh từng lời gọi `decryptPhone`
  bên trong `getCustomerDetail`/`getLeadDetail` — chấp nhận vì lỗi vẫn được
  page-level catch xử lý đúng (404 + giờ đã log, xem mục 7 ở trên); thêm 1
  lớp try/catch nữa ở domain service là dư thừa.
