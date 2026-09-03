import { describe, expect, it } from "vitest";
import { calculatePayrollItemTotals } from "@/lib/domain/payroll-calc";

describe("calculatePayrollItemTotals", () => {
  it("cộng base + commission + bonus - deduction", () => {
    const totals = calculatePayrollItemTotals({
      baseAmount: 10_000_000,
      commissionAmount: 2_000_000,
      bonusAmount: 500_000,
      deductionAmount: 300_000,
    });
    expect(totals).toEqual({
      baseAmount: 10_000_000,
      commissionAmount: 2_000_000,
      bonusAmount: 500_000,
      deductionAmount: 300_000,
      netAmount: 12_200_000,
    });
  });

  it("chỉ có baseAmount, các field khác mặc định 0", () => {
    const totals = calculatePayrollItemTotals({ baseAmount: 8_000_000 });
    expect(totals.netAmount).toBe(8_000_000);
  });

  it("deduction vượt quá base+commission+bonus vẫn chặn netAmount ở 0, không âm", () => {
    const totals = calculatePayrollItemTotals({
      baseAmount: 1_000_000,
      deductionAmount: 5_000_000,
    });
    expect(totals.netAmount).toBe(0);
  });

  it("làm tròn số nguyên VND cho mọi field đầu vào lẻ", () => {
    const totals = calculatePayrollItemTotals({
      baseAmount: 10_000_000.4,
      commissionAmount: 999_999.6,
    });
    expect(Number.isInteger(totals.baseAmount)).toBe(true);
    expect(Number.isInteger(totals.commissionAmount)).toBe(true);
    expect(Number.isInteger(totals.netAmount)).toBe(true);
  });
});
