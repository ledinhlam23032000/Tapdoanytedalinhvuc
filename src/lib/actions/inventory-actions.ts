"use server";

import { requireCurrentActor } from "@/lib/auth/current-actor";
import * as inventoryService from "@/lib/domain/inventory-service";

// Thin wrapper — xem sales-actions.ts (Phần 5) cho pattern gốc. KHÔNG trả
// thẳng object Prisma chứa Decimal (StockMovement.quantity) qua boundary
// Server->Client.

export async function createInventoryItemAction(input: Parameters<typeof inventoryService.createInventoryItem>[1]) {
  const actor = await requireCurrentActor();
  const item = await inventoryService.createInventoryItem(actor.id, input);
  return { id: item.id };
}

export async function updateInventoryItemAction(input: Parameters<typeof inventoryService.updateInventoryItem>[1]) {
  const actor = await requireCurrentActor();
  await inventoryService.updateInventoryItem(actor.id, input);
}

export async function createInventoryLocationAction(
  input: Parameters<typeof inventoryService.createInventoryLocation>[1],
) {
  const actor = await requireCurrentActor();
  const location = await inventoryService.createInventoryLocation(actor.id, input);
  return { id: location.id };
}

export async function receiveStockAction(input: Parameters<typeof inventoryService.receiveStock>[1]) {
  const actor = await requireCurrentActor();
  await inventoryService.receiveStock(actor.id, input);
}

export async function issueStockAction(input: Parameters<typeof inventoryService.issueStock>[1]) {
  const actor = await requireCurrentActor();
  await inventoryService.issueStock(actor.id, input);
}

export async function transferStockAction(input: Parameters<typeof inventoryService.transferStock>[1]) {
  const actor = await requireCurrentActor();
  await inventoryService.transferStock(actor.id, input);
}

export async function requestStockAdjustmentAction(
  input: Parameters<typeof inventoryService.requestStockAdjustment>[1],
) {
  const actor = await requireCurrentActor();
  const request = await inventoryService.requestStockAdjustment(actor.id, input);
  return { id: request.id };
}

export async function firstApproveStockAdjustmentAction(companyId: string, approvalRequestId: string) {
  const actor = await requireCurrentActor();
  await inventoryService.firstApproveStockAdjustment(actor.id, companyId, approvalRequestId);
}

export async function secondApproveStockAdjustmentAction(companyId: string, approvalRequestId: string) {
  const actor = await requireCurrentActor();
  await inventoryService.secondApproveStockAdjustment(actor.id, companyId, approvalRequestId);
}

export async function rejectStockAdjustmentAction(companyId: string, approvalRequestId: string) {
  const actor = await requireCurrentActor();
  await inventoryService.rejectStockAdjustment(actor.id, companyId, approvalRequestId);
}

export async function executeApprovedStockAdjustmentAction(
  input: Parameters<typeof inventoryService.executeApprovedStockAdjustment>[1],
) {
  const actor = await requireCurrentActor();
  await inventoryService.executeApprovedStockAdjustment(actor.id, input);
}
