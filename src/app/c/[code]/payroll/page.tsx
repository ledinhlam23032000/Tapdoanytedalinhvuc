import Link from "next/link";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getPayrollRunList } from "@/lib/domain/payroll-service";
import { PAYROLL_RUN_STATUS_LABEL, formatDueDate } from "../work-labels";
import { CreatePayrollRunForm } from "./create-payroll-run-form";

export const dynamic = "force-dynamic";

export default async function PayrollPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ctx = await requireCompanyPageByCode(code, "payroll.view");

  const runs = await getPayrollRunList(ctx.actor.id, ctx.company.id);
  const canManage = ctx.permissions.has("payroll.manage");
  const canManageCommission = ctx.permissions.has("commission.manage");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Lương</h2>
        <p className="text-sm text-zinc-500">Các kỳ lương của công ty.</p>
      </div>

      {canManage ? <CreatePayrollRunForm companyId={ctx.company.id} code={code} /> : null}

      {runs.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
          Chưa có kỳ lương nào.
        </p>
      ) : (
        <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="px-4 py-2 font-medium">Kỳ</th>
                <th className="px-4 py-2 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/c/${code}/payroll/${run.id}`} className="text-zinc-900 hover:underline">
                      {formatDueDate(run.periodStart.toISOString())} – {formatDueDate(run.periodEnd.toISOString())}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                      {PAYROLL_RUN_STATUS_LABEL[run.status] ?? run.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="flex flex-col gap-1 text-sm">
        <Link href={`/c/${code}/payroll/profiles`} className="text-zinc-900 hover:underline">
          Thiết lập lương nhân viên →
        </Link>
        {canManageCommission ? (
          <Link href={`/c/${code}/payroll/commission-rules`} className="text-zinc-900 hover:underline">
            Quản lý quy tắc hoa hồng →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
