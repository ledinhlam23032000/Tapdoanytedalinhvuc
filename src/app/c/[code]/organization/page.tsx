import { db } from "@/lib/db";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getOrganizationTree, getPositions, getCompanyPeople } from "@/lib/domain/organization-service";
import { UnitForm } from "./unit-form";
import { PositionForm } from "./position-form";
import { AssignmentForm } from "./assignment-form";
import { PeopleTable } from "./people-table";

export const dynamic = "force-dynamic";

export default async function OrganizationPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ctx = await requireCompanyPageByCode(code, "organization.view");

  const [units, positions, people, members] = await Promise.all([
    getOrganizationTree(ctx.actor.id, ctx.company.id),
    getPositions(ctx.actor.id, ctx.company.id),
    getCompanyPeople(ctx.actor.id, ctx.company.id),
    db.companyMembership.findMany({
      where: { companyId: ctx.company.id, status: "ACTIVE" },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const canManageStructure = ctx.permissions.has("organization.manage");
  const canAssign = ctx.permissions.has("people.assign");
  const unitNameById = new Map(units.map((u) => [u.id, u.name]));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Đơn vị tổ chức</h2>
        <ul className="flex flex-col gap-2">
          {units.map((unit) => (
            <li key={unit.id} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm">
              <span className="font-medium text-zinc-900">{unit.name}</span>
              {unit.parentId ? (
                <span className="ml-2 text-xs text-zinc-500">thuộc {unitNameById.get(unit.parentId) ?? "—"}</span>
              ) : null}
            </li>
          ))}
          {units.length === 0 ? (
            <li className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
              Chưa có đơn vị nào.
            </li>
          ) : null}
        </ul>
        {canManageStructure ? (
          <UnitForm companyId={ctx.company.id} units={units.map((u) => ({ id: u.id, name: u.name }))} />
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Vị trí</h2>
        <ul className="flex flex-col gap-2">
          {positions.map((position) => (
            <li key={position.id} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm">
              <span className="font-medium text-zinc-900">{position.name}</span>
            </li>
          ))}
          {positions.length === 0 ? (
            <li className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
              Chưa có vị trí nào.
            </li>
          ) : null}
        </ul>
        {canManageStructure ? <PositionForm companyId={ctx.company.id} /> : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Nhân sự</h2>
        <PeopleTable
          companyId={ctx.company.id}
          canAssign={canAssign}
          people={people.map((p) => ({
            assignmentId: p.id,
            userDisplayName: p.user.displayName,
            positionName: p.position.name,
            organizationUnitName: p.organizationUnit?.name ?? null,
          }))}
        />
        {canAssign && positions.length > 0 ? (
          <AssignmentForm
            companyId={ctx.company.id}
            members={members.map((m) => ({ id: m.userId, displayName: m.user.displayName }))}
            positions={positions.map((p) => ({ id: p.id, name: p.name }))}
            units={units.map((u) => ({ id: u.id, name: u.name }))}
          />
        ) : null}
      </section>
    </div>
  );
}
