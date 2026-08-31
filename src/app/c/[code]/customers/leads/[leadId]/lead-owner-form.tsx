"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignLeadOwnerAction } from "@/lib/actions/lead-actions";

export function LeadOwnerForm({
  companyId,
  leadId,
  currentOwnerUserId,
  members,
}: {
  companyId: string;
  leadId: string;
  currentOwnerUserId: string | null;
  members: { id: string; displayName: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const ownerUserId = String(formData.get("ownerUserId") ?? "");
        setError(null);
        startTransition(async () => {
          try {
            await assignLeadOwnerAction({ companyId, leadId, ownerUserId });
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể đổi người phụ trách.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Người phụ trách</label>
        <select
          name="ownerUserId"
          defaultValue={currentOwnerUserId ?? ""}
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Chọn người phụ trách
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        Gán
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
