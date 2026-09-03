# Finance (Phần 6 — tổng quan)

Phần 6 hiện thực hoá dòng tiền thật của Company: `Sale` (Phần 5, "thực tế
thương mại") → `Payment` (tiền vào) → `Expense` (tiền ra, gồm cả lương) →
`LedgerEntry` (sổ cái bất biến ghi lại mọi dòng tiền) → `PayrollRun`/
`CommissionCalculation` (chi phí nhân sự) → `InventoryItem`/`StockMovement`
(hàng hoá). Chi tiết từng domain: `PAYROLL.md`, `COMMISSION.md`,
`INVENTORY.md`. Tài liệu này giữ phần Payment/Expense/Ledger/Receivable +
nguyên tắc chung cho toàn bộ Phần 6.

## Ownership

`Payment`, `Expense`, `LedgerEntry` thuộc `Company` — không thuộc `Project`.
`LedgerEntry` có thể gắn attribution optional vào `OrganizationUnit`/
`Project`/`Customer`, cùng pattern attribution đã dùng ở Phần 4/5 — không
phải ranh giới sở hữu mới (ADR-024).

## Payment = tiền vào, Expense = tiền ra (ADR-025)

Không có model `Transaction` chung 1 bảng gộp thu-chi bằng field `direction`.
`Payment` luôn gắn với 1 `Sale` đã `CONFIRMED` (không thu tiền cho giao dịch
chưa xác nhận). `Expense` độc lập, có `category` đóng (`RENT`, `MARKETING`,
`SALARY`, `SUPPLIES`, `UTILITIES`, `OTHER`) và `sourceType`
(`MANUAL`/`PAYROLL_RUN`) — chi lương không phải nhập tay, tự động sinh ra
khi `finalizePayrollRun` chạy (xem `PAYROLL.md`).

## Receivable — derived, không lưu (ADR-026)

Không có bảng `AccountsReceivable`/`Invoice`. Công nợ khách hàng
(`getCustomerReceivable`) tính trực tiếp từ `sum(Sale.totalAmount WHERE
status=CONFIRMED) - sum(Payment.amount WHERE status=POSTED)` tại thời điểm
query — không có state riêng có thể lệch khỏi nguồn dữ liệu gốc.

## Ledger bất biến — sửa bằng correction, không update/delete (ADR-027)

`LedgerEntry` không bao giờ `UPDATE`/`DELETE` sau khi tạo (mục tương tự
nguyên tắc `AuditEvent` append-only). Sửa sai làm bằng cách tạo 1
`LedgerEntry` mới loại `ADJUSTMENT`, có `correctionOfEntryId` trỏ ngược về
dòng gốc (self-FK) — lịch sử luôn đầy đủ, không bao giờ có 2 phiên bản khác
nhau của cùng 1 sự thật kế toán tại cùng 1 thời điểm.

## Void, không xoá (nhất quán với Sale CANCELLED)

`Payment`/`Expense` không hard-delete — void bằng field
`status: POSTED → VOID` + `voidedByUserId`/`voidedAt`/`voidReason`. Ghi
`LedgerEntry` gốc vẫn giữ nguyên (bất biến); void chỉ đổi trạng thái nghiệp
vụ của Payment/Expense, không xoá dấu vết kế toán.

## Money handling (ADR-032)

Mọi field tiền dùng Prisma `Decimal(18,2)`, luôn không âm — chiều tăng/giảm
biểu diễn qua entity/type (Payment=vào, Expense=ra, LedgerEntry.type), không
qua dấu số. Server Action không bao giờ trả thẳng object Prisma chứa
`Decimal` qua boundary Server→Client (bài học Phần 5 lặp lại đúng nguyên
tắc) — chỉ trả `{id}` hoặc void.

## Idempotency (ADR-034)

`Payment` có `@@unique([companyId, idempotencyKey])`. Client sinh key qua
`crypto.randomUUID()` lúc mở form (`useState`), regenerate sau khi thành
công — chống double-submit (double-click, mất mạng retry) tạo 2 Payment
cùng 1 giao dịch thật.

## Concurrency — SELECT...FOR UPDATE cho mọi check-then-write tiền (P0 fix)

Postgres mặc định READ COMMITTED không tự chặn 2 request đọc cùng lúc "còn
thiếu bao nhiêu tiền" rồi cùng ghi Payment — review tìm thấy race thật ở
`recordPayment` (2 Payment đồng thời có thể cùng vượt tổng tiền Sale). Sửa
bằng cách khoá dòng liên quan (`SELECT ... FOR UPDATE` trong
`db.$transaction`) trước khi đọc lại và xác minh, cho MỌI hàm domain có
pattern "đọc số dư → kiểm tra hợp lệ → ghi" trên tiền/kho (áp dụng lại y hệt
ở `PAYROLL.md`/`INVENTORY.md`). Xem test hồi quy thật (không mô phỏng) ở
`tenant-isolation-part6.itest.ts` mục "Concurrency — race condition
regression".

## Không có trong Phần 6 (đã kiểm tra bằng chứng, không phải bỏ sót)

- `Invoice`/hoá đơn điện tử — không bằng chứng legacy vận hành thật, Sale +
  Payment đã đủ trả lời "khách nợ bao nhiêu" cho MVP.
- `AccountsPayable`/công nợ nhà cung cấp — chưa có domain Purchase/Supplier
  thật ở Phần 6.
- Đa tiền tệ (`multi-currency`) — dùng nguyên `Company.currency` đã có từ
  Phần 3, không thêm field tiền tệ thứ 2 ở entity nào Phần 6.
- Kế toán kép (double-entry, `DebitAccount`/`CreditAccount`) — `LedgerEntry`
  đơn dòng theo `type` đã đủ trả lời nhu cầu MVP; không xây chart-of-accounts.

## Audit

Danh sách đóng: `PAYMENT_RECORDED/VOIDED`, `EXPENSE_RECORDED/VOIDED`,
`LEDGER_CORRECTION_CREATED`, cộng các action Payroll/Commission/Inventory
liệt kê ở tài liệu tương ứng.
