"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPayrollProfileAction } from "@/lib/actions/payroll-actions";

export function SetPayrollProfileForm({ companyId, userId }: { companyId: string; userId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; // capture trước closure async
        const formData = new FormData(form);
        setError(null);
        startTransition(async () => {
          try {
            await setPayrollProfileAction({
              companyId,
              userId,
              baseSalary: Number(formData.get("baseSalary") ?? 0),
            });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể thiết lập lương.");
          }
        });
      }}
    >
      <input
        name="baseSalary"
        type="number"
        min={1}
        step={1}
        required
        placeholder="Lương cơ bản mới"
        className="w-40 rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        Lưu
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
