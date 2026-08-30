import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { resolveEcosystemPermissions } from "@/lib/permissions/resolver";
import { CompanyLifecycleActions } from "./company-lifecycle-actions";

export const dynamic = "force-dynamic";

export default async function CompanyHomePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const ctx = await requireCompanyPageByCode(code, "company.view");
  const ecosystemPermissions = await resolveEcosystemPermissions(ctx.actor.id, ctx.ecosystem.id);
  const canManageLifecycle = ecosystemPermissions.has("ecosystem.company.lifecycle");

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-md border border-zinc-200 bg-white p-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <dt className="text-zinc-500">Mã công ty</dt>
          <dd className="text-zinc-900">{ctx.company.code}</dd>
          <dt className="text-zinc-500">Tiền tệ</dt>
          <dd className="text-zinc-900">{ctx.company.currency}</dd>
          <dt className="text-zinc-500">Múi giờ</dt>
          <dd className="text-zinc-900">{ctx.company.timezone}</dd>
          <dt className="text-zinc-500">Vai trò của bạn</dt>
          <dd className="text-zinc-900">
            {ctx.membership ? ctx.membership.rolePreset : "Xem theo quyền hệ sinh thái"}
          </dd>
        </dl>
      </section>

      {canManageLifecycle ? <CompanyLifecycleActions companyId={ctx.company.id} status={ctx.company.status} /> : null}
    </div>
  );
}
