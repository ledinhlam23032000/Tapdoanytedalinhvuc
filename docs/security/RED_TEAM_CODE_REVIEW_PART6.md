# Red-team Code Review — Phần 6 (Finance + Payment + Receivable + Ledger + Payroll + Commission + Inventory)

Cùng khuôn mẫu Phần 4/5, mở rộng thành **5 agent độc lập** (thay vì 3) —
Phần 6 là domain HIGH RISK / VERY HIGH RISK (tiền, lương, tồn kho), có 2
loại rủi ro không tồn tại ở các Phần trước: cơ chế two-person-approval mới
xây (ApprovalRequest) và mật độ ghi tiền/số lượng đồng thời cao hơn hẳn
(Payment/PayrollRun/CommissionCalculation/StockMovement).

1. **Tenant-isolation attacker** — cố vượt Company boundary.
2. **Simplicity/spec-fidelity reviewer** — đối chiếu ADR-024→035 với code
   thật.
3. **Money/PII integrity reviewer** — tính đúng phép tính tiền, PII
   Customer, Decimal boundary (cùng phạm vi đã cứu Phần 5).
4. **Two-person approval integrity reviewer** (mới) — riêng cho
   `ApprovalRequest`, cơ chế duyệt 2 người mới xây, rủi ro nếu sai thì
   Payroll finalize/Inventory adjustment mất hẳn ý nghĩa "cần 2 người".
5. **Idempotency/concurrency reviewer** (mới) — riêng cho double-posting/
   race condition dưới tải đồng thời thật (Postgres READ COMMITTED mặc
   định), rủi ro không tồn tại rõ rệt ở quy mô Phần 4/5.

**Kết quả sau khi sửa: PASS.** Trước khi sửa: **4 P0 thật** (2 race
condition tiền/lương, 1 công thức lương viết tay sai, 1 lỗi làm tròn hoa
hồng), **2 P1 thật** (thiếu guard thành viên công ty cho contributor hoa
hồng, race condition tạo trùng CommissionCalculation), và nhiều P2.

## Agent 1 — Tenant isolation

Toàn bộ FK actor-supplied đã kiểm tra qua `assertSameCompanyXxx` — PASS ở
mọi hàm, **trừ 1 finding P1 thật**: `calculateCommissionForSale` ghi thẳng
`contributors[].userId` vào `CommissionCalculation.userId` mà KHÔNG gọi
`assertActiveCompanyMember` — actor có `commission.manage` có thể gán hoa
hồng cho bất kỳ `userId` nào tồn tại trong hệ thống (kể cả người ngoài
Company). **Đã sửa**: thêm `assertActiveCompanyMember` cho từng contributor
trước khi tính toán.

Phát hiện thêm (P2, defense-in-depth): 5 vị trí `include: { user: true }`/
`requestedBy: true`/`firstApprovedByUser: true` (payroll-service.ts,
commission-service.ts, approval-service.ts ×2, inventory-service.ts) kéo
theo `User.passwordHash` vào object server-side không cần thiết — chưa leak
ra client ở bất kỳ trang nào (đã kiểm từng page.tsx tiêu thụ), nhưng vi
phạm quy ước "không trả thẳng object Prisma dư thừa". **Đã sửa**: thêm
`omit: { passwordHash: true }` ở cả 5 vị trí.

## Agent 2 — Simplicity / spec-fidelity

11/12 ADR (024-033, 035) đạt PASS ngay từ đầu — không over-engineering
(không rule engine tổng quát, không cost/valuation, không AccountsPayable/
Invoice), không under-building so với quyết định đã chốt. **ADR-034
(idempotency) FAIL lúc đầu**: `idempotencyKey` có unique constraint đúng ở
schema nhưng KHÔNG được UI/action nào thực sự generate cho
`recordPayment`/`receiveStock`/`issueStock`/`transferStock` — double-submit
thật sự không bị chặn dù constraint tồn tại. Cũng phát hiện `finalizePayrollRun`
thiếu bảo vệ race (trùng với Agent 5), và nhánh `update` của
`payrollItem.upsert` trong `calculatePayrollRun` viết tay công thức
`baseAmount+commissionAmount` làm mất bonus/deduction đã điều chỉnh trước
đó (trùng với Agent 3 — xem chi tiết bên dưới). **Đã sửa cả 3** (xem mục
"Đã sửa" tổng hợp).

## Agent 3 — Money & PII integrity — tìm ra 2 P0 tiền thật + 1 P2 làm tròn

PII sạch (chỉ 1 vị trí chạm Customer — `getPaymentDetail` — đã omit đúng từ
lúc viết). Decimal-boundary sạch (mọi action chỉ trả `{id}`/void).

**P0 #1 — `calculatePayrollRun` nhánh `update` sai công thức tiền.** Nhánh
`create` dùng `totals.netAmount` (từ `calculatePayrollItemTotals`), nhánh
`update` viết tay `baseAmount+commissionAmount` — **không cộng
bonus/trừ deduction đã có**. Nếu 1 PayrollItem đã được `adjustPayrollItem`
thêm bonus/deduction rồi bị tính lại (recalc), `netAmount` lưu sai lệch
khỏi công thức chuẩn — đúng loại lỗi ADR-032 cảnh báo (viết tay công thức
tiền thay vì gọi hàm calc đã test). **Đã sửa**: đọc `PayrollItem` đã tồn
tại (nếu có) TRƯỚC, truyền đúng `bonusAmount`/`deductionAmount` hiện có vào
`calculatePayrollItemTotals`, dùng `totals.netAmount` cho CẢ hai nhánh.

**P0 #2 — `recordPayment` overpayment check là race thật dưới READ
COMMITTED.** Comment cũ khẳng định "tính lại trong transaction để tránh
race" nhưng không có `SELECT...FOR UPDATE`/isolation SERIALIZABLE nào — 2
transaction đồng thời vẫn cùng đọc 1 baseline trước khi bên nào commit, cả
hai pass check, cả hai ghi → overpayment thật. **Đã sửa**: thêm
`tx.$queryRaw`SELECT id FROM "Sale" WHERE id = ${sale.id} FOR UPDATE`` ngay
đầu transaction, ép request thứ 2 đợi request thứ 1 commit xong.

**P2 — `allocateCommissionAmount` làm tròn có thể overshoot tổng.** Verify
bằng cách CHẠY CODE THẬT: `allocateCommissionAmount(2, [4 người 2500bps])`
→ `[1,1,1,0]`, tổng=3 ≠ totalAmount=2 (do `Math.round(0.5)` làm tròn lên ở 3
người đầu trước khi tới người cuối). **Đã sửa**: đổi `Math.round` thành
`Math.floor` cho mọi phần tử KHÔNG PHẢI cuối — đảm bảo `assigned` không bao
giờ vượt `total` trước khi người cuối nhận phần còn lại, bất biến "tổng
luôn khớp tuyệt đối" đúng bằng cấu trúc. Thêm regression test.

## Agent 4 — Two-person approval integrity — PASS, 2 P2

Không tìm thấy vi phạm bất biến "actor duyệt lần 2 phải khác
`firstApprovedByUserId`" hay bypass tenant-isolation của `ApprovalRequest`.
`finalizePayrollRun`/`executeApprovedStockAdjustment` đều re-verify độc lập
`companyId`+`actionType`+`targetId`+`status==="APPROVED"`, không tin
`approvalRequestId` client truyền một cách mù quáng. Permission luôn
hardcode server-side (`payroll.manage`/`inventory.adjust`), không có
Server Action nào cho client tự chọn permission.

**P2 #1** — `requestPayrollFinalize` không kiểm tra request PENDING/
PENDING_SECOND đã tồn tại trước khi tạo mới (vệ sinh dữ liệu, không phải
bypass — `finalizePayrollRun` vẫn re-verify độc lập). **Đã sửa**: thêm
check, ném lỗi rõ ràng nếu đã có request đang chờ.

**P2 #2** — `idempotencyKey = request.id` dùng thẳng khi
`executeApprovedStockAdjustment` ghi StockMovement, TRÙNG namespace với
`idempotencyKey` do actor tự truyền ở `receiveStock`/`issueStock`
(`@@unique([companyId, idempotencyKey])` dùng chung 1 cột) — actor chỉ có
`inventory.receive`/`issue` (không cần `inventory.adjust`) có thể "chiếm
chỗ" idempotencyKey trùng ID một ApprovalRequest đang chờ thực thi, khiến
thực thi hợp lệ sau đó luôn thất bại (vector phá hoại, không phải bypass
duyệt). **Đã sửa**: prefix `approval:${request.id}`, cập nhật luôn
`getActionableStockAdjustmentRequests` để khớp prefix mới.

## Agent 5 — Idempotency & concurrency — tìm ra 2 P0 (trùng Agent 3) + 2 P1

Xác nhận độc lập cả 2 P0 của Agent 3 (`recordPayment`, và thêm
`finalizePayrollRun`) bằng cách trace concurrency thật (không lock/không
isolation level nào trong toàn bộ `src/lib/domain/*.ts`, grep xác nhận).

**P0 #3 (Agent 5 tìm riêng) — `finalizePayrollRun` double-finalize race.**
Check `status==="APPROVED"` nằm NGOÀI transaction, `tx.payrollRun.update`
cuối hàm KHÔNG kèm `where:{status:"APPROVED"}` tự chặn — 2 lần gọi gần-đồng-
thời (2 tab/network retry) đều pass check trước khi bên nào commit
`FINALIZED`, dẫn tới ghi **Expense trả lương HAI LẦN** cho cùng kỳ lương
(không có unique constraint nào chặn Expense trùng). **Đã sửa**: khoá row
PayrollRun (`FOR UPDATE`) + re-verify `status`+`ApprovalRequest` NGAY TRONG
transaction, trước khi tạo Expense.

**P1 — `calculateCommissionForSale` không lock, có thể tạo trùng
CommissionCalculation.** Pattern "đọc existing → xoá → tạo lại" không khoá
row Sale — 2 lần gọi đồng thời (double-submit UI) đều thấy 0 dòng cũ, đều
tạo bộ dòng riêng, nhân đôi hoa hồng khi cộng vào lương (đúng loại bug
double-count ADR-030 vừa fix ở tầng allocation). **Đã sửa**: cùng pattern
`FOR UPDATE` trên Sale row.

**P1 — `issueStock`/`transferStock` balance check hoàn toàn ngoài
transaction, không re-check, không lock.** 2 lần issue đồng thời cùng đẩy
tồn kho âm dù không ai bấm override. **Đã sửa**: khoá row `InventoryItem`
(`FOR UPDATE`, cấp item — thô hơn per-location lý tưởng nhưng đơn giản/đúng,
đủ cho quy mô Phần 6 MVP) rồi tính lại số dư NGAY TRONG transaction.

## Đã sửa sau review (tổng hợp)

1. **P0** — `recordPayment`: khoá row Sale `FOR UPDATE` trong transaction.
2. **P0** — `finalizePayrollRun`: khoá row PayrollRun `FOR UPDATE` +
   re-verify status/ApprovalRequest trong transaction.
3. **P0** — `calculatePayrollRun`: khoá row PayrollRun `FOR UPDATE` +
   re-verify status DRAFT trong transaction; sửa nhánh `update` gọi đúng
   `calculatePayrollItemTotals` với bonus/deduction hiện có thay vì viết
   tay công thức.
4. **P0/P2 làm tròn** — `allocateCommissionAmount`: `Math.floor` thay
   `Math.round` cho phần tử không-cuối; thêm regression test 4×25% trên
   tổng lẻ.
5. **P1** — `calculateCommissionForSale`: thêm `assertActiveCompanyMember`
   cho từng contributor; khoá row Sale `FOR UPDATE` chống double-create.
6. **P1** — `issueStock`/`transferStock`: khoá row InventoryItem `FOR
   UPDATE`, tính lại số dư trong transaction thay vì ngoài.
7. **P2** — 5 vị trí `include` thêm `omit: { passwordHash: true }`.
8. **P2** — `executeApprovedStockAdjustment`: prefix `idempotencyKey` thành
   `approval:${request.id}`, tránh đụng namespace với actor tự truyền.
9. **P2** — `requestPayrollFinalize`: chặn tạo request trùng khi đã có
   request PENDING/PENDING_SECOND.
10. **P1 (ADR-034)** — thread `idempotencyKey` (sinh qua
    `crypto.randomUUID()` client-side, ổn định qua double-click, làm mới
    sau khi thành công) vào `RecordPaymentForm`, `ReceiveStockForm`,
    `IssueStockForm`, `TransferStockForm` — trước đó field tồn tại ở schema
    nhưng không route nào thực sự dùng.

Regression test mới: 3 test concurrency dùng `Promise.allSettled` gọi THẬT
2 lệnh song song (Node xen kẽ I/O bất đồng bộ giữa 2 truy vấn Postgres cùng
lúc — race thật, không giả lập) cho `recordPayment`/`finalizePayrollRun`/
`issueStock`, cộng 1 test unit cho lỗi làm tròn — tổng **133 integration +
64 unit**, tất cả PASS sau khi sửa (trước khi sửa các race test này sẽ
FAIL thật nếu chạy trên code cũ, đã tự tay xác nhận bằng cách chạy thử
trước/sau).

## Không sửa (chấp nhận, ghi lại lý do)

- Khoá `InventoryItem` ở cấp toàn bộ item (không phải per-location) —
  chấp nhận vì đơn giản/đúng, đủ cho quy mô Phần 6 MVP; nếu sau này 1
  InventoryItem có rất nhiều location ghi đồng thời tần suất cao, có thể
  tách khoá mịn hơn (advisory lock theo `(companyId, itemId, locationId)`)
  kèm ADR riêng khi có bằng chứng cần.
- `ApprovalRequestStatus.EXPIRED` không có code path nào transition tới —
  dead enum value, không phải lỗ hổng, để dành cho cơ chế hết hạn tự động
  nếu Phần 8 (Decision Inbox) cần.
