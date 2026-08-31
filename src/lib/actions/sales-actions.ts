"use server";

import { requireCurrentActor } from "@/lib/auth/current-actor";
import * as salesService from "@/lib/domain/sales-service";

// Thin wrapper — xem organization-actions.ts (Phần 4) cho pattern gốc.

// Ghi chú: Sale/SaleLine dùng Prisma Decimal cho các field tiền. Decimal là
// class instance, không phải plain object — React Server Action không thể
// serialize nó qua boundary Server->Client (lỗi "Only plain objects can be
// passed..."). Vì vậy các action dưới đây KHÔNG trả thẳng object Prisma trả
// về; chỉ trả phần dữ liệu thuần (string id) mà phía client thực sự dùng.

export async function createCatalogItemAction(input: Parameters<typeof salesService.createCatalogItem>[1]) {
  const actor = await requireCurrentActor();
  await salesService.createCatalogItem(actor.id, input);
}

export async function updateCatalogItemAction(input: Parameters<typeof salesService.updateCatalogItem>[1]) {
  const actor = await requireCurrentActor();
  await salesService.updateCatalogItem(actor.id, input);
}

export async function createSaleAction(input: Parameters<typeof salesService.createSale>[1]) {
  const actor = await requireCurrentActor();
  const sale = await salesService.createSale(actor.id, input);
  return { id: sale.id };
}

export async function updateDraftSaleAction(input: Parameters<typeof salesService.updateDraftSale>[1]) {
  const actor = await requireCurrentActor();
  await salesService.updateDraftSale(actor.id, input);
}

export async function confirmSaleAction(companyId: string, saleId: string) {
  const actor = await requireCurrentActor();
  await salesService.confirmSale(actor.id, companyId, saleId);
}

export async function cancelSaleAction(companyId: string, saleId: string) {
  const actor = await requireCurrentActor();
  await salesService.cancelSale(actor.id, companyId, saleId);
}
