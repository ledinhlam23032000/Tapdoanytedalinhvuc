"use server";

import { requireCurrentActor } from "@/lib/auth/current-actor";
import * as appointmentService from "@/lib/domain/appointment-service";

// Thin wrapper — xem organization-actions.ts (Phần 4) cho pattern gốc.

export async function createAppointmentAction(input: Parameters<typeof appointmentService.createAppointment>[1]) {
  const actor = await requireCurrentActor();
  return appointmentService.createAppointment(actor.id, input);
}

export async function rescheduleAppointmentAction(
  input: Parameters<typeof appointmentService.rescheduleAppointment>[1],
) {
  const actor = await requireCurrentActor();
  return appointmentService.rescheduleAppointment(actor.id, input);
}

export async function completeAppointmentAction(companyId: string, appointmentId: string) {
  const actor = await requireCurrentActor();
  return appointmentService.completeAppointment(actor.id, companyId, appointmentId);
}

export async function cancelAppointmentAction(companyId: string, appointmentId: string) {
  const actor = await requireCurrentActor();
  return appointmentService.cancelAppointment(actor.id, companyId, appointmentId);
}

export async function markNoShowAction(companyId: string, appointmentId: string) {
  const actor = await requireCurrentActor();
  return appointmentService.markNoShow(actor.id, companyId, appointmentId);
}
