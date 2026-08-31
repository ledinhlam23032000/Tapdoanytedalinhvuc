"use server";

import { requireCurrentActor } from "@/lib/auth/current-actor";
import * as customerService from "@/lib/domain/customer-service";

// Thin wrapper — xem organization-actions.ts (Phần 4) cho pattern gốc.

export async function findPossibleDuplicateCustomersAction(companyId: string, phoneRaw: string) {
  const actor = await requireCurrentActor();
  return customerService.findPossibleDuplicateCustomers(actor.id, companyId, phoneRaw);
}

export async function createCustomerAction(input: Parameters<typeof customerService.createCustomer>[1]) {
  const actor = await requireCurrentActor();
  return customerService.createCustomer(actor.id, input);
}

export async function updateCustomerAction(input: Parameters<typeof customerService.updateCustomer>[1]) {
  const actor = await requireCurrentActor();
  return customerService.updateCustomer(actor.id, input);
}

export async function assignCustomerOwnerAction(input: Parameters<typeof customerService.assignCustomerOwner>[1]) {
  const actor = await requireCurrentActor();
  return customerService.assignCustomerOwner(actor.id, input);
}

export async function archiveCustomerAction(companyId: string, customerId: string) {
  const actor = await requireCurrentActor();
  return customerService.archiveCustomer(actor.id, companyId, customerId);
}

export async function restoreCustomerAction(companyId: string, customerId: string) {
  const actor = await requireCurrentActor();
  return customerService.restoreCustomer(actor.id, companyId, customerId);
}

export async function recordCustomerInteractionAction(
  input: Parameters<typeof customerService.recordCustomerInteraction>[1],
) {
  const actor = await requireCurrentActor();
  return customerService.recordCustomerInteraction(actor.id, input);
}
