"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  calculatePayrollRunAction,
  approvePayrollRunAction,
  requestPayrollFinalizeAction,
  firstApprovePayrollFinalizeAction,
  secondApprovePayrollFinalizeAction,
  rejectPayrollFinalizeAction,
  finalizePayrollRunAction,
  voidPayrollRunAction,
  adjustPayrollItemAction,
} from "@/lib/actions/payroll-actions";

type ApprovalInfo = {
  id: string;
  status: "PENDING" | "PENDING_SECOND" | "APPROVED";
  firstApprovedByDisplayName: string | null;
} | null;

/** Toàn bộ hành động vòng đời PayrollRun (DRAFT -> CALCULATED -> APPROVED ->
 * FINALIZED/VOIDED), gồm cả 2 bước duyệt (ApprovalRequest PAYROLL_FINALIZE).
 * Chỉ render khi actor có "payroll.manage" (page.tsx đã gate). Trạng thái
 * FINALIZED không có hành động nào — page.tsx tự hiển thị dòng "Đã chốt sổ
 * lúc ..." và không render component này. */
export function PayrollRunActions({
  companyId,
  payrollRunId,
  status,
  approvalRequest,
}: {
  companyId: string;
  payrollRunId: string;
  status: string;
  approvalRequest: ApprovalInfo;
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
        setError(err instanceof Error ? err.message : "Không thể thực hiện thao tác.");
      }
    });
  }

  function handleVoid() {
    if (!window.confirm("Huỷ kỳ lương này? Hành động này không thể hoàn tác.")) return;
    const reason = window.prompt("Lý do huỷ kỳ lương:");
    if (!reason || !reason.trim()) return;
    run(() => voidPayrollRunAction(companyId, payrollRunId, reason.trim()));
  }

  function handleReject(approvalRequestId: string) {
    if (window.confirm("Từ chối yêu cầu chốt sổ này?")) {
      run(() => rejectPayrollFinalizeAction(companyId, approvalRequestId));
    }
  }

  if (status === "FINALIZED" || status === "VOIDED") return null;

  const showRequestFinalizeForm = status === "APPROVED" && !approvalRequest;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {status === "DRAFT" ? (
          <button
            disabled={pending}
            onClick={() => run(() => calculatePayrollRunAction(companyId, payrollRunId))}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            Tính lương
          </button>
        ) : null}

        {status === "CALCULATED" ? (
          <button
            disabled={pending}
            onClick={() => run(() => approvePayrollRunAction(companyId, payrollRunId))}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Duyệt kiểm tra
          </button>
        ) : null}

        {status === "APPROVED" && approvalRequest?.status === "PENDING" ? (
          <>
            <button
              disabled={pending}
              onClick={() => run(() => firstApprovePayrollFinalizeAction(companyId, approvalRequest.id))}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Duyệt lần 1
            </button>
            <button
              disabled={pending}
              onClick={() => handleReject(approvalRequest.id)}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              Từ chối
            </button>
          </>
        ) : null}

        {status === "APPROVED" && approvalRequest?.status === "PENDING_SECOND" ? (
          <>
            <button
              disabled={pending}
              onClick={() => run(() => secondApprovePayrollFinalizeAction(companyId, approvalRequest.id))}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Duyệt lần 2
            </button>
            <button
              disabled={pending}
              onClick={() => handleReject(approvalRequest.id)}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              Từ chối
            </button>
          </>
        ) : null}

        {status === "APPROVED" && approvalRequest?.status === "APPROVED" ? (
          <button
            disabled={pending}
            onClick={() => {
              if (
                window.confirm(
                  "Chốt sổ kỳ lương này? Sau khi chốt sẽ không thể sửa và sẽ tự động ghi chi phí trả lương.",
                )
              ) {
                run(() => finalizePayrollRunAction(companyId, payrollRunId, approvalRequest.id));
              }
            }}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            Chốt sổ
          </button>
        ) : null}

        <button
          disabled={pending}
          onClick={handleVoid}
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          Huỷ kỳ lương
        </button>
      </div>

      {showRequestFinalizeForm ? <RequestFinalizeForm companyId={companyId} payrollRunId={payrollRunId} /> : null}
      {status === "APPROVED" && approvalRequest?.status === "PENDING" ? (
        <p className="text-sm text-zinc-500">Đang chờ duyệt lần 1.</p>
      ) : null}
      {status === "APPROVED" && approvalRequest?.status === "PENDING_SECOND" ? (
        <p className="text-sm text-zinc-500">
          Đã duyệt lần 1 bởi {approvalRequest.firstApprovedByDisplayName ?? "—"} — cần một người KHÁC duyệt lần 2.
        </p>
      ) : null}
      {status === "APPROVED" && approvalRequest?.status === "APPROVED" ? (
        <p className="text-sm text-zinc-500">Đã duyệt đủ 2 người.</p>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function RequestFinalizeForm({ companyId, payrollRunId }: { companyId: string; payrollRunId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex w-full flex-col gap-2 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        const reason = String(formData.get("reason") ?? "").trim();
        setError(null);
        startTransition(async () => {
          try {
            await requestPayrollFinalizeAction(companyId, payrollRunId, reason);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể gửi yêu cầu chốt sổ.");
          }
        });
      }}
    >
      <label className="text-sm font-medium text-zinc-700">Lý do xin chốt sổ</label>
      <textarea name="reason" required rows={2} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Xin chốt sổ (yêu cầu duyệt 2 người)
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

/** Form nhỏ cạnh mỗi dòng PayrollItem — chỉ hiện khi PayrollRun còn ở DRAFT
 * hoặc CALCULATED (page.tsx tự gate điều kiện này trước khi render). */
export function AdjustPayrollItemForm({
  companyId,
  payrollItemId,
  currentBonusAmount,
  currentDeductionAmount,
}: {
  companyId: string;
  payrollItemId: string;
  currentBonusAmount: number;
  currentDeductionAmount: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        const reason = String(formData.get("reason") ?? "").trim();
        const bonusRaw = String(formData.get("bonusAmount") ?? "");
        const deductionRaw = String(formData.get("deductionAmount") ?? "");
        setError(null);
        startTransition(async () => {
          try {
            await adjustPayrollItemAction({
              companyId,
              payrollItemId,
              bonusAmount: bonusRaw === "" ? currentBonusAmount : Number(bonusRaw),
              deductionAmount: deductionRaw === "" ? currentDeductionAmount : Number(deductionRaw),
              reason,
            });
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể điều chỉnh dòng lương.");
          }
        });
      }}
    >
      <input
        name="bonusAmount"
        type="number"
        min={0}
        step={1}
        defaultValue={currentBonusAmount}
        placeholder="Thưởng"
        className="w-28 rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      <input
        name="deductionAmount"
        type="number"
        min={0}
        step={1}
        defaultValue={currentDeductionAmount}
        placeholder="Khấu trừ"
        className="w-28 rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      <input
        name="reason"
        required
        maxLength={2000}
        placeholder="Lý do điều chỉnh"
        className="w-40 rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        Lưu
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
