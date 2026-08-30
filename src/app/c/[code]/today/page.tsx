import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getMyTodayWork } from "@/lib/domain/work-service";
import { TodayWorkList } from "./today-work-list";

export const dynamic = "force-dynamic";

export default async function TodayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ctx = await requireCompanyPageByCode(code, "work.view");
  const items = await getMyTodayWork(ctx.actor.id, ctx.company.id, new Date());

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Việc của tôi hôm nay</h2>
        <p className="text-sm text-zinc-500">Xếp theo mức độ khẩn cấp — quá hạn và ưu tiên khẩn cấp lên đầu.</p>
      </div>
      <TodayWorkList
        companyId={ctx.company.id}
        items={items.map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          priority: item.priority,
          dueAt: item.dueAt ? item.dueAt.toISOString() : null,
          projectName: item.project?.name ?? null,
          organizationUnitName: item.organizationUnit?.name ?? null,
        }))}
      />
    </div>
  );
}
