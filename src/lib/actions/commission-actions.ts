"use server";

import { requireCurrentActor } from "@/lib/auth/current-actor";
import * as commissionService from "@/lib/domain/commission-service";

// Thin wrapper — xem sales-actions.ts (Phần 5) cho pattern gốc. KHÔNG trả
// thẳng object Prisma chứa Decimal qua boundary Server->Client.

export async function createCommissionRuleAction(input: Parameters<typeof commissionService.createCommissionRule>[1]) {
  const actor = await requireCurrentActor();
  const rule = await commissionService.createCommissionRule(actor.id, input);
  return { id: rule.id };
}

export async function updateCommissionRuleStatusAction(
  companyId: string,
  ruleId: string,
  status: Parameters<typeof commissionService.updateCommissionRuleStatus>[3],
) {
  const actor = await requireCurrentActor();
  await commissionService.updateCommissionRuleStatus(actor.id, companyId, ruleId, status);
}

export async function calculateCommissionForSaleAction(
  input: Parameters<typeof commissionService.calculateCommissionForSale>[1],
) {
  const actor = await requireCurrentActor();
  await commissionService.calculateCommissionForSale(actor.id, input);
}

export async function overrideCommissionCalculationAction(
  input: Parameters<typeof commissionService.overrideCommissionCalculation>[1],
) {
  const actor = await requireCurrentActor();
  await commissionService.overrideCommissionCalculation(actor.id, input);
}
