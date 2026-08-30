import { notFound } from "next/navigation";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getProjectDetail } from "@/lib/domain/project-service";
import { getOrganizationTree } from "@/lib/domain/organization-service";
import { db } from "@/lib/db";
import { PROJECT_STATUS_LABEL, formatDueDate } from "../../work-labels";
import { AddProjectMemberForm } from "./add-project-member-form";
import { ProjectLifecycleActions } from "./project-lifecycle-actions";
import { CreateProjectWorkForm } from "./create-project-work-form";
import { EditProjectForm } from "./edit-project-form";
import { WorkTable } from "../../work/work-table";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ code: string; projectId: string }>;
}) {
  const { code, projectId } = await params;
  const ctx = await requireCompanyPageByCode(code, "project.view");

  let project;
  try {
    project = await getProjectDetail(ctx.actor.id, ctx.company.id, projectId);
  } catch {
    notFound();
  }

  const mayManage =
    ctx.permissions.has("project.manage") ||
    project.memberships.some((m) => m.userId === ctx.actor.id && m.rolePreset === "OWNER");
  const canArchive = ctx.permissions.has("project.archive");
  const canAssignCompanyWide = ctx.permissions.has("work.assign");

  const [companyMembers, organizationUnits] = await Promise.all([
    mayManage
      ? db.companyMembership.findMany({
          where: { companyId: ctx.company.id, status: "ACTIVE" },
          include: { user: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    mayManage ? getOrganizationTree(ctx.actor.id, ctx.company.id) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-500">{project.code}</p>
          <h2 className="text-lg font-semibold text-zinc-900">{project.name}</h2>
          {project.description ? <p className="mt-1 text-sm text-zinc-600">{project.description}</p> : null}
          <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-zinc-500">
            <span>Trạng thái: {PROJECT_STATUS_LABEL[project.status] ?? project.status}</span>
            <span>Chủ dự án: {project.owner?.displayName ?? "—"}</span>
            {project.owningUnit ? <span>Đơn vị: {project.owningUnit.name}</span> : null}
            {project.startAt ? <span>Bắt đầu: {formatDueDate(project.startAt.toISOString())}</span> : null}
            {project.dueAt ? <span>Hạn: {formatDueDate(project.dueAt.toISOString())}</span> : null}
            {project.budgetAmount ? (
              <span>Ngân sách: {new Intl.NumberFormat("vi-VN").format(Number(project.budgetAmount))} ₫</span>
            ) : null}
          </div>
        </div>
        {mayManage ? (
          <ProjectLifecycleActions
            companyId={ctx.company.id}
            projectId={project.id}
            status={project.status}
            canArchive={canArchive}
          />
        ) : null}
      </div>

      {mayManage ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-zinc-900">Sửa thông tin dự án</h3>
          <EditProjectForm
            companyId={ctx.company.id}
            projectId={project.id}
            initial={{
              name: project.name,
              description: project.description ?? "",
              owningUnitId: project.owningUnitId ?? "",
              startAt: project.startAt ? project.startAt.toISOString().slice(0, 10) : "",
              dueAt: project.dueAt ? project.dueAt.toISOString().slice(0, 10) : "",
              budgetAmount: project.budgetAmount ? String(project.budgetAmount) : "",
            }}
            organizationUnits={organizationUnits.map((u) => ({ id: u.id, name: u.name }))}
          />
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">Thành viên dự án</h3>
        <ul className="flex flex-col gap-2">
          {project.memberships.map((m) => (
            <li key={m.id} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm">
              <span className="text-zinc-900">{m.user.displayName}</span>
              <span className="ml-2 text-xs text-zinc-500">
                {m.rolePreset === "OWNER" ? "Chủ dự án" : m.rolePreset === "MEMBER" ? "Thành viên" : "Chỉ xem"}
              </span>
            </li>
          ))}
        </ul>
        {mayManage ? (
          <AddProjectMemberForm
            companyId={ctx.company.id}
            projectId={project.id}
            candidates={companyMembers
              .filter((cm) => !project.memberships.some((m) => m.userId === cm.userId))
              .map((cm) => ({ id: cm.userId, displayName: cm.user.displayName }))}
          />
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">Công việc của dự án</h3>
        <CreateProjectWorkForm
          companyId={ctx.company.id}
          projectId={project.id}
          currentUserId={ctx.actor.id}
          canAssign={canAssignCompanyWide}
          projectMembers={project.memberships.map((m) => ({ id: m.userId, displayName: m.user.displayName }))}
        />
        <WorkTable
          companyId={ctx.company.id}
          currentUserId={ctx.actor.id}
          canManage={ctx.permissions.has("work.manage")}
          items={project.workItems.map((item) => ({
            id: item.id,
            title: item.title,
            status: item.status,
            priority: item.priority,
            dueAt: item.dueAt ? item.dueAt.toISOString() : null,
            assigneeUserId: item.assigneeUserId,
            createdByUserId: item.createdByUserId,
            assigneeName: item.assignee?.displayName ?? null,
            projectName: null,
            organizationUnitName: null,
          }))}
        />
      </section>
    </div>
  );
}
