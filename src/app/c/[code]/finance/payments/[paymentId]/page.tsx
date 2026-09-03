import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getPaymentDetail } from "@/lib/domain/finance-service";
import { db } from "@/lib/db";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, formatMoney, formatDateTime } from "../../../work-labels";
import { VoidPaymentButton } from "./void-payment-button";

export const dynamic = "force-dynamic";

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ code: string; paymentId: string }>;
}) {
  const { code, paymentId } = await params;
  const ctx = await requireCompanyPageByCode(code, "finance.view");

  let payment;
  try {
    payment = await getPaymentDetail(ctx.actor.id, ctx.company.id, paymentId);
  } catch {
    notFound();
  }
  if (!payment) notFound();

  // Payment không include quan hệ createdBy — tra người tạo trực tiếp qua db
  // (mirror pattern db.companyMembership.findMany trong sales/page.tsx).
  const creator = await db.user.findUnique({ where: { id: payment.createdByUserId } });

  const canVoid = payment.status === "POSTED" && ctx.permissions.has("finance.payment.void");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-500">Thanh toán</p>
          <div className="mt-1 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">{formatMoney(Number(payment.amount))}</h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              {PAYMENT_STATUS_LABEL[payment.status] ?? payment.status}
            </span>
          </div>
        </div>
        {canVoid ? <VoidPaymentButton companyId={ctx.company.id} paymentId={payment.id} /> : null}
      </div>

      <div className="rounded-md border border-zinc-200 bg-white p-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-zinc-500">Giao dịch</dt>
            <dd className="text-zinc-900">
              <Link href={`/c/${code}/sales/${payment.sale.id}`} className="text-zinc-900 hover:underline">
                {payment.sale.code ?? payment.sale.id.slice(0, 8)}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Khách hàng</dt>
            <dd className="text-zinc-900">{payment.sale.customer?.name ?? "Khách lẻ"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Phương thức</dt>
            <dd className="text-zinc-900">{PAYMENT_METHOD_LABEL[payment.method] ?? payment.method}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Thời điểm</dt>
            <dd className="text-zinc-900">{formatDateTime(payment.occurredAt.toISOString())}</dd>
          </div>
          {payment.reference ? (
            <div>
              <dt className="text-zinc-500">Tham chiếu</dt>
              <dd className="text-zinc-900">{payment.reference}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-zinc-500">Người tạo</dt>
            <dd className="text-zinc-900">{creator?.displayName ?? "—"}</dd>
          </div>
          {payment.status === "VOID" && payment.voidReason ? (
            <div className="sm:col-span-3">
              <dt className="text-zinc-500">Lý do huỷ</dt>
              <dd className="text-zinc-900">{payment.voidReason}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}
