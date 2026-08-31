# Sales (Phần 5)

**Sale là thực tế thương mại đã xảy ra — KHÔNG phải Payment, KHÔNG phải
Ledger** (mục LXIII-LXIV). Sale chỉ trả lời "khách mua gì, giá bao nhiêu,
ai bán, khi nào" — không tự tính tiền đã thu, không tự posting kế toán.
Payment/Debt/Ledger/Invoice/Tax thuộc Phần 6 Finance.

## Sale ≠ Opportunity (ADR-019)

Không có `SalesOpportunity`. Sale luôn là giao dịch đã xảy ra thật (kể cả ở
trạng thái DRAFT — DRAFT nghĩa là "đang soạn", không phải "tiềm năng chưa
chắc mua").

## Customer optional (ADR-018)

`Sale.customerId` nullable — Company walk-in không bắt buộc định danh khách
ngay lúc bán.

## Status — 3 trạng thái, không 15 (mục LXV)

`DRAFT → CONFIRMED`, hoặc `→ CANCELLED` từ DRAFT/CONFIRMED. Không có
`COMPLETED` riêng (mục LXV cho phép bỏ — CONFIRMED đã là "thực tế thương
mại ổn định", thêm trạng thái phân biệt "hoàn thành" mà không có
Payment/Fulfillment thật (Phần 6) là chưa cần thiết ở Phần 5).

- **DRAFT** — sửa tự do (thêm/bớt dòng, đổi khách, đổi salesperson) — domain
  service `updateDraftSale` đã có đầy đủ (kể cả thay toàn bộ `lines`), NHƯNG
  **cố ý CHƯA có UI gọi tới ở Phần 5** (không có form "sửa dòng hàng" trên
  trang chi tiết Sale) — ghi rõ ở đây sau simplicity review để không bị hiểu
  nhầm là dead code/bỏ sót khi review sau. Quy trình MVP hiện tại: tạo Sale
  mới nếu DRAFT cần sửa nhiều; `updateDraftSale`/`updateDraftSaleAction` vẫn
  export sẵn, có integration test riêng — thêm UI khi có bằng chứng người
  dùng thật cần sửa Draft thay vì tạo lại.
- **CONFIRMED** — "thực tế thương mại ổn định" (mục CXIX) — `updateDraftSale`
  từ chối mọi Sale không còn DRAFT, nên CONFIRMED được bảo vệ khỏi sửa ngầm
  bằng cấu trúc code, không cần thêm lock riêng.
- **CANCELLED** — huỷ, giữ nguyên lịch sử, không bao giờ hard-delete (mục
  LXVII).

## SaleLine — snapshot giá tại thời điểm bán (mục LXXII/CLXXVIII)

`unitPrice`/`discountAmount`/`lineTotal` lưu cố định lúc tạo dòng — đổi
`CatalogItem.defaultPrice` sau đó KHÔNG bao giờ ảnh hưởng ngược Sale đã có.
`catalogItemId` optional — cho phép dòng tuỳ chỉnh không có trong Catalog
(mục LXXIV), nhưng Catalog vẫn phải hữu ích cho phần lớn giao dịch, không
biến mọi dòng thành custom.

## Catalog ≠ Inventory (mục LXX)

`CatalogItem` chỉ trả lời "cái gì bán được" (PRODUCT hoặc SERVICE, có
`active` để ngừng bán) — KHÔNG theo dõi tồn kho/giá vốn. Inventory thật
thuộc Phần 6.

## Tổng tiền — code thuần, không AI (mục LXXV/CCXXI)

`src/lib/domain/sale-totals.ts` — hàm thuần, không DB, unit test riêng.
"Code First, AI Explains": AI (Phần 8) chỉ được giải thích số đã tính sẵn,
không bao giờ tự tính tổng.

## Discount — số cố định, không rule engine (ADR-021)

`SaleLine.discountAmount` là số tiền VNĐ người tạo Sale tự nhập trực tiếp.
Không port `ZMechanismDefinition`/`ZMechanismVersion` — engine đó ở
ZenithTasks chưa từng chạy thật (DRAFT-only). Hoa hồng thật (Phần 6 Payroll)
dùng dữ liệu attribution Sale để lại (`salespersonUserId`, `lineTotal`...),
không tính trong Sales.

## Business integrity (mục CCLIV)

Từ chối `quantity <= 0`, từ chối tiền âm/không hợp lệ, từ chối thêm dòng
tham chiếu `CatalogItem.active === false` vào Sale mới.

## Visibility (ADR-022)

`sales.view` = toàn bộ Company, KHÔNG lọc theo `salespersonUserId`.

## Quyền — `sales.cancel` tách riêng vì rủi ro cao hơn (mục CCXLIV-CCXLV)

MEMBER có `sales.create`/`update`/`confirm` (tự đóng giao dịch của mình)
nhưng KHÔNG có `sales.cancel` — huỷ 1 Sale đã CONFIRMED là hành động rủi ro
cao hơn (đảo ngược 1 "thực tế thương mại ổn định"), giữ ở MANAGER trở lên.
