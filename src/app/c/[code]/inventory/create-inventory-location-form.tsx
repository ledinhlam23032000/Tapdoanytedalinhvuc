"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInventoryLocationAction } from "@/lib/actions/inventory-actions";
import { INVENTORY_LOCATION_TYPE_LABEL } from "../work-labels";

const LOCATION_TYPES = ["WAREHOUSE", "BRANCH", "STORAGE"] as const;

export function CreateInventoryLocationForm({ companyId }: { companyId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; // BAT BUOC capture TRUOC closure async
        const formData = new FormData(form);
        const name = String(formData.get("name") ?? "");
        const type = String(formData.get("type") ?? "");
        setError(null);
        startTransition(async () => {
          try {
            await createInventoryLocationAction({
              companyId,
              name,
              type: (type || undefined) as "WAREHOUSE" | "BRANCH" | "STORAGE" | undefined,
            });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tạo kho/địa điểm.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Tên</label>
        <input name="name" required className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Loại</label>
        <select name="type" defaultValue="WAREHOUSE" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
          {LOCATION_TYPES.map((t) => (
            <option key={t} value={t}>
              {INVENTORY_LOCATION_TYPE_LABEL[t] ?? t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Tạo
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
