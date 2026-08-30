import { db } from "@/lib/db";
import type { Ecosystem } from "@/generated/prisma";

// Ecosystem mà actor có thể "vào" — hoặc qua EcosystemMembership trực tiếp,
// hoặc gián tiếp qua CompanyMembership ở một Company thuộc Ecosystem đó
// (mục CXXI Option A: Company member không bắt buộc có EcosystemMembership
// riêng). Chỉ dùng để routing/hiển thị — KHÔNG cấp permission gì, mọi
// permission thật vẫn phải qua resolver.
export async function getActorEcosystems(actorId: string): Promise<Ecosystem[]> {
  const [direct, viaCompany] = await Promise.all([
    db.ecosystem.findMany({
      where: { memberships: { some: { userId: actorId, status: "ACTIVE" } } },
    }),
    db.ecosystem.findMany({
      where: {
        companies: { some: { memberships: { some: { userId: actorId, status: "ACTIVE" } } } },
      },
    }),
  ]);
  const byId = new Map<string, Ecosystem>();
  for (const e of [...direct, ...viaCompany]) byId.set(e.id, e);
  return [...byId.values()];
}
