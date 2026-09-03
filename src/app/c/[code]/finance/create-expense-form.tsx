"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordExpenseAction } from "@/lib/actions/finance-actions";
import { EXPENSE_CATEGORY_LABEL } from "../work-labels";

const CATEGORIES = Object.entries(EXPENSE_CATEGORY_LABEL);

export function CreateExpenseForm({ companyId }: { companyId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; // capture trước closure async — quy ước dùng chung
        const formData = new FormData(form);
        setError(null);
        startTransition(async () => {
          try {
            await recordExpenseAction({
              companyId,
              category: String(
                formData.get("category") ?? "OTHER",
              ) as Parameters<typeof recordExpenseAction>[0]["category"],
              amount: Number(formData.get("amount") ?? 0),
              description: String(formData.get("description") ?? "") || undefined,
            });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể ghi nhận chi phí.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Hạng mục</label>
        <select name="category" defaultValue="OTHER" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
          {CATEGORIES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Số tiền</label>
        <input
          name="amount"
          type="number"
          min={1}
          step={1}
          required
          className="w-40 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Mô tả</label>
        <input
          name="description"
          maxLength={2000}
          placeholder="Mô tả khoản chi"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        Ghi nhận chi phí
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
