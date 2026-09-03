"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInventoryItemAction } from "@/lib/actions/inventory-actions";

export function CreateInventoryItemForm({ companyId }: { companyId: string }) {
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
        const sku = String(formData.get("sku") ?? "").trim();
        const unit = String(formData.get("unit") ?? "");
        const reorderLevelRaw = String(formData.get("reorderLevel") ?? "").trim();
        setError(null);
        startTransition(async () => {
          try {
            await createInventoryItemAction({
              companyId,
              name,
              unit,
              sku: sku || undefined,
              reorderLevel: reorderLevelRaw ? Number(reorderLevelRaw) : undefined,
            });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tạo sản phẩm/vật tư.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Tên</label>
        <input name="name" required className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">SKU</label>
        <input name="sku" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Đơn vị tính</label>
        <input name="unit" required placeholder="cái, hộp, kg..." className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Ngưỡng cảnh báo tồn thấp</label>
        <input
          name="reorderLevel"
          type="number"
          min={0}
          step="any"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
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
