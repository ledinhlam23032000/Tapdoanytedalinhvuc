"use server";

import { requireCurrentActor } from "@/lib/auth/current-actor";
import * as companyService from "@/lib/domain/company-service";
import type { CreateCompanyInput } from "@/lib/domain/company-service";
import type { CompanyRolePreset } from "@/generated/prisma";

// Thin wrapper: lấy actor từ session cookie (request-scoped) rồi giao logic
// thật cho domain service (src/lib/domain/company-service.ts) — nơi
// integration test gọi trực tiếp với actorId giả lập.

export async function createCompanyAction(input: CreateCompanyInput) {
  const actor = await requireCurrentActor();
  return companyService.createCompany(actor.id, input);
}

export async function suspendCompanyAction(companyId: string, reason?: string) {
  const actor = await requireCurrentActor();
  return companyService.suspendCompany(actor.id, companyId, reason);
}

export async function resumeCompanyAction(companyId: string) {
  const actor = await requireCurrentActor();
  return companyService.resumeCompany(actor.id, companyId);
}

export async function archiveCompanyAction(companyId: string) {
  const actor = await requireCurrentActor();
  return companyService.archiveCompany(actor.id, companyId);
}

export async function addCompanyMemberAction(input: {
  companyId: string;
  email: string;
  rolePreset: CompanyRolePreset;
}) {
  const actor = await requireCurrentActor();
  return companyService.addCompanyMember(actor.id, input);
}

export async function updateCompanyMemberRoleAction(input: {
  companyId: string;
  membershipId: string;
  rolePreset: CompanyRolePreset;
}) {
  const actor = await requireCurrentActor();
  return companyService.updateCompanyMemberRole(actor.id, input);
}

export async function removeCompanyMemberAction(companyId: string, membershipId: string) {
  const actor = await requireCurrentActor();
  return companyService.removeCompanyMember(actor.id, companyId, membershipId);
}
