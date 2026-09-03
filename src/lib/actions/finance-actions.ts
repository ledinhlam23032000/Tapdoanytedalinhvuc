"use server";

import { requireCurrentActor } from "@/lib/auth/current-actor";
import * as financeService from "@/lib/domain/finance-service";

// Thin wrapper — xem sales-actions.ts (Phần 5) cho pattern gốc. KHÔNG trả
// thẳng object Prisma chứa Decimal (Payment/Expense/LedgerEntry đều có) qua
// boundary Server->Client — chỉ trả { id } khi caller thực sự cần redirect,
// còn lại không trả gì (caller chỉ router.refresh()).

export async function recordPaymentAction(input: Parameters<typeof financeService.recordPayment>[1]) {
  const actor = await requireCurrentActor();
  const payment = await financeService.recordPayment(actor.id, input);
  return { id: payment.id };
}

export async function voidPaymentAction(companyId: string, paymentId: string, reason: string) {
  const actor = await requireCurrentActor();
  await financeService.voidPayment(actor.id, companyId, paymentId, reason);
}

export async function recordExpenseAction(input: Parameters<typeof financeService.recordExpense>[1]) {
  const actor = await requireCurrentActor();
  const expense = await financeService.recordExpense(actor.id, input);
  return { id: expense.id };
}

export async function voidExpenseAction(companyId: string, expenseId: string, reason: string) {
  const actor = await requireCurrentActor();
  await financeService.voidExpense(actor.id, companyId, expenseId, reason);
}

export async function createLedgerCorrectionAction(input: Parameters<typeof financeService.createLedgerCorrection>[1]) {
  const actor = await requireCurrentActor();
  await financeService.createLedgerCorrection(actor.id, input);
}
