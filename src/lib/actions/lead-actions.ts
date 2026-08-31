"use server";

import { requireCurrentActor } from "@/lib/auth/current-actor";
import * as leadService from "@/lib/domain/lead-service";

// Thin wrapper — xem organization-actions.ts (Phần 4) cho pattern gốc.

export async function createLeadAction(input: Parameters<typeof leadService.createLead>[1]) {
  const actor = await requireCurrentActor();
  return leadService.createLead(actor.id, input);
}

export async function assignLeadOwnerAction(input: Parameters<typeof leadService.assignLeadOwner>[1]) {
  const actor = await requireCurrentActor();
  return leadService.assignLeadOwner(actor.id, input);
}

export async function convertLeadAction(companyId: string, leadId: string) {
  const actor = await requireCurrentActor();
  return leadService.convertLead(actor.id, companyId, leadId);
}
