"use server";

import { requireCurrentActor } from "@/lib/auth/current-actor";
import * as moduleService from "@/lib/domain/healthcare/module-service";
import * as caseService from "@/lib/domain/healthcare/medical-case-service";
import * as consultationService from "@/lib/domain/healthcare/consultation-service";
import * as procedureService from "@/lib/domain/healthcare/procedure-service";
import * as consentService from "@/lib/domain/healthcare/consent-service";
import * as photoService from "@/lib/domain/healthcare/clinical-photo-service";
import * as followUpService from "@/lib/domain/healthcare/followup-service";

// Thin wrapper — pattern gốc ở sales-actions.ts (Phần 5).
//
// KHÔNG trả thẳng object Prisma qua boundary Server->Client: Procedure và
// ProcedureMaterialUsage có field Decimal (quantity), Next.js RSC không
// serialize được (bug thật đã trả giá ở Phần 5). Chỉ trả {id} hoặc void.
//
// Mọi kiểm tra quyền + cổng module nằm ở domain service, KHÔNG ở đây — file
// này không được tự quyết định gì (bất biến #100: authorization enforce ở
// server action/domain, không phụ thuộc việc UI ẩn control).

// ===== Module + permission pack =====

export async function enableHealthcareModuleAction(input: Parameters<typeof moduleService.enableCompanyModule>[1]) {
  const actor = await requireCurrentActor();
  await moduleService.enableCompanyModule(actor.id, input);
}

export async function disableHealthcareModuleAction(input: Parameters<typeof moduleService.disableCompanyModule>[1]) {
  const actor = await requireCurrentActor();
  await moduleService.disableCompanyModule(actor.id, input);
}

export async function grantPermissionPackAction(input: Parameters<typeof moduleService.grantPermissionPack>[1]) {
  const actor = await requireCurrentActor();
  await moduleService.grantPermissionPack(actor.id, input);
}

export async function revokePermissionPackAction(input: Parameters<typeof moduleService.revokePermissionPack>[1]) {
  const actor = await requireCurrentActor();
  await moduleService.revokePermissionPack(actor.id, input);
}

// ===== MedicalCase =====

export async function createMedicalCaseAction(input: Parameters<typeof caseService.createMedicalCase>[1]) {
  const actor = await requireCurrentActor();
  const record = await caseService.createMedicalCase(actor.id, input);
  return { id: record.id };
}

export async function updateMedicalCaseAction(input: Parameters<typeof caseService.updateMedicalCase>[1]) {
  const actor = await requireCurrentActor();
  await caseService.updateMedicalCase(actor.id, input);
}

export async function closeMedicalCaseAction(input: Parameters<typeof caseService.closeMedicalCase>[1]) {
  const actor = await requireCurrentActor();
  await caseService.closeMedicalCase(actor.id, input);
}

export async function reopenMedicalCaseAction(input: Parameters<typeof caseService.reopenMedicalCase>[1]) {
  const actor = await requireCurrentActor();
  await caseService.reopenMedicalCase(actor.id, input);
}

// ===== Consultation =====

export async function createConsultationAction(
  input: Parameters<typeof consultationService.createConsultation>[1],
) {
  const actor = await requireCurrentActor();
  const record = await consultationService.createConsultation(actor.id, input);
  return { id: record.id };
}

export async function updateDraftConsultationAction(
  input: Parameters<typeof consultationService.updateDraftConsultation>[1],
) {
  const actor = await requireCurrentActor();
  await consultationService.updateDraftConsultation(actor.id, input);
}

export async function finalizeConsultationAction(
  input: Parameters<typeof consultationService.finalizeConsultation>[1],
) {
  const actor = await requireCurrentActor();
  await consultationService.finalizeConsultation(actor.id, input);
}

export async function addConsultationAddendumAction(
  input: Parameters<typeof consultationService.addConsultationAddendum>[1],
) {
  const actor = await requireCurrentActor();
  await consultationService.addConsultationAddendum(actor.id, input);
}

export async function recordScreeningItemAction(
  input: Parameters<typeof consultationService.recordScreeningItem>[1],
) {
  const actor = await requireCurrentActor();
  await consultationService.recordScreeningItem(actor.id, input);
}

// ===== Procedure =====

export async function planProcedureAction(input: Parameters<typeof procedureService.planProcedure>[1]) {
  const actor = await requireCurrentActor();
  const record = await procedureService.planProcedure(actor.id, input);
  return { id: record.id };
}

export async function startProcedureAction(input: Parameters<typeof procedureService.startProcedure>[1]) {
  const actor = await requireCurrentActor();
  await procedureService.startProcedure(actor.id, input);
}

export async function completeProcedureAction(input: Parameters<typeof procedureService.completeProcedure>[1]) {
  const actor = await requireCurrentActor();
  await procedureService.completeProcedure(actor.id, input);
}

export async function cancelProcedureAction(input: Parameters<typeof procedureService.cancelProcedure>[1]) {
  const actor = await requireCurrentActor();
  await procedureService.cancelProcedure(actor.id, input);
}

export async function reverseProcedureMaterialAction(
  input: Parameters<typeof procedureService.reverseProcedureMaterial>[1],
) {
  const actor = await requireCurrentActor();
  await procedureService.reverseProcedureMaterial(actor.id, input);
}

/** Readiness trả về plain object {ready, reasons} — không có Decimal, an toàn
 *  qua boundary. UI dùng để hiện lý do chưa đủ điều kiện (bất biến #68). */
export async function getProcedureReadinessAction(companyId: string, procedureId: string) {
  const actor = await requireCurrentActor();
  return procedureService.getProcedureReadiness(actor.id, companyId, procedureId);
}

// ===== Consent =====

export async function createConsentTemplateAction(
  input: Parameters<typeof consentService.createConsentTemplate>[1],
) {
  const actor = await requireCurrentActor();
  const record = await consentService.createConsentTemplate(actor.id, input);
  return { id: record.id };
}

export async function archiveConsentTemplateAction(
  input: Parameters<typeof consentService.archiveConsentTemplate>[1],
) {
  const actor = await requireCurrentActor();
  await consentService.archiveConsentTemplate(actor.id, input);
}

export async function createConsentRecordAction(
  input: Parameters<typeof consentService.createConsentRecord>[1],
) {
  const actor = await requireCurrentActor();
  const record = await consentService.createConsentRecord(actor.id, input);
  return { id: record.id };
}

export async function signConsentAction(input: Parameters<typeof consentService.signConsent>[1]) {
  const actor = await requireCurrentActor();
  await consentService.signConsent(actor.id, input);
}

export async function revokeConsentAction(input: Parameters<typeof consentService.revokeConsent>[1]) {
  const actor = await requireCurrentActor();
  await consentService.revokeConsent(actor.id, input);
}

// ===== ClinicalPhoto =====

export async function registerClinicalPhotoAction(
  input: Parameters<typeof photoService.registerClinicalPhoto>[1],
) {
  const actor = await requireCurrentActor();
  const record = await photoService.registerClinicalPhoto(actor.id, input);
  return { id: record.id };
}

export async function archiveClinicalPhotoAction(
  input: Parameters<typeof photoService.archiveClinicalPhoto>[1],
) {
  const actor = await requireCurrentActor();
  await photoService.archiveClinicalPhoto(actor.id, input);
}

// ===== MedicalFollowUp =====

export async function createMedicalFollowUpAction(
  input: Parameters<typeof followUpService.createMedicalFollowUp>[1],
) {
  const actor = await requireCurrentActor();
  const record = await followUpService.createMedicalFollowUp(actor.id, input);
  return { id: record.id };
}

export async function updateFollowUpStatusAction(
  input: Parameters<typeof followUpService.updateFollowUpStatus>[1],
) {
  const actor = await requireCurrentActor();
  await followUpService.updateFollowUpStatus(actor.id, input);
}

export async function recordFollowUpOutcomeAction(
  input: Parameters<typeof followUpService.recordFollowUpOutcome>[1],
) {
  const actor = await requireCurrentActor();
  await followUpService.recordFollowUpOutcome(actor.id, input);
}

export async function closeMedicalFollowUpAction(
  input: Parameters<typeof followUpService.closeMedicalFollowUp>[1],
) {
  const actor = await requireCurrentActor();
  await followUpService.closeMedicalFollowUp(actor.id, input);
}
