import Link from "next/link";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getSaleList, getCatalogItems } from "@/lib/domain/sales-service";
import { getCustomerList } from "@/lib/domain/customer-service";
import { db } from "@/lib/db";
import { SALE_STATUS_LABEL, formatMoney } from "../work-labels";
import { CreateSaleForm } from "./create-sale-form";
import type { SaleStatus } from "@/generated/prisma";

export const dynamic = "force-dynamic";

const STATUS_TABS: { value?: SaleStatus; label: string }[] = [
  { value: undefined, label: "Tất cả" },
  { value: "DRAFT", label: "Nháp" },
  { value: "CONFIRMED", label: "Đã xác nhận" },
  { value: "CANCELLED", label: "Đã huỷ" },
];

export default async function SalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ status?: string; customerId?: string }>;
}) {
  const { code } = await params;
  const { status, customerId } = await searchParams;
  const ctx = await requireCompanyPageByCode(code, "sales.view");

  const sales = await getSaleList(
    ctx.actor.id,
    ctx.company.id,
    status ? { status: status as SaleStatus } : {},
  );

  const canCreate = ctx.permissions.has("sales.create");
  const canViewCatalog = ctx.permissions.has("catalog.view");

  // Chỉ tải dữ liệu phụ trợ cho form tạo giao dịch khi thật sự cần hiển thị
  // form (mirror pattern projects/[projectId]/page.tsx: mayManage ? fetch : Promise.resolve([])).
  const [customers, catalogItems, companyMembers] = await Promise.all([
    canCreate ? getCustomerList(ctx.actor.id, ctx.company.id) : Promise.resolve([]),
    canCreate ? getCatalogItems(ctx.actor.id, ctx.company.id) : Promise.resolve([]),
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
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Kinh doanh</h2>
          <p className="text-sm text-zinc-500">Giao dịch bán hàng của công ty.</p>
        </div>
        {canViewCatalog ? (
          <Link href={`/c/${code}/sales/catalog`} className="text-sm text-zinc-900 hover:underline">
            Quản lý danh mục →
          </Link>
        ) : null}
      </div>

      <nav className="flex flex-wrap gap-4 border-b border-zinc-200 pb-2 text-sm">
        {STATUS_TABS.map((tab) => {
          const isActive = (status ?? undefined) === tab.value;
          const href = tab.value ? `/c/${code}/sales?status=${tab.value}` : `/c/${code}/sales`;
          return (
            <Link
              key={tab.label}
              href={href}
              className={isActive ? "font-medium text-zinc-900" : "text-zinc-500 hover:text-zinc-700"}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {canCreate ? (
        <CreateSaleForm
          companyId={ctx.company.id}
          code={code}
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
          catalogItems={catalogItems.map((i) => ({
            id: i.id,
            name: i.name,
            defaultPrice: i.defaultPrice !== null ? Number(i.defaultPrice) : null,
          }))}
          companyMembers={companyMembers.map((m) => ({ id: m.userId, displayName: m.user.displayName }))}
          initialCustomerId={customerId}
        />
      ) : null}

      {sales.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
          Chưa có giao dịch nào.
        </p>
      ) : (
        <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="px-4 py-2 font-medium">Mã</th>
                <th className="px-4 py-2 font-medium">Khách hàng</th>
                <th className="px-4 py-2 font-medium">Người bán</th>
                <th className="px-4 py-2 font-medium">Tổng tiền</th>
                <th className="px-4 py-2 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/c/${code}/sales/${sale.id}`} className="text-zinc-900 hover:underline">
                      {sale.code ?? sale.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-700">{sale.customer?.name ?? "Khách lẻ"}</td>
                  <td className="px-4 py-2 text-zinc-700">{sale.salesperson?.displayName ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-700">{formatMoney(Number(sale.totalAmount))}</td>
                  <td className="px-4 py-2 text-zinc-700">{SALE_STATUS_LABEL[sale.status] ?? sale.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
