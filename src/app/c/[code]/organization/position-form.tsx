"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPositionAction } from "@/lib/actions/organization-actions";

export function PositionForm({ companyId }: { companyId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setError(null);
        const form = e.currentTarget;
        startTransition(async () => {
          try {
            await createPositionAction({ companyId, name: String(formData.get("name") ?? "") });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tạo vị trí.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Tên vị trí</label>
        <input
          name="name"
          required
          maxLength={120}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          placeholder="Ví dụ: Trưởng phòng, Nhân viên tư vấn"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        Thêm vị trí
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
