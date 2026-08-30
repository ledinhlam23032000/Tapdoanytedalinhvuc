"use server";

import { requireCurrentActor } from "@/lib/auth/current-actor";
import * as projectService from "@/lib/domain/project-service";

// Thin wrapper — xem organization-actions.ts.

export async function createProjectAction(input: Parameters<typeof projectService.createProject>[1]) {
  const actor = await requireCurrentActor();
  return projectService.createProject(actor.id, input);
}

export async function updateProjectAction(input: Parameters<typeof projectService.updateProject>[1]) {
  const actor = await requireCurrentActor();
  return projectService.updateProject(actor.id, input);
}

export async function addProjectMemberAction(input: Parameters<typeof projectService.addProjectMember>[1]) {
  const actor = await requireCurrentActor();
  return projectService.addProjectMember(actor.id, input);
}

export async function completeProjectAction(companyId: string, projectId: string) {
  const actor = await requireCurrentActor();
  return projectService.completeProject(actor.id, companyId, projectId);
}

export async function archiveProjectAction(companyId: string, projectId: string) {
  const actor = await requireCurrentActor();
  return projectService.archiveProject(actor.id, companyId, projectId);
}
