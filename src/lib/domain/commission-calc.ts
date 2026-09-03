// Tính hoa hồng thuần — DB-free, AI-free. 3 loại rule đóng (ADR-030), KHÔNG
// phải rule engine JSON tổng quát kiểu ZMechanismVersion.
//
// allocateCommissionAmount là fix trực tiếp cho bug thật đã xảy ra ở
// legacy (getStaffPerformance() cộng độc lập consultRevenue + doctorRevenue
// cho cùng 1 người → double-count, xem FINANCE-DEFINITIONS.md và ADR-030):
// bằng cách bắt buộc allocationBps của mọi contributor trên CÙNG 1 Sale
// PHẢI được khai báo tường minh và tổng KHÔNG ĐƯỢC vượt quá 10_000 (100%),
// một người giữ 2 vai trò phải chia % rõ ràng (vd 60%/40%) thay vì mỗi vai
// trò tự tính 100% rồi cộng dồn ngầm định.

export type CommissionRuleType = "PERCENTAGE_OF_SALE" | "FIXED_PER_ITEM" | "TIERED_THRESHOLD";

export type PercentageOfSaleConfig = { percentageBps: number };
export type FixedPerItemConfig = { amountPerItem: number };
export type TieredThresholdTier = { minAmount: number; bps: number };
export type TieredThresholdConfig = { tiers: TieredThresholdTier[] };

export type CommissionRuleConfig = PercentageOfSaleConfig | FixedPerItemConfig | TieredThresholdConfig;

export type SaleCommissionContext = {
  saleTotalAmount: number;
  totalQuantity: number;
};

export function calculateCommissionBaseAmount(
  type: CommissionRuleType,
  config: CommissionRuleConfig,
  sale: SaleCommissionContext,
): number {
  if (type === "PERCENTAGE_OF_SALE") {
    const { percentageBps } = config as PercentageOfSaleConfig;
    return Math.round((sale.saleTotalAmount * percentageBps) / 10_000);
  }
  if (type === "FIXED_PER_ITEM") {
    const { amountPerItem } = config as FixedPerItemConfig;
    return Math.round(sale.totalQuantity * amountPerItem);
  }
  // TIERED_THRESHOLD — áp dụng bps của tier cao nhất mà saleTotalAmount đạt tới
  // (không phải bracket tích luỹ từng nấc — đơn giản hoá cố ý, chưa có bằng
  // chứng nghiệp vụ đòi hỏi bracket tích luỹ).
  const { tiers } = config as TieredThresholdConfig;
  const sorted = [...tiers].sort((a, b) => a.minAmount - b.minAmount);
  let bps = 0;
  for (const tier of sorted) {
    if (sale.saleTotalAmount >= tier.minAmount) bps = tier.bps;
  }
  return Math.round((sale.saleTotalAmount * bps) / 10_000);
}

export type CommissionAllocationInput = {
  userId: string;
  role: string;
  allocationBps: number;
};

export type CommissionAllocationResult = CommissionAllocationInput & { amount: number };

export class CommissionAllocationOverflowError extends Error {
  constructor(totalBps: number) {
    super(`Tổng allocationBps (${totalBps}) vượt quá 10000 (100%) — có contributor bị double-count.`);
    this.name = "CommissionAllocationOverflowError";
  }
}

// Chia totalAmount cho các contributor theo allocationBps — phần dư làm
// tròn gán cho contributor CUỐI CÙNG theo thứ tự ổn định (đúng quy tắc
// "remainder-to-last" đã salvage từ FINANCE-DEFINITIONS.md), để tổng
// amount luôn khớp tuyệt đối totalAmount, không lệch do làm tròn từng phần.
export function allocateCommissionAmount(
  totalAmount: number,
  allocations: CommissionAllocationInput[],
): CommissionAllocationResult[] {
  const totalBps = allocations.reduce((sum, a) => sum + a.allocationBps, 0);
  if (totalBps > 10_000) {
    throw new CommissionAllocationOverflowError(totalBps);
  }
  if (allocations.length === 0) return [];

  const total = Math.round(totalAmount);
  let assigned = 0;
  // Math.floor (không phải Math.round) cho mọi phần tử KHÔNG PHẢI cuối —
  // bất biến "tổng luôn khớp tuyệt đối totalAmount" (comment trên) chỉ
  // đúng thật sự nếu assigned không bao giờ vượt total trước khi tới phần
  // tử cuối. Math.round có thể làm tròn .5 lên (vd 4 người 25% của
  // totalAmount=2 → mỗi người round(0.5)=1, 3 người đầu đã =3 > 2, phần tử
  // cuối bị Math.max(0,...) clamp về 0 một cách ÂM THẦM, tổng thực tế = 3
  // ≠ 2). floor() đảm bảo sum(non-last) <= total*(sum bps)/10000 <= total
  // luôn đúng, phần tử cuối nhận đúng phần còn lại không bao giờ âm.
  const results: CommissionAllocationResult[] = allocations.map((a, index) => {
    if (index === allocations.length - 1) {
      return { ...a, amount: Math.max(0, total - assigned) };
    }
    const amount = Math.floor((total * a.allocationBps) / 10_000);
    assigned += amount;
    return { ...a, amount };
  });
  return results;
}
