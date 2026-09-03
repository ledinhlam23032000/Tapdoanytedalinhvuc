"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  firstApproveStockAdjustmentAction,
  secondApproveStockAdjustmentAction,
  rejectStockAdjustmentAction,
  executeApprovedStockAdjustmentAction,
} from "@/lib/actions/inventory-actions";
import type { ApprovalRequestStatus } from "@/generated/prisma";

// Quy uoc Phan 6: Tu choi + Thuc thi dieu chinh la hanh dong RUI RO CAO ->
// PHAI window.confirm. Duyet lan 1/lan 2 la hanh dong THUONG -> khong can.

export function AdjustmentRequestActions({
  companyId,
  approvalRequestId,
  status,
  firstApprovedByName,
}: {
  companyId: string;
  approvalRequestId: string;
  status: ApprovalRequestStatus;
  firstApprovedByName: string | null;
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
        setError(err instanceof Error ? err.message : "Không thể thực hiện thao tác này.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {status === "PENDING_SECOND" && firstApprovedByName ? (
        <p className="text-xs text-zinc-500">Đã duyệt lần 1 bởi {firstApprovedByName}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {status === "PENDING" ? (
          <button
            disabled={pending}
            onClick={() => run(() => firstApproveStockAdjustmentAction(companyId, approvalRequestId))}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Duyệt lần 1
          </button>
        ) : null}

        {status === "PENDING_SECOND" ? (
          <button
            disabled={pending}
            onClick={() => run(() => secondApproveStockAdjustmentAction(companyId, approvalRequestId))}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Duyệt lần 2
          </button>
        ) : null}

        {status === "PENDING" || status === "PENDING_SECOND" ? (
          <button
            disabled={pending}
            onClick={() => {
              if (window.confirm("Từ chối yêu cầu điều chỉnh tồn kho này?")) {
                run(() => rejectStockAdjustmentAction(companyId, approvalRequestId));
              }
            }}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            Từ chối
          </button>
        ) : null}

        {status === "APPROVED" ? (
          <button
            disabled={pending}
            onClick={() => {
              if (window.confirm("Thực thi điều chỉnh tồn kho này? Sẽ ghi nhận thay đổi số lượng thật.")) {
                run(() => executeApprovedStockAdjustmentAction({ companyId, approvalRequestId }));
              }
            }}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Thực thi điều chỉnh
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
