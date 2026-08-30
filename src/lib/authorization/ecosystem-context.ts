import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { resolveEcosystemPermissions } from "@/lib/permissions/resolver";
import { AuthorizationError } from "@/lib/authorization/errors";
import type { EcosystemPermission } from "@/lib/permissions/registry";
import type { Ecosystem, User } from "@/generated/prisma";

export type AuthorizedEcosystemContext = {
  actor: User;
  ecosystem: Ecosystem;
  permissions: Set<EcosystemPermission>;
};

// Core (testable, không đụng cookies()) — server-side authoritative
// resolution (mục XL/XLII): route param không bao giờ tự đủ để cấp quyền.
export async function resolveEcosystemContextForActor(
  actorId: string,
  ecosystemId: string,
): Promise<AuthorizedEcosystemContext | null> {
  const actor = await db.user.findUnique({ where: { id: actorId } });
  if (!actor || actor.status !== "ACTIVE") return null;

  const ecosystem = await db.ecosystem.findUnique({ where: { id: ecosystemId } });
  if (!ecosystem) return null;

  const permissions = await resolveEcosystemPermissions(actor.id, ecosystem.id);
  if (permissions.size === 0) return null;

  return { actor, ecosystem, permissions };
}

export async function requireEcosystemContextForActor(
  actorId: string,
  ecosystemId: string,
  permission: EcosystemPermission,
): Promise<AuthorizedEcosystemContext> {
  const ctx = await resolveEcosystemContextForActor(actorId, ecosystemId);
  if (!ctx || !ctx.permissions.has(permission)) throw new AuthorizationError();
  return ctx;
}

// ===== Request-scoped wrappers =====

/** Dùng trong Server Component / page loader — 404 nếu không có quyền (chống resource enumeration, mục CXII). */
export async function requireEcosystemPage(
  ecosystemId: string,
  permission: EcosystemPermission,
): Promise<AuthorizedEcosystemContext> {
  const actor = await getCurrentActor();
  if (!actor) notFound();
  const ctx = await resolveEcosystemContextForActor(actor.id, ecosystemId);
  if (!ctx || !ctx.permissions.has(permission)) notFound();
  return ctx;
}

/** Dùng trong Server Action — throw lỗi chung, không notFound() (action không render trang). */
export async function requireEcosystemAction(
  ecosystemId: string,
  permission: EcosystemPermission,
): Promise<AuthorizedEcosystemContext> {
  const actor = await getCurrentActor();
  if (!actor) throw new AuthorizationError();
  return requireEcosystemContextForActor(actor.id, ecosystemId, permission);
}
