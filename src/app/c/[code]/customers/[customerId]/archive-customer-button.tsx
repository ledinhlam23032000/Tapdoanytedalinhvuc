"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveCustomerAction, restoreCustomerAction } from "@/lib/actions/customer-actions";

export function ArchiveCustomerButton({
  companyId,
  customerId,
  status,
}: {
  companyId: string;
  customerId: string;
  status: string;
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
        setError(err instanceof Error ? err.message : "Không thể cập nhật trạng thái khách hàng.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {status === "ARCHIVED" ? (
        <button
          disabled={pending}
          onClick={() => run(() => restoreCustomerAction(companyId, customerId))}
          className="text-sm text-emerald-700 hover:underline disabled:opacity-60"
        >
          Khôi phục
        </button>
      ) : (
        <button
          disabled={pending}
          onClick={() => {
            if (window.confirm("Lưu trữ khách hàng này?")) {
              run(() => archiveCustomerAction(companyId, customerId));
            }
          }}
          className="text-sm text-red-600 hover:underline disabled:opacity-60"
        >
          Lưu trữ
        </button>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
