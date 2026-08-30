"use server";

import { requireCurrentActor } from "@/lib/auth/current-actor";
import * as workService from "@/lib/domain/work-service";

// Thin wrapper — xem organization-actions.ts. "now" của Hôm nay luôn lấy từ
// server (Date.now() thật), KHÔNG bao giờ nhận từ client — tránh client tự
// khai "hôm nay" giả để thao túng thứ tự ưu tiên.

export async function createWorkItemAction(input: Parameters<typeof workService.createWorkItem>[1]) {
  const actor = await requireCurrentActor();
  return workService.createWorkItem(actor.id, input);
}

export async function assignWorkItemAction(input: Parameters<typeof workService.assignWorkItem>[1]) {
  const actor = await requireCurrentActor();
  return workService.assignWorkItem(actor.id, input);
}

export async function startWorkItemAction(companyId: string, workItemId: string) {
  const actor = await requireCurrentActor();
  return workService.startWorkItem(actor.id, companyId, workItemId);
}

export async function completeWorkItemAction(companyId: string, workItemId: string) {
  const actor = await requireCurrentActor();
  return workService.completeWorkItem(actor.id, companyId, workItemId);
}

export async function cancelWorkItemAction(companyId: string, workItemId: string) {
  const actor = await requireCurrentActor();
  return workService.cancelWorkItem(actor.id, companyId, workItemId);
}
