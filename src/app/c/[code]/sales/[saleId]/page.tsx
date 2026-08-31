import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getSaleDetail } from "@/lib/domain/sales-service";
import { SALE_STATUS_LABEL, formatMoney, formatDateTime } from "../../work-labels";
import { SaleActions } from "./sale-actions";

export const dynamic = "force-dynamic";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ code: string; saleId: string }>;
}) {
  const { code, saleId } = await params;
  const ctx = await requireCompanyPageByCode(code, "sales.view");

  let sale;
  try {
    sale = await getSaleDetail(ctx.actor.id, ctx.company.id, saleId);
  } catch {
    notFound();
  }
  if (!sale) notFound();

  const canCancel = ctx.permissions.has("sales.cancel");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-500">{sale.code ?? sale.id}</p>
          <div className="mt-1 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">Giao dịch bán hàng</h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              {SALE_STATUS_LABEL[sale.status] ?? sale.status}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-zinc-500">
            {sale.customer ? (
              <span>
                Khách hàng:{" "}
                <Link href={`/c/${code}/customers/${sale.customer.id}`} className="text-zinc-900 hover:underline">
                  {sale.customer.name}
                </Link>
              </span>
            ) : (
              <span>Khách hàng: Khách lẻ</span>
            )}
            <span>Người bán: {sale.salesperson?.displayName ?? "—"}</span>
            {sale.organizationUnit ? <span>Đơn vị: {sale.organizationUnit.name}</span> : null}
            {sale.project ? <span>Dự án: {sale.project.name}</span> : null}
          </div>
        </div>
        <SaleActions companyId={ctx.company.id} saleId={sale.id} status={sale.status} canCancel={canCancel} />
      </div>

      <div className="rounded-md border border-zinc-200 bg-white p-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-zinc-500">Tạm tính</dt>
            <dd className="text-zinc-900">{formatMoney(Number(sale.subtotalAmount))}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Chiết khấu</dt>
            <dd className="text-zinc-900">{formatMoney(Number(sale.discountAmount))}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Tổng tiền</dt>
            <dd className="font-medium text-zinc-900">{formatMoney(Number(sale.totalAmount))}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Tạo lúc</dt>
            <dd className="text-zinc-900">{formatDateTime(sale.createdAt.toISOString())}</dd>
          </div>
          {sale.confirmedAt ? (
            <div>
              <dt className="text-zinc-500">Xác nhận lúc</dt>
              <dd className="text-zinc-900">{formatDateTime(sale.confirmedAt.toISOString())}</dd>
            </div>
          ) : null}
          {sale.cancelledAt ? (
            <div>
              <dt className="text-zinc-500">Huỷ lúc</dt>
              <dd className="text-zinc-900">{formatDateTime(sale.cancelledAt.toISOString())}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">Dòng hàng</h3>
        {sale.lines.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            Chưa có dòng hàng nào.
          </p>
        ) : (
          <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="px-4 py-2 font-medium">Sản phẩm/Dịch vụ</th>
                  <th className="px-4 py-2 font-medium">Số lượng</th>
                  <th className="px-4 py-2 font-medium">Đơn giá</th>
                  <th className="px-4 py-2 font-medium">Chiết khấu</th>
                  <th className="px-4 py-2 font-medium">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {sale.lines.map((line) => (
                  <tr key={line.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2 text-zinc-900">{line.catalogItem?.name ?? line.description}</td>
                    <td className="px-4 py-2 text-zinc-700">{line.quantity}</td>
                    <td className="px-4 py-2 text-zinc-700">{formatMoney(Number(line.unitPrice))}</td>
                    <td className="px-4 py-2 text-zinc-700">{formatMoney(Number(line.discountAmount))}</td>
                    <td className="px-4 py-2 text-zinc-700">{formatMoney(Number(line.lineTotal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </section>
    </div>
  );
}
