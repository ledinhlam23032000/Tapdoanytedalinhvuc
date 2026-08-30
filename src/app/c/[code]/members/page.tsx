import { db } from "@/lib/db";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { canGrantOwnerRole } from "@/lib/permissions/registry";
import { MembersTable } from "./members-table";
import { AddMemberForm } from "./add-member-form";

export const dynamic = "force-dynamic";

export default async function CompanyMembersPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const ctx = await requireCompanyPageByCode(code, "company.members.view");

  const memberships = await db.companyMembership.findMany({
    where: { companyId: ctx.company.id, status: "ACTIVE" },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  const canManage = ctx.permissions.has("company.members.manage");
  const actorIsOwner = canGrantOwnerRole(ctx.membership?.rolePreset);

  return (
    <div className="flex flex-col gap-6">
      <MembersTable
        companyId={ctx.company.id}
        currentUserId={ctx.actor.id}
        canManage={canManage}
        actorIsOwner={actorIsOwner}
        members={memberships.map((m) => ({
          membershipId: m.id,
          userId: m.userId,
          displayName: m.user.displayName,
          email: m.user.email,
          rolePreset: m.rolePreset,
        }))}
      />
      {canManage ? <AddMemberForm companyId={ctx.company.id} actorIsOwner={actorIsOwner} /> : null}
    </div>
  );
}
