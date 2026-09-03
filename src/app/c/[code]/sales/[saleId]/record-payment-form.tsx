"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPaymentAction } from "@/lib/actions/finance-actions";

const METHODS: { value: string; label: string }[] = [
  { value: "CASH", label: "Tiền mặt" },
  { value: "BANK_TRANSFER", label: "Chuyển khoản" },
  { value: "CARD", label: "Thẻ" },
  { value: "EWALLET", label: "Ví điện tử" },
  { value: "OTHER", label: "Khác" },
];

export function RecordPaymentForm({ companyId, saleId }: { companyId: string; saleId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  // Ổn định qua mọi lần double-click/network-retry của CÙNG 1 lần submit
  // (ADR-034) — sinh key mới sau khi thành công (chuẩn bị cho khoản thanh
  // toán TIẾP THEO, không phải retry của khoản vừa xong). Server vẫn khoá
  // row Sale (finance-service.ts) để chặn 2 khoản thanh toán KHÁC NHAU thật
  // sự cùng lúc — idempotencyKey chỉ chặn trùng đúng 1 request.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        setError(null);
        startTransition(async () => {
          try {
            await recordPaymentAction({
              companyId,
              saleId,
              amount: Number(formData.get("amount") ?? 0),
              method: String(formData.get("method") ?? "CASH") as Parameters<typeof recordPaymentAction>[0]["method"],
              reference: String(formData.get("reference") ?? "") || undefined,
              idempotencyKey,
            });
            form.reset();
            setIdempotencyKey(crypto.randomUUID());
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể ghi nhận thanh toán.");
          }
        });
      }}
    >
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
        <label className="text-sm font-medium text-zinc-700">Phương thức</label>
        <select name="method" defaultValue="CASH" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
          {METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Tham chiếu</label>
        <input name="reference" maxLength={500} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        Ghi nhận thanh toán
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
