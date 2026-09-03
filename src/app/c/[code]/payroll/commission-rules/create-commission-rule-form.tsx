"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCommissionRuleAction } from "@/lib/actions/commission-actions";

type RuleType = "PERCENTAGE_OF_SALE" | "FIXED_PER_ITEM" | "TIERED_THRESHOLD";

const TYPE_OPTIONS: { value: RuleType; label: string }[] = [
  { value: "PERCENTAGE_OF_SALE", label: "Phần trăm doanh thu" },
  { value: "FIXED_PER_ITEM", label: "Cố định theo sản phẩm" },
  { value: "TIERED_THRESHOLD", label: "Theo bậc doanh số" },
];

/** MVP đơn giản (theo yêu cầu): chỉ loại PERCENTAGE_OF_SALE có input riêng
 * (percentageBps). 2 loại còn lại nhập config thô dạng JSON — không xây form
 * động phức tạp cho từng loại. */
export function CreateCommissionRuleForm({ companyId }: { companyId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<RuleType>("PERCENTAGE_OF_SALE");
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; // capture trước closure async
        const formData = new FormData(form);
        const name = String(formData.get("name") ?? "");
        const selectedType = String(formData.get("type") ?? "PERCENTAGE_OF_SALE") as RuleType;

        let config: Record<string, unknown>;
        if (selectedType === "PERCENTAGE_OF_SALE") {
          config = { percentageBps: Number(formData.get("percentageBps") ?? 0) };
        } else {
          const raw = String(formData.get("configJson") ?? "").trim();
          try {
            config = raw ? JSON.parse(raw) : {};
          } catch {
            setError("Config JSON không hợp lệ — kiểm tra lại cú pháp.");
            return;
          }
        }

        setError(null);
        startTransition(async () => {
          try {
            await createCommissionRuleAction({ companyId, name, type: selectedType, config });
            form.reset();
            setType("PERCENTAGE_OF_SALE");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tạo quy tắc hoa hồng.");
          }
        });
      }}
    >
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Tên quy tắc</label>
          <input
            name="name"
            required
            maxLength={200}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Loại</label>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as RuleType)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {type === "PERCENTAGE_OF_SALE" ? (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Phần trăm (phần vạn — 500 = 5%)</label>
          <input
            name="percentageBps"
            type="number"
            min={0}
            max={10000}
            step={1}
            required
            className="w-48 rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Config (JSON thô)</label>
          <textarea
            name="configJson"
            rows={3}
            placeholder={
              type === "FIXED_PER_ITEM"
                ? '{"amountPerItem": 10000}'
                : '{"tiers": [{"minAmount": 0, "bps": 200}]}'
            }
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Tạo quy tắc
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
