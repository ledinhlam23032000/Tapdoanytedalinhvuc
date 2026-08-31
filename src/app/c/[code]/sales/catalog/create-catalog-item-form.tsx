"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCatalogItemAction } from "@/lib/actions/sales-actions";

export function CreateCatalogItemForm({ companyId }: { companyId: string }) {
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
        const defaultPriceRaw = String(formData.get("defaultPrice") ?? "");
        setError(null);
        startTransition(async () => {
          try {
            await createCatalogItemAction({
              companyId,
              name: String(formData.get("name") ?? ""),
              type: formData.get("type") as "PRODUCT" | "SERVICE",
              defaultPrice: defaultPriceRaw ? Number(defaultPriceRaw) : undefined,
            });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tạo sản phẩm/dịch vụ.");
          }
        });
      }}
    >
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Tên</label>
          <input
            name="name"
            required
            maxLength={200}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Ví dụ: Khám tổng quát"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Loại</label>
          <select name="type" defaultValue="SERVICE" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
            <option value="PRODUCT">Sản phẩm</option>
            <option value="SERVICE">Dịch vụ</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Giá mặc định (tuỳ chọn)</label>
          <input
            name="defaultPrice"
            type="number"
            min={0}
            step={1000}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Thêm sản phẩm/dịch vụ
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
