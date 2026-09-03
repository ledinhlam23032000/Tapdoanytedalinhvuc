// Tính lương thuần — DB-free, AI-free (mục V "CODE COMPUTES — AI EXPLAINS").
// Cùng nguyên tắc sale-totals.ts Phần 5: mọi công thức tiền có unit test
// riêng, service gọi thẳng hàm này thay vì viết lại công thức tay (đây
// chính là root cause bug tiền Phần 5 — xem RED_TEAM_CODE_REVIEW_PART5.md).

export type PayrollItemInput = {
  baseAmount: number;
  commissionAmount?: number;
  bonusAmount?: number;
  deductionAmount?: number;
};

export type PayrollItemTotals = {
  baseAmount: number;
  commissionAmount: number;
  bonusAmount: number;
  deductionAmount: number;
  netAmount: number;
};

export function calculatePayrollItemTotals(input: PayrollItemInput): PayrollItemTotals {
  const baseAmount = Math.round(input.baseAmount);
  const commissionAmount = Math.round(input.commissionAmount ?? 0);
  const bonusAmount = Math.round(input.bonusAmount ?? 0);
  const deductionAmount = Math.round(input.deductionAmount ?? 0);
  const netAmount = Math.max(0, baseAmount + commissionAmount + bonusAmount - deductionAmount);
  return { baseAmount, commissionAmount, bonusAmount, deductionAmount, netAmount };
}
