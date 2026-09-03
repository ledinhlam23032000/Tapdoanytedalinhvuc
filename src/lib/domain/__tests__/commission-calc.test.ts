import { describe, expect, it } from "vitest";
import {
  allocateCommissionAmount,
  calculateCommissionBaseAmount,
  CommissionAllocationOverflowError,
} from "@/lib/domain/commission-calc";

describe("calculateCommissionBaseAmount", () => {
  it("PERCENTAGE_OF_SALE: 5% của 10.000.000đ = 500.000đ", () => {
    const amount = calculateCommissionBaseAmount(
      "PERCENTAGE_OF_SALE",
      { percentageBps: 500 },
      { saleTotalAmount: 10_000_000, totalQuantity: 1 },
    );
    expect(amount).toBe(500_000);
  });

  it("FIXED_PER_ITEM: 50.000đ x 3 sản phẩm = 150.000đ", () => {
    const amount = calculateCommissionBaseAmount(
      "FIXED_PER_ITEM",
      { amountPerItem: 50_000 },
      { saleTotalAmount: 1_000_000, totalQuantity: 3 },
    );
    expect(amount).toBe(150_000);
  });

  it("TIERED_THRESHOLD: áp dụng bps của tier cao nhất đạt tới", () => {
    const config = {
      tiers: [
        { minAmount: 0, bps: 200 },
        { minAmount: 5_000_000, bps: 400 },
        { minAmount: 20_000_000, bps: 700 },
      ],
    };
    expect(
      calculateCommissionBaseAmount("TIERED_THRESHOLD", config, { saleTotalAmount: 1_000_000, totalQuantity: 1 }),
    ).toBe(20_000); // tier 200bps
    expect(
      calculateCommissionBaseAmount("TIERED_THRESHOLD", config, { saleTotalAmount: 10_000_000, totalQuantity: 1 }),
    ).toBe(400_000); // tier 400bps
    expect(
      calculateCommissionBaseAmount("TIERED_THRESHOLD", config, { saleTotalAmount: 25_000_000, totalQuantity: 1 }),
    ).toBe(1_750_000); // tier 700bps
  });
});

describe("allocateCommissionAmount", () => {
  // Regression: bug thật đã xảy ra ở legacy (FINANCE-DEFINITIONS.md) — 1
  // người vừa là consultant vừa là doctor của cùng 1 case 48.000.000đ,
  // getStaffPerformance() cộng ĐỘC LẬP consultRevenue+doctorRevenue →
  // double-count ra 96.000.000đ. allocateCommissionAmount bắt buộc
  // allocationBps tường minh theo từng contributor, tổng không vượt 10000.
  it("case 48.000.000đ, consultant 60%/doctor 40% → 28.800.000/19.200.000", () => {
    const results = allocateCommissionAmount(48_000_000, [
      { userId: "consultant-1", role: "CONSULTANT", allocationBps: 6_000 },
      { userId: "doctor-1", role: "DOCTOR", allocationBps: 4_000 },
    ]);
    expect(results).toEqual([
      { userId: "consultant-1", role: "CONSULTANT", allocationBps: 6_000, amount: 28_800_000 },
      { userId: "doctor-1", role: "DOCTOR", allocationBps: 4_000, amount: 19_200_000 },
    ]);
    const sum = results.reduce((s, r) => s + r.amount, 0);
    expect(sum).toBe(48_000_000);
  });

  it("1 người giữ 2 vai trò trên cùng 1 Sale: tổng allocationBps vẫn phải =100%, không double-count", () => {
    // Người này là contributor DUY NHẤT với 2 dòng vai trò (consultant +
    // doctor) — tổng allocationBps của 2 dòng cộng lại vẫn phải <=10000,
    // không phải mỗi dòng tự nhận 100% rồi cộng dồn thành 200%.
    const results = allocateCommissionAmount(48_000_000, [
      { userId: "same-person", role: "CONSULTANT", allocationBps: 6_000 },
      { userId: "same-person", role: "DOCTOR", allocationBps: 4_000 },
    ]);
    const sum = results.reduce((s, r) => s + r.amount, 0);
    expect(sum).toBe(48_000_000); // KHÔNG phải 96.000.000 (double-count)
  });

  it("ném lỗi khi tổng allocationBps vượt quá 10000 (bug double-count tái diễn)", () => {
    expect(() =>
      allocateCommissionAmount(48_000_000, [
        { userId: "consultant-1", role: "CONSULTANT", allocationBps: 10_000 },
        { userId: "doctor-1", role: "DOCTOR", allocationBps: 10_000 },
      ]),
    ).toThrow(CommissionAllocationOverflowError);
  });

  it("case 3 người 33.33/33.33/33.34% → tổng khớp tuyệt đối sau rounding, phần dư gán người cuối", () => {
    const results = allocateCommissionAmount(9_000_000, [
      { userId: "a", role: "R", allocationBps: 3_333 },
      { userId: "b", role: "R", allocationBps: 3_333 },
      { userId: "c", role: "R", allocationBps: 3_334 },
    ]);
    const sum = results.reduce((s, r) => s + r.amount, 0);
    expect(sum).toBe(9_000_000);
  });

  it("mảng contributor rỗng trả về mảng rỗng", () => {
    expect(allocateCommissionAmount(1_000_000, [])).toEqual([]);
  });

  // Regression: red-team review Phần 6 phát hiện thật (verify bằng cách
  // chạy code thật, không chỉ suy luận) — Math.round cho phần tử không-cuối
  // có thể làm tròn .5 lên, khiến assigned vượt total TRƯỚC khi tới phần tử
  // cuối, và Math.max(0, total-assigned) clamp về 0 một cách ÂM THẦM thay
  // vì báo lỗi — tổng thực tế lệch khỏi totalAmount. 4 người 25% của
  // totalAmount=2: round(0.5)=1 cho 3 người đầu (=3) đã vượt total=2.
  it("4 người 25% mỗi người trên totalAmount lẻ: tổng vẫn khớp tuyệt đối (không overshoot do làm tròn .5)", () => {
    const results = allocateCommissionAmount(2, [
      { userId: "a", role: "R", allocationBps: 2_500 },
      { userId: "b", role: "R", allocationBps: 2_500 },
      { userId: "c", role: "R", allocationBps: 2_500 },
      { userId: "d", role: "R", allocationBps: 2_500 },
    ]);
    const sum = results.reduce((s, r) => s + r.amount, 0);
    expect(sum).toBe(2);
  });
});
