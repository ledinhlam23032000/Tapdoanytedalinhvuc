import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getCommissionRuleList } from "@/lib/domain/commission-service";
import { COMMISSION_RULE_TYPE_LABEL, COMMISSION_RULE_STATUS_LABEL } from "../../work-labels";
import { CreateCommissionRuleForm } from "./create-commission-rule-form";
import { CommissionRuleActions } from "./commission-rule-actions";

export const dynamic = "force-dynamic";

export default async function CommissionRulesPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ctx = await requireCompanyPageByCode(code, "commission.view");

  const rules = await getCommissionRuleList(ctx.actor.id, ctx.company.id);
  const canManage = ctx.permissions.has("commission.manage");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Quy tắc hoa hồng</h2>
        <p className="text-sm text-zinc-500">Danh sách quy tắc tính hoa hồng của công ty.</p>
      </div>

      {canManage ? <CreateCommissionRuleForm companyId={ctx.company.id} /> : null}

      {rules.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
          Chưa có quy tắc hoa hồng nào.
        </p>
      ) : (
        <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="px-4 py-2 font-medium">Tên</th>
                <th className="px-4 py-2 font-medium">Loại</th>
                <th className="px-4 py-2 font-medium">Trạng thái</th>
                {canManage ? <th className="px-4 py-2 font-medium">Hành động</th> : null}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2 text-zinc-700">{rule.name}</td>
                  <td className="px-4 py-2 text-zinc-700">{COMMISSION_RULE_TYPE_LABEL[rule.type] ?? rule.type}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                      {COMMISSION_RULE_STATUS_LABEL[rule.status] ?? rule.status}
                    </span>
                  </td>
                  {canManage ? (
                    <td className="px-4 py-2">
                      <CommissionRuleActions companyId={ctx.company.id} ruleId={rule.id} status={rule.status} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
