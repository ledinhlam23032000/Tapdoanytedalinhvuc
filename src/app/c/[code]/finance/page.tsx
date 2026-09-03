import Link from "next/link";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getPaymentList, getExpenseList, getLedgerEntries } from "@/lib/domain/finance-service";
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  EXPENSE_CATEGORY_LABEL,
  LEDGER_ENTRY_TYPE_LABEL,
  formatMoney,
  formatDateTime,
} from "../work-labels";
import { CreateExpenseForm } from "./create-expense-form";

export const dynamic = "force-dynamic";

type TabValue = "payments" | "expenses" | "ledger";

const TABS: { value: TabValue; label: string }[] = [
  { value: "payments", label: "Thanh toán" },
  { value: "expenses", label: "Chi phí" },
  { value: "ledger", label: "Sổ cái" },
];

export default async function FinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { code } = await params;
  const { tab } = await searchParams;
  const ctx = await requireCompanyPageByCode(code, "finance.view");

  const activeTab: TabValue = tab === "expenses" || tab === "ledger" ? tab : "payments";

  // Chỉ tải danh sách của tab đang xem — mirror pattern sales/page.tsx
  // (mayManage ? fetch : Promise.resolve([])).
  const [payments, expenses, ledgerEntries] = await Promise.all([
    activeTab === "payments" ? getPaymentList(ctx.actor.id, ctx.company.id) : Promise.resolve([]),
    activeTab === "expenses" ? getExpenseList(ctx.actor.id, ctx.company.id) : Promise.resolve([]),
    activeTab === "ledger" ? getLedgerEntries(ctx.actor.id, ctx.company.id) : Promise.resolve([]),
  ]);

  const canCreateExpense = ctx.permissions.has("finance.expense.create");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Tài chính</h2>
        <p className="text-sm text-zinc-500">Thanh toán, chi phí và sổ cái của công ty.</p>
      </div>

      <nav className="flex flex-wrap gap-4 border-b border-zinc-200 pb-2 text-sm">
        {TABS.map((t) => {
          const isActive = activeTab === t.value;
          const href = t.value === "payments" ? `/c/${code}/finance` : `/c/${code}/finance?tab=${t.value}`;
          return (
            <Link
              key={t.value}
              href={href}
              className={isActive ? "font-medium text-zinc-900" : "text-zinc-500 hover:text-zinc-700"}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {activeTab === "payments" ? (
        payments.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            Chưa có khoản thanh toán nào.
          </p>
        ) : (
          <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="px-4 py-2 font-medium">Ngày</th>
                  <th className="px-4 py-2 font-medium">Giao dịch</th>
                  <th className="px-4 py-2 font-medium">Số tiền</th>
                  <th className="px-4 py-2 font-medium">Phương thức</th>
                  <th className="px-4 py-2 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2 text-zinc-700">{formatDateTime(p.occurredAt.toISOString())}</td>
                    <td className="px-4 py-2">
                      <Link href={`/c/${code}/finance/payments/${p.id}`} className="text-zinc-900 hover:underline">
                        {p.sale.code ?? p.sale.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-700">{formatMoney(Number(p.amount))}</td>
                    <td className="px-4 py-2 text-zinc-700">{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</td>
                    <td className="px-4 py-2 text-zinc-700">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        {PAYMENT_STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      ) : null}

      {activeTab === "expenses" ? (
        expenses.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            Chưa có khoản chi nào.
          </p>
        ) : (
          <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="px-4 py-2 font-medium">Ngày</th>
                  <th className="px-4 py-2 font-medium">Hạng mục</th>
                  <th className="px-4 py-2 font-medium">Số tiền</th>
                  <th className="px-4 py-2 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2 text-zinc-700">{formatDateTime(e.occurredAt.toISOString())}</td>
                    <td className="px-4 py-2">
                      <Link href={`/c/${code}/finance/expenses/${e.id}`} className="text-zinc-900 hover:underline">
                        {EXPENSE_CATEGORY_LABEL[e.category] ?? e.category}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-700">{formatMoney(Number(e.amount))}</td>
                    <td className="px-4 py-2 text-zinc-700">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        {PAYMENT_STATUS_LABEL[e.status] ?? e.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      ) : null}

      {activeTab === "ledger" ? (
        ledgerEntries.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            Chưa có bút toán sổ cái nào.
          </p>
        ) : (
          <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="px-4 py-2 font-medium">Ngày</th>
                  <th className="px-4 py-2 font-medium">Loại</th>
                  <th className="px-4 py-2 font-medium">Số tiền</th>
                  <th className="px-4 py-2 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2 text-zinc-700">{formatDateTime(entry.occurredAt.toISOString())}</td>
                    <td className="px-4 py-2 text-zinc-700">{LEDGER_ENTRY_TYPE_LABEL[entry.type] ?? entry.type}</td>
                    <td className="px-4 py-2 text-zinc-700">{formatMoney(Number(entry.amount))}</td>
                    <td className="px-4 py-2 text-zinc-700">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        {PAYMENT_STATUS_LABEL[entry.status] ?? entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      ) : null}

      {canCreateExpense ? <CreateExpenseForm companyId={ctx.company.id} /> : null}

      <p className="text-sm text-zinc-500">
        Để ghi nhận thanh toán, vào chi tiết một giao dịch bán hàng đã xác nhận.{" "}
        <Link href={`/c/${code}/sales`} className="text-zinc-900 hover:underline">
          Xem danh sách giao dịch →
        </Link>
      </p>
    </div>
  );
}
