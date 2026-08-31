// Tính tổng Sale — hàm thuần, không DB, không AI (mục LXXV/CCXXI: "Code
// First, AI Explains" — mọi phép tính tiền phải là code xác định, AI chỉ
// được giải thích kết quả đã tính sẵn, không bao giờ tự tính). Tiền VNĐ
// luôn là số nguyên (không có đơn vị lẻ hơn đồng) — dùng number nguyên,
// không dùng số thực để tránh lỗi làm tròn (mục LXXVI).

export type SaleLineInput = {
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
};

export type SaleTotals = {
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
};

export function calculateLineTotal(line: SaleLineInput): number {
  const gross = Math.round(line.quantity * line.unitPrice);
  const discount = Math.round(line.discountAmount ?? 0);
  return Math.max(0, gross - discount);
}

// Bất biến bắt buộc: subtotalAmount - discountAmount === totalAmount ===
// sum(calculateLineTotal(line)) — LUÔN đúng bằng cấu trúc, không phải nhờ
// Math.max ở tổng. Trước đây discountAmount cộng dồn SỐ THÔ từng dòng rồi
// mới clamp một lần ở cấp Sale, trong khi lineTotal từng dòng clamp RIÊNG —
// khi 1 dòng có discount vượt chính giá trị dòng đó, 2 cách tính lệch nhau
// (Sale.totalAmount có thể nhỏ hơn tổng thật của các SaleLine.lineTotal).
// Sửa bằng cách tính discountAmount = phần chiết khấu ĐÃ THỰC SỰ ÁP DỤNG
// (gross - lineTotal của chính dòng đó), không phải số đề nghị thô.
export function calculateSaleTotals(lines: SaleLineInput[]): SaleTotals {
  let subtotalAmount = 0;
  let discountAmount = 0;
  let totalAmount = 0;
  for (const line of lines) {
    const gross = Math.round(line.quantity * line.unitPrice);
    const lineTotal = calculateLineTotal(line);
    subtotalAmount += gross;
    discountAmount += gross - lineTotal;
    totalAmount += lineTotal;
  }
  return { subtotalAmount, discountAmount, totalAmount };
}
