import { notFound } from "next/navigation";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getExpenseDetail } from "@/lib/domain/finance-service";
import { db } from "@/lib/db";
import { EXPENSE_CATEGORY_LABEL, PAYMENT_STATUS_LABEL, formatMoney, formatDateTime } from "../../../work-labels";
import { VoidExpenseButton } from "./void-expense-button";

export const dynamic = "force-dynamic";

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ code: string; expenseId: string }>;
}) {
  const { code, expenseId } = await params;
  const ctx = await requireCompanyPageByCode(code, "finance.view");

  let expense;
  try {
    expense = await getExpenseDetail(ctx.actor.id, ctx.company.id, expenseId);
  } catch {
    notFound();
  }
  if (!expense) notFound();

  // Expense không include quan hệ createdBy — tra người tạo trực tiếp qua db
  // (mirror pattern db.companyMembership.findMany trong sales/page.tsx).
  const creator = await db.user.findUnique({ where: { id: expense.createdByUserId } });

  const canVoid = expense.status === "POSTED" && ctx.permissions.has("finance.expense.void");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-500">Chi phí</p>
          <div className="mt-1 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              {EXPENSE_CATEGORY_LABEL[expense.category] ?? expense.category}
            </h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              {PAYMENT_STATUS_LABEL[expense.status] ?? expense.status}
            </span>
          </div>
        </div>
        {canVoid ? <VoidExpenseButton companyId={ctx.company.id} expenseId={expense.id} /> : null}
      </div>

      <div className="rounded-md border border-zinc-200 bg-white p-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-zinc-500">Số tiền</dt>
            <dd className="font-medium text-zinc-900">{formatMoney(Number(expense.amount))}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Thời điểm</dt>
            <dd className="text-zinc-900">{formatDateTime(expense.occurredAt.toISOString())}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Người tạo</dt>
            <dd className="text-zinc-900">{creator?.displayName ?? "—"}</dd>
          </div>
          {expense.organizationUnit ? (
            <div>
              <dt className="text-zinc-500">Đơn vị</dt>
              <dd className="text-zinc-900">{expense.organizationUnit.name}</dd>
            </div>
          ) : null}
          {expense.project ? (
            <div>
              <dt className="text-zinc-500">Dự án</dt>
              <dd className="text-zinc-900">{expense.project.name}</dd>
            </div>
          ) : null}
          {expense.description ? (
            <div className="sm:col-span-3">
              <dt className="text-zinc-500">Mô tả</dt>
              <dd className="text-zinc-900">{expense.description}</dd>
            </div>
          ) : null}
          {expense.status === "VOID" && expense.voidReason ? (
            <div className="sm:col-span-3">
              <dt className="text-zinc-500">Lý do huỷ</dt>
              <dd className="text-zinc-900">{expense.voidReason}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}
