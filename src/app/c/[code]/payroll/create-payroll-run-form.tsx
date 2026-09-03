"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPayrollRunAction } from "@/lib/actions/payroll-actions";

export function CreatePayrollRunForm({ companyId, code }: { companyId: string; code: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; // capture trước closure async
        const formData = new FormData(form);
        const periodStart = String(formData.get("periodStart") ?? "");
        const periodEnd = String(formData.get("periodEnd") ?? "");
        setError(null);
        startTransition(async () => {
          try {
            const result = await createPayrollRunAction({
              companyId,
              periodStart: new Date(periodStart),
              periodEnd: new Date(periodEnd),
            });
            router.push(`/c/${code}/payroll/${result.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tạo kỳ lương.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Từ ngày</label>
        <input
          name="periodStart"
          type="date"
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Đến ngày</label>
        <input
          name="periodEnd"
          type="date"
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        Tạo kỳ lương
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
