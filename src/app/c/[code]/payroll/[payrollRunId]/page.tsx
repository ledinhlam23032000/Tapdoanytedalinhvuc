import { Fragment } from "react";
import { notFound } from "next/navigation";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getPayrollRunDetail } from "@/lib/domain/payroll-service";
import { getApprovalRequestForTarget } from "@/lib/domain/approval-service";
import { AuthorizationError } from "@/lib/authorization/errors";
import { PAYROLL_RUN_STATUS_LABEL, formatMoney, formatDueDate, formatDateTime } from "../../work-labels";
import { PayrollRunActions, AdjustPayrollItemForm } from "./payroll-run-actions";

export const dynamic = "force-dynamic";

export default async function PayrollRunDetailPage({
  params,
}: {
  params: Promise<{ code: string; payrollRunId: string }>;
}) {
  const { code, payrollRunId } = await params;
  const ctx = await requireCompanyPageByCode(code, "payroll.view");

  let detail;
  try {
    detail = await getPayrollRunDetail(ctx.actor.id, ctx.company.id, payrollRunId);
  } catch (err) {
    if (!(err instanceof AuthorizationError)) {
      console.error(err);
    }
    notFound();
  }
  if (!detail) notFound();
  const { run, items } = detail;

  const canManage = ctx.permissions.has("payroll.manage");

  const approvalRequestRaw =
    canManage && run.status === "APPROVED"
      ? await getApprovalRequestForTarget(ctx.company.id, "PAYROLL_FINALIZE", run.id)
      : null;
  const approvalRequest =
    approvalRequestRaw &&
    (approvalRequestRaw.status === "PENDING" ||
      approvalRequestRaw.status === "PENDING_SECOND" ||
      approvalRequestRaw.status === "APPROVED")
      ? {
          id: approvalRequestRaw.id,
          status: approvalRequestRaw.status,
          firstApprovedByDisplayName: approvalRequestRaw.firstApprovedByUser?.displayName ?? null,
        }
      : null;

  const canAdjustItems = canManage && (run.status === "DRAFT" || run.status === "CALCULATED");
  const columnCount = canAdjustItems ? 7 : 6;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">
            Kỳ lương {formatDueDate(run.periodStart.toISOString())} – {formatDueDate(run.periodEnd.toISOString())}
          </h2>
          <p className="mt-2">
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              {PAYROLL_RUN_STATUS_LABEL[run.status] ?? run.status}
            </span>
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
          Chưa có dữ liệu lương — bấm &quot;Tính lương&quot; để tạo danh sách.
        </p>
      ) : (
        <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="px-4 py-2 font-medium">Nhân viên</th>
                <th className="px-4 py-2 font-medium">Lương cơ bản</th>
                <th className="px-4 py-2 font-medium">Hoa hồng</th>
                <th className="px-4 py-2 font-medium">Thưởng</th>
                <th className="px-4 py-2 font-medium">Khấu trừ</th>
                <th className="px-4 py-2 font-medium">Thực nhận</th>
                {canAdjustItems ? <th className="px-4 py-2 font-medium">Điều chỉnh</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <Fragment key={item.id}>
                  <tr>
                    <td className="px-4 py-2 text-zinc-700">{item.user.displayName}</td>
                    <td className="px-4 py-2 text-zinc-700">{formatMoney(Number(item.baseAmount))}</td>
                    <td className="px-4 py-2 text-zinc-700">{formatMoney(Number(item.commissionAmount))}</td>
                    <td className="px-4 py-2 text-zinc-700">{formatMoney(Number(item.bonusAmount))}</td>
                    <td className="px-4 py-2 text-zinc-700">{formatMoney(Number(item.deductionAmount))}</td>
                    <td className="px-4 py-2 text-zinc-700">{formatMoney(Number(item.netAmount))}</td>
                    {canAdjustItems ? (
                      <td className="px-4 py-2">
                        <AdjustPayrollItemForm
                          companyId={ctx.company.id}
                          payrollItemId={item.id}
                          currentBonusAmount={Number(item.bonusAmount)}
                          currentDeductionAmount={Number(item.deductionAmount)}
                        />
                      </td>
                    ) : null}
                  </tr>
                  <tr className="border-b border-zinc-100 last:border-0">
                    <td colSpan={columnCount} className="px-4 pb-2 text-xs text-zinc-400">
                      (xem chi tiết tính toán trong dữ liệu hệ thống)
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {canManage ? (
        run.status === "FINALIZED" ? (
          <p className="text-sm text-zinc-500">
            Đã chốt sổ lúc {formatDateTime(run.finalizedAt ? run.finalizedAt.toISOString() : null)}.
          </p>
        ) : (
          <PayrollRunActions
            companyId={ctx.company.id}
            payrollRunId={run.id}
            status={run.status}
            approvalRequest={approvalRequest}
          />
        )
      ) : null}
    </div>
  );
}
