# Checkpoint — Phần 6 hoàn tất

(Checkpoint Phần 1-5 xem lịch sử git — `git log --oneline` — commit "Part
1: ...", ..., "Part 5: ...". File này chỉ giữ checkpoint MỚI NHẤT.)

## PHASE 6 STATUS

**COMPLETE** — `PART_6_COMPLETE`, `READY_FOR_PART_7`. Finance + Payment +
Receivable + Ledger + Payroll + Commission + Inventory implement thật trên
nền Sales Phần 5 (Sale CONFIRMED là điểm neo) — schema Prisma migrate được,
domain service + Server Action + UI chạy được end-to-end qua browser thật
với 3 journey bắt buộc (Finance/Payment, Payroll two-person-approval,
Inventory two-person-approval), 133 integration test PASS (99 cũ + 34 mới),
adversarial code review **5 agent độc lập** (tăng từ 3 ở Phần 5 vì đây là
domain HIGH/VERY HIGH RISK — tiền + kho dưới concurrency) tìm **4 P0 thật**
(race condition tiền/lương/kho) + nhiều P1/P2 (đã sửa hết), và **2 bug thật
thứ 2 phát hiện sau review**: 1 qua browser-test (effectiveFrom same-day
exclusion) + 1 qua re-verify integration test trước checkpoint (UTC
truncation regression tự gây ra bởi chính bản vá đầu — xem mục riêng bên
dưới, đúng tinh thần "never fake PASS/DONE": không chốt checkpoint khi test
đỏ).

TARGET HEAD: xem commit ngay sau checkpoint này (`git log -1`).

## SCHEMA IMPLEMENTED (mới ở Phần 6)

`Payment`, `Expense`, `LedgerEntry`, `PayrollProfile`, `PayrollRun`,
`PayrollItem`, `ApprovalRequest`, `CommissionRule`, `CommissionCalculation`,
`InventoryLocation`, `InventoryItem`, `StockMovement` (`prisma/schema.prisma`,
4 migration: `20260831034101_finance_payroll_commission_inventory`,
`20260831034500_fix_stock_adjustment_direction` (tách `ADJUSTMENT` →
`ADJUSTMENT_IN`/`ADJUSTMENT_OUT`, tự phát hiện trước review),
`20260831035000_approval_request_payload` (thêm `payload Json?`, tự phát
hiện gap thiết kế), `20260831040000_inventory_item_reorder_level` (thêm
field cho Low Stock signal, tự phát hiện gap). Verified qua cả `prisma
migrate dev` (local) và `prisma migrate deploy` (fresh-install test trên DB
trống riêng, xem mục FRESH DB TEST).

## KIẾN TRÚC QUYẾT ĐỊNH (ADR-024 → ADR-035, `docs/architecture/DECISIONS.md`)

- **ADR-024** — Payment/Expense/LedgerEntry thuộc Company, attribution
  optional qua OrganizationUnit/Project/Customer.
- **ADR-025** — Payment = tiền vào (gắn Sale CONFIRMED), Expense = tiền ra
  (category đóng + sourceType MANUAL/PAYROLL_RUN) — không gộp 1 model
  `Transaction` chung có field `direction`.
- **ADR-026** — Receivable derived, không lưu bảng riêng — tính trực tiếp
  từ `sum(Sale.totalAmount CONFIRMED) - sum(Payment.amount POSTED)`.
- **ADR-027** — LedgerEntry bất biến, sửa bằng correction record
  (`correctionOfEntryId` self-FK), không bao giờ UPDATE/DELETE.
- **ADR-028** — `ApprovalRequest` là primitive 2-người-duyệt DÙNG CHUNG cho
  Payroll Finalize + Inventory Adjustment, mô hình theo `AssistantApproval`
  (legacy, verify bằng grep trực tiếp — có implementation chạy thật ở
  `web/src/app/(app)/tro-ly/agent.ts`), KHÔNG theo `ZWorkspacePayrollRun`
  dual-field pattern (chưa xác minh chạy thật).
- **ADR-029** — Chỉ 2 phạm vi bắt buộc 2-người: PayrollRun.finalize,
  Inventory ADJUSTMENT. Payment void/Ledger correction/Commission override
  chỉ cần single-approver + reason + audit.
- **ADR-030** — Commission: 3 loại rule đóng (PERCENTAGE_OF_SALE/
  FIXED_PER_ITEM/TIERED_THRESHOLD) + `allocationBps` tường minh chống
  double-count (bằng chứng bug double-revenue-count thật từ
  `FINANCE-DEFINITIONS.md` legacy).
- **ADR-031** — StockMovement là nguồn sự thật DUY NHẤT cho tồn kho, không
  cột số dư mutable nào; 6 type đóng gồm `ADJUSTMENT_IN`/`ADJUSTMENT_OUT`.
- **ADR-032** — Money handling: `Decimal(18,2)`, luôn không âm, chiều
  tăng/giảm qua entity/type không qua dấu số; Server Action không trả
  Decimal-bearing Prisma object qua boundary.
- **ADR-033** — Không đa tiền tệ mới — dùng nguyên `Company.currency` đã có
  từ Phần 3.
- **ADR-034** — Idempotency bắt buộc: `@@unique([companyId, idempotencyKey])`
  trên `Payment` và `StockMovement`, client sinh key qua `crypto.randomUUID()`.
- **ADR-035** — Không xây AccountsPayable/Invoice/kế toán kép ở Phần 6 —
  chưa đủ bằng chứng nghiệp vụ thật cần.

Chi tiết implementation + invariant giữ nguyên: `docs/domain/FINANCE.md`,
`PAYROLL.md`, `COMMISSION.md`, `INVENTORY.md` (đọc trước khi sửa domain
này).

## DOMAIN SERVICE + ACTION + UI

`src/lib/domain/payroll-calc.ts` (tính PayrollItem thuần, unit test riêng),
`commission-calc.ts` (phân bổ hoa hồng thuần + chặn overflow, unit test
riêng — nơi xảy ra bug rounding, xem dưới), `stock-balance.ts` (tính số dư
kho thuần từ StockMovement, unit test riêng), `approval-service.ts`
(`ApprovalRequest` core, bất biến "khác người duyệt lần 2" ở đây),
`finance-service.ts`, `payroll-service.ts`, `commission-service.ts`,
`inventory-service.ts` — 4 domain service chính, mỗi cái đều có ít nhất 1
race-condition fix (xem ADVERSARIAL CODE REVIEW). `scope-guards.ts` mở rộng
7 assert cross-company mới. Server Actions: `finance-actions.ts`,
`payroll-actions.ts`, `commission-actions.ts`, `inventory-actions.ts` — thin
wrapper cùng pattern Phần 5, luôn trả `{id}` hoặc void (không bao giờ trả
Decimal-bearing object). UI: `/c/[code]/{finance,payroll,inventory}` + trang
chi tiết từng entity + `payroll/profiles`, `payroll/commission-rules`,
`inventory/adjustments` — nav cập nhật ở `company-nav.tsx` (3 top-level item
mới: Tài chính/Lương/Tồn kho). `sales/[saleId]/page.tsx` tích hợp thêm
Receivable/Payment section + Commission section (integrate trực tiếp, loại
trừ khỏi mọi UI agent song song để tránh xung đột).

## PERMISSION MỞ RỘNG

`finance.view/payment.create/payment.void/expense.create/expense.void/
correction.create`, `payroll.view/manage`, `commission.view/manage`,
`inventory.view/receive/issue/transfer/adjust/manage` (16 key mới,
`src/lib/permissions/registry.ts`+`presets.ts`). Gỡ `"healthcare."` khỏi
`RESERVED_PERMISSION_PREFIXES` — prefix reserved cuối cùng còn lại, dành
Phần 7. **Phá vỡ pattern nhất quán từ Phần 3**: `payroll.view`/
`commission.view` KHÔNG cấp mặc định cho VIEWER/MEMBER (quyết định tường
minh theo anti-drift Q12 — rủi ro lộ lương đồng nghiệp). `READ_ONLY_PERMISSIONS`
(`company-context.ts`) mở rộng đúng 4 permission `.view` mới. Mọi wrapper
approval hardcode permission string server-side — không nhận từ tham số
client (lỗ hổng leo thang quyền tự phát hiện và sửa TRƯỚC khi review, không
phải do review tìm ra).

## STATIC TESTS

`npx tsc --noEmit` 0 lỗi · `npx eslint .` 0 lỗi/cảnh báo · `npx next build`
PASS (30 route, thêm 10 route Phần 6: `/c/[code]/finance`,
`/c/[code]/finance/payments/[paymentId]`, `/c/[code]/finance/expenses/[expenseId]`,
`/c/[code]/payroll`, `/c/[code]/payroll/[payrollRunId]`,
`/c/[code]/payroll/profiles`, `/c/[code]/payroll/commission-rules`,
`/c/[code]/inventory`, `/c/[code]/inventory/[inventoryItemId]`,
`/c/[code]/inventory/adjustments`). Cả 3 lệnh chạy lại lần cuối SAU khi sửa
2 bug phát hiện lúc re-verify trước checkpoint (xem mục riêng bên dưới),
không chỉ trước review.

## UNIT + INTEGRATION TESTS

`npm run test` — **64/64 PASS** (44 cũ + 4 `payroll-calc.test.ts` + 9
`commission-calc.test.ts` + 7 `stock-balance.test.ts`, gồm 1 test hồi quy
rounding + 1 test hồi quy double-count cho bug hoa hồng thật — xem dưới).
`npm run test:integration` — **133/133 PASS** (99 cũ + 34 mới
`tenant-isolation-part6.itest.ts`): cross-company FK injection trên mọi FK
mới, vòng đời PayrollRun đầy đủ (kể cả live assertion "cùng actor không
duyệt lần 2 được"), Commission allocation + chặn double-count + cross-company
contributor validation, Inventory movement + chặn âm kho + transfer + duyệt
điều chỉnh, Suspended-Company chặn ghi cả 4 domain mới, và **describe block
riêng cho concurrency** ("Concurrency — race condition regression (P0 fix)")
dùng `Promise.allSettled` bắn THẬT 2 lệnh domain-service song song vào cùng
1 Postgres instance (không mô phỏng) cho `recordPayment`/
`finalizePayrollRun`/`issueStock`, xác nhận đúng 1 trong 2 thành công.

## ADVERSARIAL CODE REVIEW (5 agent độc lập — tăng từ 3 ở Phần 5)

`docs/security/RED_TEAM_CODE_REVIEW_PART6.md`. Agent 1 (tenant-isolation):
1 P1 + 1 P2. Agent 2 (simplicity/spec-fidelity): FAIL ban đầu trên ADR-034
(đã sửa). Agent 3 (money/PII integrity): 2 P0 + 1 P2. Agent 4
(approval-integrity, MỚI ở Phần 6 — domain đầu tiên có 2-người-duyệt):
PASS + 2 P2. Agent 5 (idempotency/concurrency, MỚI ở Phần 6): 2 P0 xác nhận
+ 2 P1.

**4 P0 thật tìm thấy** (2 agent độc lập cùng tìm ra `recordPayment`/
`finalizePayrollRun` — cross-corroborated):
1. `calculatePayrollRun` — nhánh `update` của `payrollItem.upsert` hand-roll
   `netAmount`, làm mất bonus/deduction đã điều chỉnh lần trước. Sửa: cả 2
   nhánh create/update đều gọi `calculatePayrollItemTotals`.
2. `recordPayment` — race điều kiện đọc-số-dư-rồi-ghi dưới Postgres READ
   COMMITTED, có thể 2 Payment đồng thời cùng vượt tổng tiền Sale. Sửa:
   `SELECT...FOR UPDATE` khoá dòng liên quan trong transaction.
3. `finalizePayrollRun` — race tương tự, rủi ro chi lương 2 lần cùng 1 kỳ.
   Sửa cùng pattern, cả thân hàm chuyển vào trong transaction có khoá.
4. `issueStock`/`transferStock` — race tương tự trên tồn kho, có thể xuất
   âm kho dưới truy cập đồng thời. Sửa cùng pattern.

**Các P1/P2 đáng chú ý khác đã sửa**: rounding bug `allocateCommissionAmount`
(4×25% trên tổng=2 → tổng ra 3, không phải 2 — sửa dùng `Math.floor` cho
phần không phải cuối); cross-tenant gap `calculateCommissionForSale` (chưa
validate contributor userId thuộc đúng Company); PII over-fetch
`getPaymentDetail` (thiếu `omit` SĐT customer — lặp lại đúng bug class Phần
5); idempotencyKey namespace-collision ở `executeApprovedStockAdjustment`
(bare `request.id` chia sẻ cột với key client tự đặt — sabotage vector);
`getPendingApprovalRequests` không bao giờ trả APPROVED → adjustment đã
duyệt đủ nhưng chưa thực thi biến mất khỏi UI vĩnh viễn (sửa bằng
`getActionableStockAdjustmentRequests` mới).

Không còn P0/P1 mở sau khi sửa. Chi tiết đầy đủ: xem file review.

## BUG THẬT PHÁT HIỆN NGOÀI REVIEW — 2 lớp riêng biệt

**Lớp 1 — qua browser test (Journey B, trước review kết thúc)**:
`effectiveFrom` PayrollProfile mặc định `new Date()` (timestamp chính xác)
có thể MUỘN HƠN `periodStart` cùng ngày → lương set cùng ngày kỳ lương bắt
đầu bị loại khỏi kỳ đó âm thầm. Sửa lần 1: transform effectiveFrom về đầu
ngày bằng `getFullYear/getMonth/getDate` (giờ địa phương).

**Lớp 2 — qua re-verify integration test TRƯỚC khi chốt checkpoint (không
phải do agent review nào tìm ra, tự phát hiện bằng cách chạy lại toàn bộ
test suite trước khi viết checkpoint đúng tinh thần "never fake PASS")**:
Bản vá Lớp 1 dùng `getFullYear/getMonth/getDate` (giờ ĐỊA PHƯƠNG của máy
chạy Node) để truncate effectiveFrom — trong khi `periodStart` và mọi
`effectiveFrom` tường minh khác đều được `z.coerce.date()` parse theo UTC
midnight (chuẩn parse ISO date-only string). Trên máy chạy ở timezone lùi
sau UTC, truncate theo giờ địa phương làm 1 `effectiveFrom` UTC-midnight
tường minh (vd `new Date("2026-06-01")`) bị lùi lại 1 ngày
(`2026-05-31`) — gây `AssertionError` thật trong
`tenant-isolation-part6.itest.ts` (test "Thiết lập PayrollProfile
effective-dated"). **Sửa lần 2**: đổi sang `Date.UTC(d.getUTCFullYear(),
d.getUTCMonth(), d.getUTCDate())` — nhất quán UTC-midnight ở MỌI nơi so
sánh ngày trong Payroll, không còn phụ thuộc timezone máy chạy.

Sửa lần 2 làm lộ ra **1 bug thứ 3** (thật ra là gap trong chính test, không
phải source): test "Vòng đời đầy đủ ... sinh đúng Expense SALARY" dùng
`db.expense.findFirst` không filter — khi memberA có `PayrollProfile` từ
test trước đó (chạy cùng `beforeAll`, không `beforeEach`) bleed trùng kỳ
lương của test này, PayrollRun sinh RA 2 Expense (managerA 8tr + memberA
10tr), `findFirst` trả về không xác định (order Postgres không đảm bảo).
Sửa: đổi `findFirst` → `findMany` + `.find(e => amount === 8_000_000)`,
không giả định Expense DUY NHẤT của run.

Cả 3 sửa đã re-run toàn bộ `tsc`/`eslint`/`test`/`test:integration`/`next
build` — tất cả PASS trước khi chốt checkpoint này.

## BROWSER TESTS (3 journey bắt buộc)

**Journey A — Finance/Payment:** Sale CONFIRMED có sẵn từ Phần 5 → ghi nhận
Payment 300.000đ → Receivable derived giảm đúng → xuất hiện đúng trong
danh sách Thanh toán/Sổ cái ở `/finance`.

**Journey B — Payroll two-person-approval (đầy đủ vòng đời):** set lương
Trần Nhân Viên 8.500.000đ (`/payroll/profiles`, đây là journey phát hiện
bug effectiveFrom Lớp 1) → tạo PayrollRun tháng 10/2026 → Tính lương (đúng
số) → Duyệt kiểm tra → Xin chốt sổ (tạo ApprovalRequest) → Manager Duyệt
lần 1 → **live-test Manager tự Duyệt lần 2: bị chặn đúng lỗi hiển thị trên
UI** → đăng xuất, đăng nhập Founder (actor khác thật) → Founder Duyệt lần 2
thành công (ApprovalRequest APPROVED) → Chốt sổ → xác nhận Expense (category
Lương, 8.500.000đ) VÀ LedgerEntry (Trả lương, 8.500.000đ) tự động sinh đúng
qua trang `/finance` (cả 2 tab Chi phí và Sổ cái) → trang PayrollRun về
trạng thái cuối "Đã chốt sổ", không còn nút hành động nào.

**Journey C — Inventory two-person-approval:** tạo InventoryItem "Khẩu
trang y tế" + InventoryLocation "Kho chính Hồng Phúc" → Nhập kho 100 → Xuất
kho 20 (số dư đúng 80) → Gửi yêu cầu điều chỉnh giảm 5 → Founder tự
Duyệt lần 1 (người yêu cầu = người duyệt lần 1, hợp lệ vì bất biến chỉ chặn
lần-1-so-với-lần-2) → **live-test Founder tự Duyệt lần 2: bị chặn đúng lỗi
hiển thị trên UI (cùng bất biến với Payroll, dùng chung 1 hàm)** → đăng
xuất, đăng nhập Manager (actor khác thật) → Duyệt lần 2 thành công → trang
`/inventory/adjustments` hiện đúng nút "Thực thi điều chỉnh" (**live-verify
trực tiếp fix `getActionableStockAdjustmentRequests`** — request APPROVED
không còn biến mất khỏi danh sách) → Thực thi → request biến mất khỏi danh
sách, số dư kho cập nhật đúng 75 (100-20-5).

## FRESH DB TEST

Tạo database trống riêng (`tapdoan_fresh_test_part6`) → `prisma migrate
deploy` áp toàn bộ 7 migration sạch (Phần 3+4+5+6, 4 migration Phần 6) →
`bootstrap-founder` chạy thành công → xoá DB tạm. DB dev chính giữ nguyên
dữ liệu browser-test Phần 4+5+6.

## SECURITY RISKS (còn mở, kế thừa từ Phần 3/4/5, không phải HARD BLOCK)

1. `AuditEvent` chưa có DB-level trigger chống UPDATE/DELETE trực tiếp.
2. Không có session revocation list/tokenVersion.
3. `phoneHash` (SHA-256, không salt) trên keyspace SĐT VN nhỏ — chấp nhận
   cho MVP, cần salt/HMAC nếu Phần 7+ mở API/export dùng field này.
4. Composite FK/DB constraint cho Healthcare chưa áp dụng (domain đó chưa
   tồn tại) — nhắc Phần 7 không quên.
5. `LedgerEntry`/`StockMovement` bất biến ở tầng application, chưa có
   DB-level trigger chống UPDATE/DELETE trực tiếp (cùng loại rủi ro với mục
   1) — chấp nhận cho MVP, domain service là con đường ghi DUY NHẤT hiện
   tại (không có API/admin tool nào khác chạm DB trực tiếp).

## DEFERRED ITEMS

Invoice/hoá đơn điện tử, AccountsPayable, đa tiền tệ, kế toán kép
(ADR-035/033) · định giá tồn kho FIFO/LIFO, barcode/serial/lot tracking,
Purchase Order/Supplier (`INVENTORY.md`) · Healthcare Vertical (Phần 7) ·
Milestone/Checklist riêng cho Project (ADR-016, Phần 4) · OrganizationUnit
move/reparent UI · mọi mục deferred Phần 3/4/5 (Sales Opportunity, Customer
Merge, rule engine chiết khấu, "ẩn SĐT + lộ có audit" UI, ...).

## DO NOT REDO (bổ sung Phần 6, kế thừa toàn bộ danh sách Phần 3+4+5)

- Không viết bất kỳ hàm domain nào có pattern "đọc số dư/kiểm tra hợp lệ →
  ghi" trên tiền/kho mà KHÔNG khoá dòng liên quan bằng `SELECT...FOR UPDATE`
  bên trong `db.$transaction` trước khi đọc lại và xác minh — Postgres READ
  COMMITTED mặc định KHÔNG tự chặn race này (4 P0 thật của Phần 6 đều cùng
  1 root cause class).
- Không để bất kỳ wrapper approval nào (2-người-duyệt hay không) nhận
  `permission` như tham số truyền từ ngoài vào rồi chuyển tiếp cho
  `requireCompanyContextForActor` — luôn hardcode permission string ngay
  trong hàm.
- Không tính `PayrollItem.netAmount` bằng công thức viết tay ở bất kỳ nhánh
  nào (create hay update) — LUÔN gọi `calculatePayrollItemTotals`
  (`payroll-calc.ts`).
- Không truncate/so sánh ngày hiệu lực (`effectiveFrom`/`periodStart`/bất kỳ
  field ngày nào dùng để so sánh kỳ) bằng getter GIỜ ĐỊA PHƯƠNG
  (`getFullYear`/`getMonth`/`getDate`) — luôn dùng `getUTC*`/`Date.UTC`,
  nhất quán với cách `z.coerce.date()` parse date-only string thành UTC
  midnight. Đây chính là root cause của bug Lớp 2 (mục riêng ở trên).
  Regression test giữ nguyên: `tenant-isolation-part6.itest.ts` mục "Thiết
  lập PayrollProfile effective-dated".
- Không viết test integration `findFirst` không filter khi entity có thể có
  NHIỀU record hợp lệ cho cùng điều kiện query (đặc biệt trong file dùng
  `beforeAll` thay vì `beforeEach` — fixture bleed giữa các test là rủi ro
  thật, không phải lý thuyết) — dùng `findMany` + `.find()`/`.filter()` với
  điều kiện đủ để xác định đúng 1 bản ghi mong muốn.
- Không dùng `allocationBps`/công thức chia hoa hồng với `Math.round` cho
  MỌI phần — phần không phải cuối luôn `Math.floor`, chỉ phần cuối nhận
  phần dư, để bất biến `sum(allocations) === totalAmount` đúng bằng cấu
  trúc (`commission-calc.ts`).
- Không thêm 1 loại `StockMovement`/`LedgerEntry` mới mà `quantity`/`amount`
  có thể âm — chiều tăng/giảm LUÔN qua `type`/entity, không qua dấu số.
- Không dùng `request.id`/bất kỳ ID nội bộ nào làm `idempotencyKey` trực
  tiếp khi cột đó CHIA SẺ constraint với key client tự đặt — luôn thêm
  namespace prefix (vd `` `approval:${id}` ``) để tránh sabotage
  namespace-collision.
- Không gọi `getPendingApprovalRequests` (dùng chung cho mọi domain
  2-người-duyệt) để render UI "còn việc cần làm" nếu domain đó có bước
  thực thi SAU KHI đã APPROVED — hàm này cố tình không trả APPROVED (đúng
  cho Payroll, sai cho domain có bước thực thi riêng như Inventory). Viết
  hàm `getActionableXRequests` riêng nếu domain có bước thực thi sau duyệt.

## NEXT

Phần 7 — Healthcare Vertical + Legacy Clinic Parity. Xem
`docs/project/CURRENT_WAVE.md` để biết input đã sẵn sàng.
