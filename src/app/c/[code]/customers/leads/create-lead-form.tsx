"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLeadAction } from "@/lib/actions/lead-actions";

export function CreateLeadForm({
  companyId,
  sources,
  owners,
}: {
  companyId: string;
  sources: { id: string; name: string }[];
  owners: { id: string; displayName: string }[];
}) {
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
            await createLeadAction({
              companyId,
              name: String(formData.get("name") ?? ""),
              phone: String(formData.get("phone") ?? "") || undefined,
              sourceId: String(formData.get("sourceId") ?? "") || undefined,
              ownerUserId: String(formData.get("ownerUserId") ?? "") || undefined,
            });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tạo Lead.");
          }
        });
      }}
    >
      <h3 className="text-sm font-semibold text-zinc-900">Thêm Lead</h3>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Tên</label>
        <input name="name" required maxLength={200} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Điện thoại</label>
          <input name="phone" maxLength={30} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </div>
        {sources.length > 0 ? (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Nguồn</label>
            <select name="sourceId" defaultValue="" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
              <option value="">—</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {owners.length > 0 ? (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Người phụ trách</label>
            <select
              name="ownerUserId"
              defaultValue=""
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.displayName}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Tạo Lead
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
