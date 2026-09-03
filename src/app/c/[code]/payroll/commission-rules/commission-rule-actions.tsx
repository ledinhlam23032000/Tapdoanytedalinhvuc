"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCommissionRuleStatusAction } from "@/lib/actions/commission-actions";

export function CommissionRuleActions({
  companyId,
  ruleId,
  status,
}: {
  companyId: string;
  ruleId: string;
  status: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể cập nhật quy tắc hoa hồng.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        {status === "DRAFT" ? (
          <button
            disabled={pending}
            onClick={() => run(() => updateCommissionRuleStatusAction(companyId, ruleId, "ACTIVE"))}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Kích hoạt
          </button>
        ) : null}
        {status === "ACTIVE" ? (
          <button
            disabled={pending}
            onClick={() => {
              if (window.confirm("Ngừng áp dụng quy tắc hoa hồng này?")) {
                run(() => updateCommissionRuleStatusAction(companyId, ruleId, "RETIRED"));
              }
            }}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            Ngừng áp dụng
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
