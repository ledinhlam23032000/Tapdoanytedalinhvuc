"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmSaleAction, cancelSaleAction } from "@/lib/actions/sales-actions";

export function SaleActions({
  companyId,
  saleId,
  status,
  canCancel,
}: {
  companyId: string;
  saleId: string;
  status: string;
  canCancel: boolean;
}) {
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
        setError(err instanceof Error ? err.message : "Không thể cập nhật giao dịch.");
      }
    });
  }

  if (status === "CANCELLED") {
    return null;
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {status === "DRAFT" ? (
          <button
            disabled={pending}
            onClick={() => {
              // mục CXIX: xác nhận giao dịch là bước vòng đời quan trọng — hỏi
              // lại trước khi thực hiện.
              if (window.confirm("Xác nhận giao dịch này? Sau khi xác nhận sẽ không sửa được các dòng hàng.")) {
                run(() => confirmSaleAction(companyId, saleId));
              }
            }}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Xác nhận
          </button>
        ) : null}
        {canCancel && (status === "DRAFT" || status === "CONFIRMED") ? (
          <button
            disabled={pending}
            onClick={() => {
              if (window.confirm("Huỷ giao dịch này? Hành động này không thể hoàn tác.")) {
                run(() => cancelSaleAction(companyId, saleId));
              }
            }}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            Huỷ
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
