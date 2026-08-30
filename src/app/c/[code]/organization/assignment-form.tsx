"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAssignmentAction } from "@/lib/actions/organization-actions";

type Option = { id: string; name?: string; displayName?: string };

export function AssignmentForm({
  companyId,
  members,
  positions,
  units,
}: {
  companyId: string;
  members: { id: string; displayName: string }[];
  positions: Option[];
  units: Option[];
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
        const organizationUnitId = String(formData.get("organizationUnitId") ?? "");
        setError(null);
        const form = e.currentTarget;
        startTransition(async () => {
          try {
            await createAssignmentAction({
              companyId,
              userId: String(formData.get("userId") ?? ""),
              positionId: String(formData.get("positionId") ?? ""),
              organizationUnitId: organizationUnitId || undefined,
            });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể gán vị trí.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Người</label>
        <select name="userId" required defaultValue="" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
          <option value="" disabled>
            Chọn người
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Vị trí</label>
        <select name="positionId" required defaultValue="" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
          <option value="" disabled>
            Chọn vị trí
          </option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {units.length > 0 ? (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Đơn vị (tuỳ chọn)</label>
          <select name="organizationUnitId" defaultValue="" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
            <option value="">—</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        Gán vị trí
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
