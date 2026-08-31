import { describe, expect, it } from "vitest";
import { calculateLineTotal, calculateSaleTotals } from "@/lib/domain/sale-totals";

describe("calculateLineTotal", () => {
  it("số lượng x đơn giá, trừ chiết khấu dòng", () => {
    expect(calculateLineTotal({ quantity: 2, unitPrice: 100_000, discountAmount: 20_000 })).toBe(180_000);
  });

  it("không có chiết khấu => lineTotal = quantity x unitPrice", () => {
    expect(calculateLineTotal({ quantity: 3, unitPrice: 50_000 })).toBe(150_000);
  });

  it("không cho lineTotal âm dù chiết khấu vượt quá giá trị dòng", () => {
    expect(calculateLineTotal({ quantity: 1, unitPrice: 10_000, discountAmount: 50_000 })).toBe(0);
  });
});

describe("calculateSaleTotals", () => {
  it("cộng đúng subtotal/discount/total qua nhiều dòng", () => {
    const totals = calculateSaleTotals([
      { quantity: 2, unitPrice: 100_000, discountAmount: 20_000 },
      { quantity: 1, unitPrice: 300_000 },
    ]);
    expect(totals).toEqual({ subtotalAmount: 500_000, discountAmount: 20_000, totalAmount: 480_000 });
  });

  it("Sale rỗng (chưa có dòng nào) trả về 0 cho mọi field", () => {
    expect(calculateSaleTotals([])).toEqual({ subtotalAmount: 0, discountAmount: 0, totalAmount: 0 });
  });

  it("tổng chiết khấu vượt subtotal vẫn chặn totalAmount ở 0, không âm", () => {
    const totals = calculateSaleTotals([{ quantity: 1, unitPrice: 100_000, discountAmount: 999_999 }]);
    expect(totals.totalAmount).toBe(0);
  });

  it("không có sai số dấu phẩy động qua nhiều dòng lẻ", () => {
    const totals = calculateSaleTotals([
      { quantity: 3, unitPrice: 33_333 },
      { quantity: 1, unitPrice: 1 },
    ]);
    expect(totals.subtotalAmount).toBe(99_999 + 1);
    expect(Number.isInteger(totals.subtotalAmount)).toBe(true);
  });

  // Regression: red-team review Phần 5 phát hiện thật — khi 1 dòng có
  // discountAmount vượt chính giá trị dòng đó, cách tính cũ cộng dồn
  // discount THÔ ở cấp Sale (chưa clamp) trong khi lineTotal từng dòng đã
  // clamp riêng, khiến totalAmount (60.000) lệch với tổng thật của các
  // SaleLine.lineTotal (100.000) — hoá đơn hiển thị sai. Bất biến bắt buộc:
  // subtotalAmount - discountAmount === totalAmount === sum(lineTotal), LUÔN
  // đúng, không phụ thuộc dữ liệu đầu vào.
  it("totalAmount luôn khớp đúng tổng lineTotal từng dòng, kể cả khi 1 dòng có discount vượt giá trị dòng đó", () => {
    const lines = [
      { quantity: 1, unitPrice: 10_000, discountAmount: 50_000 }, // discount vượt gross của chính dòng này
      { quantity: 1, unitPrice: 100_000 },
    ];
    const totals = calculateSaleTotals(lines);
    const sumOfLineTotals = lines.reduce((sum, line) => sum + calculateLineTotal(line), 0);

    expect(totals.totalAmount).toBe(sumOfLineTotals);
    expect(totals.totalAmount).toBe(100_000); // dòng 1 bị clamp về 0, dòng 2 giữ nguyên 100.000
    expect(totals.subtotalAmount - totals.discountAmount).toBe(totals.totalAmount);
  });

  it("bất biến subtotalAmount - discountAmount === totalAmount === sum(lineTotal) đúng với tập dòng ngẫu nhiên", () => {
    const lines = [
      { quantity: 2, unitPrice: 75_000, discountAmount: 10_000 },
      { quantity: 5, unitPrice: 1_000, discountAmount: 999_999 }, // discount vượt xa gross dòng này
      { quantity: 1, unitPrice: 250_000 },
      { quantity: 3, unitPrice: 0, discountAmount: 0 },
    ];
    const totals = calculateSaleTotals(lines);
    const sumOfLineTotals = lines.reduce((sum, line) => sum + calculateLineTotal(line), 0);

    expect(totals.totalAmount).toBe(sumOfLineTotals);
    expect(totals.subtotalAmount - totals.discountAmount).toBe(totals.totalAmount);
  });
});
