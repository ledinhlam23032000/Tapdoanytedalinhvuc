# Commission (Phần 6)

Salvage nghiệp vụ, không salvage code. `FINANCE-DEFINITIONS.md` (legacy
archaeology) ghi lại rõ ràng bug double-count hoa hồng thật đã xảy ra ở
ZenithTasks (số liệu cụ thể, không suy đoán) — Phần 6 thiết kế lại từ đầu
với bất biến chống double-count là ràng buộc hàng đầu, không port
`ZMechanismDefinition`/`ZMechanismVersion` (đã xác nhận ADR-021 Phần 5:
DRAFT-only, chưa từng chạy production thật).

## 3 loại rule đóng, không rule engine mở (ADR-030)

`CommissionRule.type`: `PERCENTAGE_OF_SALE`, `FIXED_PER_ITEM`,
`TIERED_THRESHOLD` — `config` (Json) theo đúng 3 shape cố định cho 3 type
này, không phải DSL tuỳ biến. `calculateCommissionBaseAmount` có đúng 3
nhánh tương ứng, không nhánh mặc định "generic formula".

## Vòng đời rule — DRAFT/ACTIVE/RETIRED + effective-dated

`CommissionRule.status`: `DRAFT → ACTIVE → RETIRED`. `effectiveFrom`/
`effectiveTo` xác định rule nào áp dụng cho Sale nào tại thời điểm tính —
đổi rule không ảnh hưởng ngược Sale đã tính hoa hồng trước đó (snapshot giữ
trong `CommissionCalculation.snapshot`, cùng triết lý "giá tại thời điểm
bán" của `SaleLine` Phần 5).

## Chống double-count — allocationBps tường minh (ADR-030, P1+rounding fix)

`CommissionCalculation` lưu `allocationBps` (basis points, /10000) tường
minh cho từng người đóng góp trên 1 Sale — `allocateCommissionAmount` từ
chối tổng vượt 10000 (`CommissionAllocationOverflowError`). Đây chính là cơ
chế ngăn lỗi double-count đã xảy ra ở legacy (2 người cùng nhận 100% thay vì
chia đúng tỉ lệ).

**Bug rounding thật đã sửa** (phát hiện qua hand-execution, không chỉ đọc
code): `allocateCommissionAmount` dùng `Math.round` cho MỌI phần chia →
nhiều phần cùng làm tròn lên ở ngưỡng .5 trước khi tới lượt người cuối nhận
phần dư → tổng vượt `totalAmount` (repro cụ thể: 4 người × 25% trên tổng=2 →
tổng ra 3, không phải 2). Sửa: các phần KHÔNG PHẢI người cuối dùng
`Math.floor`, chỉ người cuối nhận phần dư (`totalAmount - sum(đã làm tròn
xuống)`) — đảm bảo bất biến `sum(allocations) === totalAmount` đúng bằng
cấu trúc, không phải bằng may mắn thứ tự làm tròn.

## calculateCommissionForSale — khoá + validate contributor (P1 fixes)

1. **Race condition (P0)**: khoá dòng `Sale` (`SELECT...FOR UPDATE`) trước
   chuỗi đọc-cũ/xoá/tạo-mới — chặn 2 lần gọi tính hoa hồng đồng thời cho
   cùng 1 Sale tạo ra 2 bộ `CommissionCalculation` chồng lấn.
2. **Cross-tenant gap (P1)**: trước khi tạo `CommissionCalculation`, MỌI
   `userId` đóng góp đều phải qua `assertActiveCompanyMember` — bug thật đã
   sửa: bản gốc cho phép gán hoa hồng cho BẤT KỲ `userId` nào tồn tại trong
   hệ thống, kể cả người không thuộc Company đó.

## Liên kết Payroll — snapshot, không tính lại

`linkCommissionCalculationsToPayrollItemTx` gắn các `CommissionCalculation`
chưa gán kỳ nào vào đúng `PayrollItem` khi `calculatePayrollRun` chạy —
`CommissionCalculation.amount` đã chốt tại thời điểm tính, Payroll chỉ cộng
dồn, không tính lại công thức hoa hồng.

## overrideCommissionCalculation — sửa tay có audit, không cần 2 người

Khác Payroll Finalize/Inventory Adjustment — override hoa hồng 1 dòng chỉ
cần single-approver + `reason` bắt buộc + audit event riêng
(`COMMISSION_OVERRIDDEN`), không qua `ApprovalRequest` 2 người (ADR-029: rủi
ro thấp hơn — sửa 1 dòng hoa hồng cá nhân, không phải chốt sổ chi tiền hàng
loạt).

## Audit

Danh sách đóng: `COMMISSION_RULE_CREATED/STATUS_CHANGED`,
`COMMISSION_CALCULATED`, `COMMISSION_OVERRIDDEN`.
