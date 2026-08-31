import Link from "next/link";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getLeadList } from "@/lib/domain/lead-service";
import { db } from "@/lib/db";
import { LEAD_STATUS_LABEL } from "../../work-labels";
import { CreateLeadForm } from "./create-lead-form";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ctx = await requireCompanyPageByCode(code, "lead.view");

  const leads = await getLeadList(ctx.actor.id, ctx.company.id);
  const canCreate = ctx.permissions.has("lead.create");

  const [sources, owners] = await Promise.all([
    canCreate
      ? db.customerSource.findMany({ where: { companyId: ctx.company.id }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    canCreate
      ? db.companyMembership.findMany({
          where: { companyId: ctx.company.id, status: "ACTIVE" },
          include: { user: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/c/${code}/customers`} className="text-sm text-zinc-900 hover:underline">
          ← Khách hàng
        </Link>
        <h2 className="mt-2 text-lg font-semibold text-zinc-900">Lead</h2>
        <p className="text-sm text-zinc-500">Khách hàng tiềm năng chưa xác minh.</p>
      </div>

      {leads.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
          Chưa có Lead nào.
        </p>
      ) : (
        <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="px-4 py-2 font-medium">Tên</th>
                <th className="px-4 py-2 font-medium">Trạng thái</th>
                <th className="px-4 py-2 font-medium">Nguồn</th>
                <th className="px-4 py-2 font-medium">Người phụ trách</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/c/${code}/customers/leads/${lead.id}`} className="text-zinc-900 hover:underline">
                      {lead.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-700">{LEAD_STATUS_LABEL[lead.status] ?? lead.status}</td>
                  <td className="px-4 py-2 text-zinc-700">{lead.source?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-700">{lead.owner?.displayName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {canCreate ? (
        <CreateLeadForm
          companyId={ctx.company.id}
          sources={sources.map((s) => ({ id: s.id, name: s.name }))}
          owners={owners.map((m) => ({ id: m.userId, displayName: m.user.displayName }))}
        />
      ) : null}
    </div>
  );
}
