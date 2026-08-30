"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCompanyAction } from "@/lib/actions/company-actions";

// Form tối thiểu theo Master Prompt mục CCXV — không >4 field.
export function CreateCompanyForm({ ecosystemId }: { ecosystemId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-start rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-500"
      >
        + Tạo công ty
      </button>
    );
  }

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
            const company = await createCompanyAction({
              ecosystemId,
              name: String(formData.get("name") ?? ""),
              code: String(formData.get("code") ?? ""),
              type: formData.get("type") as "GENERAL" | "HEALTHCARE" | "OTHER",
              currency: "VND",
              timezone: "Asia/Ho_Chi_Minh",
            });
            router.push(`/c/${company.code}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tạo công ty.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Tên công ty</label>
        <input name="name" required maxLength={120} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Mã công ty (dùng trong đường dẫn)</label>
        <input
          name="code"
          required
          maxLength={40}
          pattern="[a-z0-9-]+"
          placeholder="vd: hong-phuc"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Loại hình</label>
        <select name="type" defaultValue="GENERAL" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
          <option value="GENERAL">Tổng quát</option>
          <option value="HEALTHCARE">Y tế</option>
          <option value="OTHER">Khác</option>
        </select>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {pending ? "Đang tạo..." : "Tạo công ty"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700"
        >
          Huỷ
        </button>
      </div>
    </form>
  );
}
