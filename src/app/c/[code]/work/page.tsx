import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getCompanyWork } from "@/lib/domain/work-service";
import { getCompanyPeople, getOrganizationTree } from "@/lib/domain/organization-service";
import { getProjects } from "@/lib/domain/project-service";
import { CreateWorkForm } from "./create-work-form";
import { WorkTable } from "./work-table";

export const dynamic = "force-dynamic";

export default async function WorkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ctx = await requireCompanyPageByCode(code, "work.view");

  const [items, people, units, projects] = await Promise.all([
    getCompanyWork(ctx.actor.id, ctx.company.id),
    getCompanyPeople(ctx.actor.id, ctx.company.id),
    getOrganizationTree(ctx.actor.id, ctx.company.id),
    getProjects(ctx.actor.id, ctx.company.id),
  ]);

  const canAssign = ctx.permissions.has("work.assign");
  const canCreate = ctx.permissions.has("work.create");
  const canManage = ctx.permissions.has("work.manage");

  // Danh sách người có thể được giao việc = thành viên Company đang hoạt
  // động (không chỉ người đã có Assignment/vị trí — mục XXXIV).
  const assignableUsers = Array.from(
    new Map(people.map((p) => [p.user.id, { id: p.user.id, displayName: p.user.displayName }])).values(),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Công việc</h2>
        <p className="text-sm text-zinc-500">
          {canAssign ? "Toàn bộ công việc của công ty." : "Công việc bạn tạo hoặc được giao."}
        </p>
      </div>
      {canCreate ? (
        <CreateWorkForm
          companyId={ctx.company.id}
          currentUserId={ctx.actor.id}
          canAssign={canAssign}
          assignableUsers={assignableUsers}
          organizationUnits={units.map((u) => ({ id: u.id, name: u.name }))}
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        />
      ) : null}
      <WorkTable
        companyId={ctx.company.id}
        currentUserId={ctx.actor.id}
        canManage={canManage}
        items={items.map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          priority: item.priority,
          dueAt: item.dueAt ? item.dueAt.toISOString() : null,
          assigneeUserId: item.assigneeUserId,
          createdByUserId: item.createdByUserId,
          assigneeName: item.assignee?.displayName ?? null,
          projectName: item.project?.name ?? null,
          organizationUnitName: item.organizationUnit?.name ?? null,
        }))}
      />
    </div>
  );
}
