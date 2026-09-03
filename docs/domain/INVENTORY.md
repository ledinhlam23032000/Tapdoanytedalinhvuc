# Inventory (Phần 6)

`StockMovement` là nguồn sự thật DUY NHẤT cho tồn kho — không có cột số dư
mutable trên `InventoryItem`/`InventoryLocation`. Số dư luôn tính bằng tổng
các `StockMovement` (`calculateStockBalance`, pure function, unit test
riêng) — cùng triết lý bất biến với `LedgerEntry` (Finance) và `AuditEvent`
(Phần 3): sự thật là chuỗi sự kiện, không phải 1 con số có thể bị ghi đè.

## StockMovementType — 6 loại đóng, quantity luôn dương (ADR-031/032)

`IN`, `OUT`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `TRANSFER_IN`,
`TRANSFER_OUT`. `quantity` (`Decimal(18,3)`) luôn dương — chiều tăng/giảm
biểu diễn qua `type` (`movementSign`), không qua dấu số, nhất quán với
nguyên tắc tiền ở `FINANCE.md`.

**Thiết kế tự phát hiện và sửa trước review**: bản nháp đầu chỉ có 1 loại
`ADJUSTMENT` — không đại diện được cả tăng lẫn giảm nếu `quantity` bắt buộc
dương. Tách thành `ADJUSTMENT_IN`/`ADJUSTMENT_OUT` trước khi viết domain
service, không phải patch sau review.

## Không âm kho (trừ khi có bằng chứng nghiệp vụ ngược lại)

`wouldResultInNegativeBalance` chặn `issueStock`/`transferStock`/
`ADJUSTMENT_OUT` khiến số dư tại 1 `InventoryLocation` xuống dưới 0 — kiểm
tra bên trong transaction có khoá dòng (xem Concurrency dưới), không phải
kiểm tra rồi ghi tách rời (race).

## receiveStock / issueStock / transferStock — khoá dòng (P0 fix)

Cùng pattern race-condition đã sửa ở Finance/Payroll: `issueStock`/
`transferStock` khoá dòng `InventoryItem` liên quan
(`SELECT...FOR UPDATE`) bên trong `db.$transaction`, đọc lại số dư và xác
minh lại bên trong khoá trước khi ghi `StockMovement` — chặn 2 lần xuất
đồng thời cùng vượt số dư thật (Postgres READ COMMITTED không tự chặn race
này).

## Idempotency (ADR-034) — và namespace-collision đã sửa (P2)

`StockMovement` có `@@unique([companyId, idempotencyKey])`. UI sinh key qua
`crypto.randomUUID()` (React state, regenerate sau thành công) cho
`ReceiveStockForm`/`IssueStockForm`/`TransferStockForm`. Riêng
`executeApprovedStockAdjustment` dùng key `` `approval:${request.id}` ``
(có prefix), KHÔNG dùng bare `request.id` — bug thật đã sửa: bare
`request.id` chia sẻ cùng cột/constraint với key client tự đặt, một actor
quyền thấp hơn có thể "chiếm" key đó trước để chặn vĩnh viễn 1 yêu cầu điều
chỉnh đã được duyệt hợp lệ không bao giờ thực thi được (sabotage vector, tìm
thấy qua review).

## Two-person approval cho Adjustment — dùng chung `ApprovalRequest`

Xem `PAYROLL.md` mục "Two-person approval" — cùng 1 model, cùng 1 bất biến
"người duyệt lần 2 phải khác người duyệt lần 1", đã live-verify độc lập
trên Inventory (không chỉ Payroll) qua browser thật: click "Duyệt lần 2"
bằng đúng actor vừa duyệt lần 1 bị chặn với lỗi hiển thị trên UI. Wrapper
functions (`firstApproveStockAdjustment`/`secondApproveStockAdjustment`/
`rejectStockAdjustment`) hardcode `"inventory.adjust"` server-side, không
nhận permission string từ client — cùng nguyên tắc `PAYROLL.md`.

**Chỉ `ADJUSTMENT` cần 2 người** — `RECEIVE`/`ISSUE`/`TRANSFER` chỉ cần
permission tương ứng (`inventory.receive`/`issue`/`transfer`), không qua
`ApprovalRequest` (rủi ro thấp hơn — có chứng từ nhập/xuất/chuyển kho đối
chiếu được, không phải "tự nhận thiếu/thừa" như Adjustment).

## getActionableStockAdjustmentRequests — bug UI thật đã sửa

`getPendingApprovalRequests` (dùng chung cho cả Payroll) không bao giờ trả
về status `APPROVED` — đúng cho Payroll (APPROVED → gọi Finalize ngay,
không có bước "thực thi sau"), nhưng SAI cho Inventory: 1 yêu cầu điều
chỉnh đã duyệt đủ 2 người nhưng CHƯA thực thi (`executeApprovedStockAdjustment`)
bị biến mất vĩnh viễn khỏi trang `/inventory/adjustments`, không ai bấm
"Thực thi" được nữa. Sửa bằng hàm mới `getActionableStockAdjustmentRequests`
— gồm cả APPROVED chưa thực thi (xác định qua
`StockMovement.idempotencyKey === "approval:" + request.id` chưa tồn tại).
Đã live-verify qua browser: request APPROVED hiện đúng nút "Thực thi điều
chỉnh", bấm xong biến mất khỏi danh sách, số dư cập nhật đúng.

## reorderLevel / Low Stock (gap tự phát hiện)

`InventoryItem.reorderLevel` (Decimal, optional) — thiếu ở bản schema đầu,
tự phát hiện khi viết `getLowStockItems` (không có ngưỡng nào để so sánh)
và thêm trước khi review, không phải patch sau.

## Không có trong Phần 6 (đã kiểm tra bằng chứng, không phải bỏ sót)

- Định giá tồn kho (FIFO/LIFO/giá vốn bình quân) — `StockMovement` không
  lưu giá trị, chỉ số lượng; giá vốn thuộc phạm vi kế toán sâu hơn MVP.
- Barcode/serial/lot tracking — chưa có bằng chứng legacy vận hành thật.
- Purchase Order/Supplier — chưa có domain mua hàng ở Phần 6, `receiveStock`
  chỉ ghi nhận nhập kho, không có quy trình đặt hàng nhà cung cấp.

## Audit

Danh sách đóng: `INVENTORY_ITEM_CREATED/UPDATED`, `INVENTORY_LOCATION_CREATED`,
`STOCK_RECEIVED/ISSUED/TRANSFERRED`, `STOCK_ADJUSTMENT_REQUESTED/
FIRST_APPROVED/SECOND_APPROVED/REJECTED/EXECUTED`.
