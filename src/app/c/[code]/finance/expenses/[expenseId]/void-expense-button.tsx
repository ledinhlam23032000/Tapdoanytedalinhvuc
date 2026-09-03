"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { voidExpenseAction } from "@/lib/actions/finance-actions";

export function VoidExpenseButton({ companyId, expenseId }: { companyId: string; expenseId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể huỷ khoản chi.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        disabled={pending}
        onClick={() => {
          // Void expense là hành động rủi ro cao — bắt buộc nhập lý do trước
          // khi gọi action (rỗng/huỷ hộp thoại thì không làm gì).
          const reason = window.prompt("Lý do huỷ khoản chi?");
          if (!reason) return;
          run(() => voidExpenseAction(companyId, expenseId, reason));
        }}
        className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        Huỷ khoản chi
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
