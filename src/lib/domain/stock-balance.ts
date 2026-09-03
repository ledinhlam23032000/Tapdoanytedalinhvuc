// Tồn kho thuần — DB-free. StockMovement.quantity LUÔN dương; chiều
// nhập/xuất suy từ `type` qua movementSign(), KHÔNG dùng số có dấu (ADR-032).
// Số dư KHÔNG có cột lưu trữ — luôn derive bằng cách cộng dồn
// movementSign(type) * quantity qua toàn bộ StockMovement (ADR-031).

export type StockMovementType = "IN" | "OUT" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "TRANSFER_IN" | "TRANSFER_OUT";

export function movementSign(type: StockMovementType): 1 | -1 {
  return type === "OUT" || type === "TRANSFER_OUT" || type === "ADJUSTMENT_OUT" ? -1 : 1;
}

export type StockMovementLike = { type: StockMovementType; quantity: number };

export function calculateStockBalance(movements: StockMovementLike[]): number {
  return movements.reduce((balance, m) => balance + movementSign(m.type) * m.quantity, 0);
}

// Preview số dư sau khi áp 1 movement mới — dùng để chặn âm kho trước khi
// ghi (ADR-031).
export function wouldResultInNegativeBalance(currentBalance: number, movement: StockMovementLike): boolean {
  return currentBalance + movementSign(movement.type) * movement.quantity < 0;
}
