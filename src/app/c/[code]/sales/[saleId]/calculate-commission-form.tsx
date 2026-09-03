"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { calculateCommissionForSaleAction } from "@/lib/actions/commission-actions";

type RuleOption = { id: string; name: string };
type ContributorOption = { id: string; displayName: string };

// MVP: 1 contributor duy nhất (mặc định người bán), allocationBps mặc định
// 10000 (100%) — sửa được nếu cần chia nhiều người sau này qua form khác.
export function CalculateCommissionForm({
  companyId,
  saleId,
  rules,
  contributors,
  defaultContributorId,
}: {
  companyId: string;
  saleId: string;
  rules: RuleOption[];
  contributors: ContributorOption[];
  defaultContributorId?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (rules.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Chưa có Quy tắc hoa hồng đang hoạt động — thiết lập ở trang Lương → Quản lý quy tắc hoa hồng.
      </p>
    );
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        setError(null);
        startTransition(async () => {
          try {
            await calculateCommissionForSaleAction({
              companyId,
              saleId,
              ruleId: String(formData.get("ruleId") ?? ""),
              contributors: [
                {
                  userId: String(formData.get("userId") ?? ""),
                  role: "SALESPERSON",
                  allocationBps: 10_000,
                },
              ],
            });
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tính hoa hồng.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Quy tắc hoa hồng</label>
        <select name="ruleId" required className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
          {rules.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Người hưởng hoa hồng</label>
        <select
          name="userId"
          required
          defaultValue={defaultContributorId ?? ""}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Chọn người
          </option>
          {contributors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        Tính hoa hồng
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
