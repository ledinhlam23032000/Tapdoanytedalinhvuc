import Link from "next/link";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getCustomerList } from "@/lib/domain/customer-service";
import { getOrganizationTree } from "@/lib/domain/organization-service";
import { db } from "@/lib/db";
import { CUSTOMER_JOURNEY_STAGE_LABEL } from "../work-labels";
import { CreateCustomerForm } from "./create-customer-form";

export const dynamic = "force-dynamic";

const CUSTOMER_STATUS_VALUES = new Set(["ACTIVE", "INACTIVE", "ARCHIVED"]);

export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { code } = await params;
  const { q, status } = await searchParams;
  const ctx = await requireCompanyPageByCode(code, "customer.view");

  const customers = await getCustomerList(ctx.actor.id, ctx.company.id, {
    search: q,
    ...(status && CUSTOMER_STATUS_VALUES.has(status)
      ? { status: status as "ACTIVE" | "INACTIVE" | "ARCHIVED" }
      : {}),
  });

  const canCreate = ctx.permissions.has("customer.create");
  const canViewLead = ctx.permissions.has("lead.view");

  const [sources, owners, organizationUnits] = await Promise.all([
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
    canCreate ? getOrganizationTree(ctx.actor.id, ctx.company.id) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Khách hàng</h2>
          <p className="text-sm text-zinc-500">Toàn bộ khách hàng của công ty.</p>
        </div>
        {canViewLead ? (
          <Link href={`/c/${code}/customers/leads`} className="text-sm text-zinc-900 hover:underline">
            Xem Lead →
          </Link>
        ) : null}
      </div>

      <form method="get" className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Tìm theo tên, mã, số điện thoại..."
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Tìm
        </button>
      </form>

      {customers.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
          Chưa có khách hàng nào.
        </p>
      ) : (
        <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="px-4 py-2 font-medium">Tên</th>
                <th className="px-4 py-2 font-medium">Người phụ trách</th>
                <th className="px-4 py-2 font-medium">Giai đoạn</th>
                <th className="px-4 py-2 font-medium">Nguồn</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/c/${code}/customers/${c.id}`} className="text-zinc-900 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-700">{c.owner?.displayName ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-700">
                    {CUSTOMER_JOURNEY_STAGE_LABEL[c.journeyStage] ?? c.journeyStage}
                  </td>
                  <td className="px-4 py-2 text-zinc-700">{c.source?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {canCreate ? (
        <CreateCustomerForm
          companyId={ctx.company.id}
          code={code}
          sources={sources.map((s) => ({ id: s.id, name: s.name }))}
          owners={owners.map((m) => ({ id: m.userId, displayName: m.user.displayName }))}
          organizationUnits={organizationUnits.map((u) => ({ id: u.id, name: u.name }))}
        />
      ) : null}
    </div>
  );
}
