"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordCustomerInteractionAction } from "@/lib/actions/customer-actions";
import { CUSTOMER_INTERACTION_TYPE_LABEL } from "../../work-labels";

export function AddInteractionForm({ companyId, customerId }: { companyId: string; customerId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        setError(null);
        startTransition(async () => {
          try {
            await recordCustomerInteractionAction({
              companyId,
              customerId,
              type: formData.get("type") as "CALL" | "SMS" | "CHAT" | "MEETING" | "EMAIL" | "NOTE",
              summary: String(formData.get("summary") ?? ""),
            });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể ghi nhận tương tác.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Loại</label>
        <select
          name="type"
          defaultValue="NOTE"
          className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          {Object.entries(CUSTOMER_INTERACTION_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Nội dung</label>
        <textarea
          name="summary"
          required
          rows={2}
          maxLength={4000}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Ghi nhận
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
