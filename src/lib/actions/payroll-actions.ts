"use server";

import { requireCurrentActor } from "@/lib/auth/current-actor";
import * as payrollService from "@/lib/domain/payroll-service";

// Thin wrapper — xem sales-actions.ts (Phần 5) cho pattern gốc. KHÔNG trả
// thẳng object Prisma chứa Decimal qua boundary Server->Client.

export async function setPayrollProfileAction(input: Parameters<typeof payrollService.setPayrollProfile>[1]) {
  const actor = await requireCurrentActor();
  await payrollService.setPayrollProfile(actor.id, input);
}

export async function createPayrollRunAction(input: Parameters<typeof payrollService.createPayrollRun>[1]) {
  const actor = await requireCurrentActor();
  const run = await payrollService.createPayrollRun(actor.id, input);
  return { id: run.id };
}

export async function calculatePayrollRunAction(companyId: string, payrollRunId: string) {
  const actor = await requireCurrentActor();
  await payrollService.calculatePayrollRun(actor.id, companyId, payrollRunId);
}

export async function approvePayrollRunAction(companyId: string, payrollRunId: string) {
  const actor = await requireCurrentActor();
  await payrollService.approvePayrollRun(actor.id, companyId, payrollRunId);
}

export async function requestPayrollFinalizeAction(companyId: string, payrollRunId: string, reason: string) {
  const actor = await requireCurrentActor();
  const request = await payrollService.requestPayrollFinalize(actor.id, companyId, payrollRunId, reason);
  return { id: request.id };
}

export async function firstApprovePayrollFinalizeAction(companyId: string, approvalRequestId: string) {
  const actor = await requireCurrentActor();
  await payrollService.firstApprovePayrollFinalize(actor.id, companyId, approvalRequestId);
}

export async function secondApprovePayrollFinalizeAction(companyId: string, approvalRequestId: string) {
  const actor = await requireCurrentActor();
  await payrollService.secondApprovePayrollFinalize(actor.id, companyId, approvalRequestId);
}

export async function rejectPayrollFinalizeAction(companyId: string, approvalRequestId: string) {
  const actor = await requireCurrentActor();
  await payrollService.rejectPayrollFinalize(actor.id, companyId, approvalRequestId);
}

export async function finalizePayrollRunAction(companyId: string, payrollRunId: string, approvalRequestId: string) {
  const actor = await requireCurrentActor();
  await payrollService.finalizePayrollRun(actor.id, companyId, payrollRunId, approvalRequestId);
}

export async function voidPayrollRunAction(companyId: string, payrollRunId: string, reason: string) {
  const actor = await requireCurrentActor();
  await payrollService.voidPayrollRun(actor.id, companyId, payrollRunId, reason);
}

export async function adjustPayrollItemAction(input: Parameters<typeof payrollService.adjustPayrollItem>[1]) {
  const actor = await requireCurrentActor();
  await payrollService.adjustPayrollItem(actor.id, input);
}
