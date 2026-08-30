import Link from "next/link";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getProjects } from "@/lib/domain/project-service";
import { PROJECT_STATUS_LABEL } from "../work-labels";
import { CreateProjectForm } from "./create-project-form";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ctx = await requireCompanyPageByCode(code, "project.view");
  const projects = await getProjects(ctx.actor.id, ctx.company.id);
  const canCreate = ctx.permissions.has("project.create");

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-zinc-900">Dự án</h2>
      <ul className="flex flex-col gap-2">
        {projects.map((project) => (
          <li key={project.id}>
            <Link
              href={`/c/${code}/projects/${project.id}`}
              className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-400"
            >
              <div>
                <span className="font-medium text-zinc-900">{project.name}</span>
                <span className="ml-2 text-xs text-zinc-500">{project.owner?.displayName ?? "Chưa có chủ dự án"}</span>
              </div>
              <span className="text-sm text-zinc-500">{PROJECT_STATUS_LABEL[project.status] ?? project.status}</span>
            </Link>
          </li>
        ))}
        {projects.length === 0 ? (
          <li className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            Chưa có dự án nào.
          </li>
        ) : null}
      </ul>
      {canCreate ? <CreateProjectForm companyId={ctx.company.id} /> : null}
    </div>
  );
}
