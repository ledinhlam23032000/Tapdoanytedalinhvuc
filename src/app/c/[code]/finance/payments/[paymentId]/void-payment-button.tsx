"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { voidPaymentAction } from "@/lib/actions/finance-actions";

export function VoidPaymentButton({ companyId, paymentId }: { companyId: string; paymentId: string }) {
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
        setError(err instanceof Error ? err.message : "Không thể huỷ thanh toán.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        disabled={pending}
        onClick={() => {
          // Void payment là hành động rủi ro cao — bắt buộc nhập lý do trước
          // khi gọi action (rỗng/huỷ hộp thoại thì không làm gì).
          const reason = window.prompt("Lý do huỷ thanh toán?");
          if (!reason) return;
          run(() => voidPaymentAction(companyId, paymentId, reason));
        }}
        className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        Huỷ thanh toán
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
