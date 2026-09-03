# Payroll (Phần 6)

Một engine lương duy nhất cho toàn Company — không có engine lương riêng
theo team/chi nhánh, không port `ZWorkspacePayrollRun` của legacy (đã xác
minh qua grep trực tiếp legacy, không dùng làm mẫu thiết kế — xem
`ApprovalRequest` bên dưới).

## PayrollProfile — lương hiệu lực theo thời gian

`PayrollProfile` (companyId, userId, baseSalary, payType=MONTHLY,
effectiveFrom, effectiveTo) — đổi lương không update field cũ, tạo profile
mới với `effectiveFrom` mới, profile cũ tự đóng bằng `effectiveTo`.
`calculatePayrollRun` chọn đúng profile có hiệu lực tại `periodStart` của kỳ
lương.

**Bug thật đã sửa (phát hiện qua browser test, không phải review):**
`effectiveFrom` mặc định `new Date()` (timestamp chính xác giờ:phút:giây) có
thể MUỘN HƠN `periodStart` cùng ngày (parse từ date input = UTC 00:00) →
lương set cùng ngày kỳ lương bắt đầu bị loại khỏi kỳ đó một cách âm thầm.
Sửa: `effectiveFrom` mặc định transform về đầu ngày giờ local
(`new Date(y, m, d)`), không dùng timestamp chính xác hiện tại.

## PayrollRun — vòng đời 5 trạng thái

`DRAFT → CALCULATED → APPROVED → FINALIZED`, hoặc `→ VOIDED` từ bất kỳ
trạng thái nào trước FINALIZED. Không có trạng thái phụ nào khác.
`@@unique([companyId, periodStart, periodEnd])` — không thể tạo 2 kỳ lương
trùng khoảng thời gian.

- **DRAFT → CALCULATED** (`calculatePayrollRun`) — tính `PayrollItem` cho
  mọi thành viên có `PayrollProfile` hiệu lực trong kỳ, cộng
  `CommissionCalculation` chưa gán kỳ nào (xem `COMMISSION.md`). **P0 fix**:
  khoá dòng `PayrollRun` (`SELECT...FOR UPDATE`) + xác minh lại status
  DRAFT bên trong transaction trước khi ghi — chặn race 2 lần tính đồng
  thời tạo `PayrollItem` trùng/lệch.
- **CALCULATED → APPROVED** (`approvePayrollRun`) — duyệt kiểm tra 1 người,
  KHÔNG cần 2 người (rủi ro thấp hơn Finalize — chỉ xác nhận số đã đúng,
  chưa phát sinh nghĩa vụ chi tiền thật).
- **APPROVED → FINALIZED** (`finalizePayrollRun`) — **bắt buộc 2 người duyệt
  qua `ApprovalRequest`** (xem dưới) trước khi gọi được. Tạo `Expense`
  (category `SALARY`, sourceType `PAYROLL_RUN`) + `LedgerEntry`
  (type `SALARY_PAYMENT`) cho TỪNG `PayrollItem`, atomic trong 1
  transaction. **P0 fix**: toàn bộ thân hàm di chuyển vào trong transaction,
  khoá dòng `PayrollRun`, đọc lại + xác minh lại cả status VÀ
  `ApprovalRequest` (chống 1 request cũ bị tái dùng) bên trong khoá — chặn
  race chi lương 2 lần cho cùng 1 kỳ.
- **→ VOIDED** (`voidPayrollRun`, mọi trạng thái trước FINALIZED) — huỷ kỳ
  lương, không xoá. FINALIZED không thể VOIDED (đã chi tiền thật, sửa sai
  ở đây thuộc phạm vi Ledger correction, không phải void PayrollRun).

## Two-person approval — `ApprovalRequest` (ADR-028)

Nguyên mẫu thiết kế theo `AssistantApproval` (legacy, đã verify bằng grep
trực tiếp — `web/src/app/(app)/tro-ly/agent.ts` — có implementation duyệt-2-
người thật đang chạy), KHÔNG theo `ZWorkspacePayrollRun` (dual-field pattern
chưa xác minh chạy thật). Model dùng chung cho Payroll Finalize VÀ Inventory
Adjustment (`INVENTORY.md`) — status
`PENDING → PENDING_SECOND → APPROVED/REJECTED/EXPIRED`, 1 field
`firstApprovedByUserId` duy nhất.

**Bất biến cốt lõi** (`secondApproveRequest`,
`src/lib/domain/approval-service.ts:122`):
`if (request.firstApprovedByUserId === actor.id) throw AuthorizationError`
— người duyệt lần 2 PHẢI khác người duyệt lần 1. Đã live-verify 2 lần qua
browser thật (Payroll + Inventory, 2 domain độc lập dùng chung 1 hàm) —
click "Duyệt lần 2" bằng đúng actor vừa duyệt lần 1 bị chặn với lỗi hiển thị
trên UI, không phải chỉ pass ở test.

**Chỉ 2 phạm vi bắt buộc 2-người** (ADR-029, phạm vi cố tình hẹp — không mở
rộng ra Payment void/Ledger correction/Commission override, những hành động
đó dùng single-approver + reason + audit là đủ):
`PayrollRun.finalize`, Inventory `ADJUSTMENT` (không phải `RECEIVE`/`ISSUE`/
`TRANSFER`).

## Wrapper functions — permission luôn hardcode server-side (bug tự phát
hiện, sửa trước khi tới review)

`firstApprovePayrollFinalize`/`secondApprovePayrollFinalize`/
`rejectPayrollFinalize` hardcode `"payroll.manage"` — KHÔNG BAO GIỜ nhận
`permission` như tham số client-truyền-vào rồi chuyển thẳng cho
`requireCompanyContextForActor`. Đây là lỗ hổng leo thang quyền tự phát hiện
(client có thể gửi bất kỳ permission string nào nếu code nhận tham số đó từ
ngoài) — áp dụng nguyên tắc này cho MỌI wrapper approval tương lai.

## PayrollItem — netAmount luôn qua hàm thuần (P0 fix)

`calculatePayrollItemTotals` (`payroll-calc.ts`, pure, unit test riêng) —
`netAmount = max(0, base + commission + bonus - deduction)`. **Bug thật đã
sửa**: nhánh `update` của `payrollItem.upsert` từng cộng tay
`baseAmount + commissionAmount` mà quên `bonusAmount`/`deductionAmount` hiện
có → điều chỉnh lương lần 2 làm mất điều chỉnh lần 1. Sửa: cả nhánh
`create` và `update` đều gọi `calculatePayrollItemTotals`, không viết công
thức tay ở bất kỳ đâu khác.

## adjustPayrollItem — chỉ khi còn sửa được

Chỉ cho phép khi `PayrollRun.status` là `DRAFT`/`CALCULATED` (page.tsx tự
gate điều kiện render form) — sau `APPROVED` không còn sửa từng dòng, phải
Void cả kỳ nếu sai.

## Salary history — qua PayrollProfile, không bảng riêng

Lịch sử tăng/giảm lương đọc trực tiếp từ danh sách `PayrollProfile` theo
`userId` sắp theo `effectiveFrom` — không cần bảng `SalaryHistory` riêng.

## Audit

Danh sách đóng: `PAYROLL_PROFILE_SET`, `PAYROLL_RUN_CREATED/CALCULATED/
APPROVED/VOIDED/FINALIZE_REQUESTED/FINALIZE_FIRST_APPROVED/
FINALIZE_SECOND_APPROVED/FINALIZE_REJECTED/FINALIZED`,
`PAYROLL_ITEM_ADJUSTED`.
