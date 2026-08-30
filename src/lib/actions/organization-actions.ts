"use server";

import { requireCurrentActor } from "@/lib/auth/current-actor";
import * as organizationService from "@/lib/domain/organization-service";

// Thin wrapper: lấy actor từ session cookie rồi giao logic thật cho
// src/lib/domain/organization-service.ts (nơi integration test gọi trực
// tiếp với actorId giả lập).

export async function createOrganizationUnitAction(
  input: Parameters<typeof organizationService.createOrganizationUnit>[1],
) {
  const actor = await requireCurrentActor();
  return organizationService.createOrganizationUnit(actor.id, input);
}

export async function archiveOrganizationUnitAction(companyId: string, unitId: string) {
  const actor = await requireCurrentActor();
  return organizationService.archiveOrganizationUnit(actor.id, companyId, unitId);
}

export async function createPositionAction(input: Parameters<typeof organizationService.createPosition>[1]) {
  const actor = await requireCurrentActor();
  return organizationService.createPosition(actor.id, input);
}

export async function archivePositionAction(companyId: string, positionId: string) {
  const actor = await requireCurrentActor();
  return organizationService.archivePosition(actor.id, companyId, positionId);
}

export async function createAssignmentAction(input: Parameters<typeof organizationService.createAssignment>[1]) {
  const actor = await requireCurrentActor();
  return organizationService.createAssignment(actor.id, input);
}

export async function endAssignmentAction(companyId: string, assignmentId: string) {
  const actor = await requireCurrentActor();
  return organizationService.endAssignment(actor.id, companyId, assignmentId);
}
