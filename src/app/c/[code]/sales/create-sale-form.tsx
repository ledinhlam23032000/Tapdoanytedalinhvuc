"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSaleAction } from "@/lib/actions/sales-actions";
import { formatMoney } from "../work-labels";

type CustomerOption = { id: string; name: string };
type CatalogItemOption = { id: string; name: string; defaultPrice: number | null };
type MemberOption = { id: string; displayName: string };

type LineDraft = {
  catalogItemId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
};

function emptyLine(): LineDraft {
  return { catalogItemId: "", description: "", quantity: 1, unitPrice: 0, discountAmount: 0 };
}

export function CreateSaleForm({
  companyId,
  code,
  customers,
  catalogItems,
  companyMembers,
  initialCustomerId,
}: {
  companyId: string;
  code: string;
  customers: CustomerOption[];
  catalogItems: CatalogItemOption[];
  companyMembers: MemberOption[];
  initialCustomerId?: string;
}) {
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Chỉ để hiển thị preview — nguồn sự thật thật sự là calculateSaleTotals
  // phía server (xem createSaleAction -> createSale -> calculateSaleTotals).
  const previewTotal = lines.reduce(
    (sum, l) => sum + Math.max(0, l.quantity * l.unitPrice - (l.discountAmount ?? 0)),
    0,
  );

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function handleCatalogItemChange(index: number, catalogItemId: string) {
    const item = catalogItems.find((ci) => ci.id === catalogItemId);
    setLines((prev) =>
      prev.map((line, i) =>
        i === index
          ? {
              ...line,
              catalogItemId,
              description: item ? item.name : line.description,
              unitPrice: item && item.defaultPrice !== null ? item.defaultPrice : line.unitPrice,
            }
          : line,
      ),
    );
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; // capture trước closure async — xem quy ước dùng chung
        const formData = new FormData(form);
        const customerId = String(formData.get("customerId") ?? "");
        const salespersonUserId = String(formData.get("salespersonUserId") ?? "");
        setError(null);
        startTransition(async () => {
          try {
            const sale = await createSaleAction({
              companyId,
              customerId: customerId || undefined,
              salespersonUserId: salespersonUserId || undefined,
              lines: lines.map((l) => ({
                catalogItemId: l.catalogItemId || undefined,
                description: l.description,
                quantity: Number(l.quantity),
                unitPrice: Number(l.unitPrice),
                discountAmount: l.discountAmount ? Number(l.discountAmount) : undefined,
              })),
            });
            router.push(`/c/${code}/sales/${sale.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tạo giao dịch.");
          }
        });
      }}
    >
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Khách hàng</label>
          <select
            name="customerId"
            defaultValue={initialCustomerId ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Khách lẻ</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Người bán</label>
          <select
            name="salespersonUserId"
            defaultValue=""
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Tôi (mặc định)</option>
            {companyMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-sm font-medium text-zinc-700">Dòng hàng</label>
        {lines.map((line, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2 rounded-md border border-zinc-200 p-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Sản phẩm/Dịch vụ</label>
              <select
                value={line.catalogItemId}
                onChange={(e) => handleCatalogItemChange(index, e.target.value)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">Tự nhập</option>
                {catalogItems.map((ci) => (
                  <option key={ci.id} value={ci.id}>
                    {ci.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Mô tả</label>
              <input
                required
                value={line.description}
                onChange={(e) => updateLine(index, { description: e.target.value })}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Mô tả dòng hàng"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Số lượng</label>
              <input
                type="number"
                min={1}
                step={1}
                value={line.quantity}
                onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                className="w-24 rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Đơn giá</label>
              <input
                type="number"
                min={0}
                step={1000}
                value={line.unitPrice}
                onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) })}
                className="w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Chiết khấu</label>
              <input
                type="number"
                min={0}
                step={1000}
                value={line.discountAmount}
                onChange={(e) => updateLine(index, { discountAmount: Number(e.target.value) })}
                className="w-28 rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => removeLine(index)}
              className="text-sm text-red-600 hover:underline"
            >
              Xoá
            </button>
          </div>
        ))}
        <div>
          <button type="button" onClick={addLine} className="text-sm text-zinc-900 hover:underline">
            + Thêm dòng
          </button>
        </div>
      </div>

      <p className="text-sm text-zinc-700">
        Tạm tính: <span className="font-medium text-zinc-900">{formatMoney(previewTotal)}</span>
      </p>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Tạo giao dịch
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
