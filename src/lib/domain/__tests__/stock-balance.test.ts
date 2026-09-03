import { describe, expect, it } from "vitest";
import { calculateStockBalance, movementSign, wouldResultInNegativeBalance } from "@/lib/domain/stock-balance";

describe("movementSign", () => {
  it("IN/ADJUSTMENT_IN/TRANSFER_IN mang dấu dương", () => {
    expect(movementSign("IN")).toBe(1);
    expect(movementSign("ADJUSTMENT_IN")).toBe(1);
    expect(movementSign("TRANSFER_IN")).toBe(1);
  });

  it("OUT/ADJUSTMENT_OUT/TRANSFER_OUT mang dấu âm", () => {
    expect(movementSign("OUT")).toBe(-1);
    expect(movementSign("ADJUSTMENT_OUT")).toBe(-1);
    expect(movementSign("TRANSFER_OUT")).toBe(-1);
  });
});

describe("calculateStockBalance", () => {
  it("cộng dồn đúng chuỗi movement hỗn hợp", () => {
    const balance = calculateStockBalance([
      { type: "IN", quantity: 100 },
      { type: "OUT", quantity: 30 },
      { type: "ADJUSTMENT_OUT", quantity: 5 },
      { type: "TRANSFER_IN", quantity: 20 },
      { type: "TRANSFER_OUT", quantity: 10 },
    ]);
    expect(balance).toBe(75);
  });

  it("không có movement nào => số dư 0", () => {
    expect(calculateStockBalance([])).toBe(0);
  });
});

describe("wouldResultInNegativeBalance", () => {
  it("chặn OUT vượt quá số dư hiện tại", () => {
    expect(wouldResultInNegativeBalance(10, { type: "OUT", quantity: 15 })).toBe(true);
  });

  it("cho phép OUT trong giới hạn số dư", () => {
    expect(wouldResultInNegativeBalance(10, { type: "OUT", quantity: 10 })).toBe(false);
  });

  it("IN không bao giờ gây âm kho", () => {
    expect(wouldResultInNegativeBalance(0, { type: "IN", quantity: 1000 })).toBe(false);
  });
});
