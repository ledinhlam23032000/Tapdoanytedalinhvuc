import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getSaleDetail } from "@/lib/domain/sales-service";
import { getCustomerReceivable, getPaymentList } from "@/lib/domain/finance-service";
import { getCommissionRuleList, getSaleCommissionBreakdown } from "@/lib/domain/commission-service";
import { db } from "@/lib/db";
import {
  SALE_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  formatMoney,
  formatDateTime,
} from "../../work-labels";
import { SaleActions } from "./sale-actions";
import { RecordPaymentForm } from "./record-payment-form";
import { CalculateCommissionForm } from "./calculate-commission-form";

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
  const canViewFinance = ctx.permissions.has("finance.view");
  const canRecordPayment = ctx.permissions.has("finance.payment.create");
  const canViewCommission = ctx.permissions.has("commission.view");
  const canCalculateCommission = ctx.permissions.has("commission.manage");
  const isConfirmed = sale.status === "CONFIRMED";

  const [receivable, payments] =
    canViewFinance && isConfirmed
      ? await Promise.all([
          getCustomerReceivable(ctx.actor.id, ctx.company.id, sale.id),
          getPaymentList(ctx.actor.id, ctx.company.id, { saleId: sale.id }),
        ])
      : [null, []];

  const [commissionRules, commissionBreakdown, companyMembers] = canViewCommission
    ? await Promise.all([
        canCalculateCommission ? getCommissionRuleList(ctx.actor.id, ctx.company.id) : Promise.resolve([]),
        getSaleCommissionBreakdown(ctx.actor.id, ctx.company.id, sale.id),
        canCalculateCommission
          ? db.companyMembership.findMany({
              where: { companyId: ctx.company.id, status: "ACTIVE" },
              include: { user: true },
              orderBy: { createdAt: "asc" },
            })
          : Promise.resolve([]),
      ])
    : [[], [], []];

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

      {canViewFinance && isConfirmed ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-zinc-900">Công nợ &amp; thanh toán</h3>
          {receivable ? (
            <div className="rounded-md border border-zinc-200 bg-white p-4">
              <dl className="grid grid-cols-3 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-zinc-500">Tổng tiền</dt>
                  <dd className="text-zinc-900">{formatMoney(receivable.totalAmount)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Đã thu</dt>
                  <dd className="text-zinc-900">{formatMoney(receivable.paidAmount)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Còn phải thu</dt>
                  <dd className="font-medium text-zinc-900">{formatMoney(receivable.outstandingAmount)}</dd>
                </div>
              </dl>
            </div>
          ) : null}

          {canRecordPayment && receivable && receivable.outstandingAmount > 0 ? (
            <RecordPaymentForm companyId={ctx.company.id} saleId={sale.id} />
          ) : null}

          {payments.length === 0 ? (
            <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
              Chưa có thanh toán nào.
            </p>
          ) : (
            <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500">
                    <th className="px-4 py-2 font-medium">Ngày</th>
                    <th className="px-4 py-2 font-medium">Số tiền</th>
                    <th className="px-4 py-2 font-medium">Phương thức</th>
                    <th className="px-4 py-2 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-2 text-zinc-900">
                        <Link href={`/c/${code}/finance/payments/${p.id}`} className="hover:underline">
                          {formatDateTime(p.occurredAt.toISOString())}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-zinc-700">{formatMoney(Number(p.amount))}</td>
                      <td className="px-4 py-2 text-zinc-700">{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</td>
                      <td className="px-4 py-2 text-zinc-700">{PAYMENT_STATUS_LABEL[p.status] ?? p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </section>
      ) : null}

      {canViewCommission ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-zinc-900">Hoa hồng</h3>
          {commissionBreakdown.length === 0 ? (
            <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
              Chưa tính hoa hồng cho giao dịch này.
            </p>
          ) : (
            <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500">
                    <th className="px-4 py-2 font-medium">Người hưởng</th>
                    <th className="px-4 py-2 font-medium">Vai trò</th>
                    <th className="px-4 py-2 font-medium">Tỷ lệ</th>
                    <th className="px-4 py-2 font-medium">Số tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {commissionBreakdown.map((c) => (
                    <tr key={c.id} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-2 text-zinc-900">{c.user.displayName}</td>
                      <td className="px-4 py-2 text-zinc-700">{c.role}</td>
                      <td className="px-4 py-2 text-zinc-700">{(c.allocationBps / 100).toFixed(2)}%</td>
                      <td className="px-4 py-2 text-zinc-700">{formatMoney(Number(c.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {canCalculateCommission && isConfirmed ? (
            <CalculateCommissionForm
              companyId={ctx.company.id}
              saleId={sale.id}
              rules={commissionRules.filter((r) => r.status === "ACTIVE").map((r) => ({ id: r.id, name: r.name }))}
              contributors={companyMembers.map((m) => ({ id: m.userId, displayName: m.user.displayName }))}
              defaultContributorId={sale.salespersonUserId ?? undefined}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
