"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeMedicalCaseAction, reopenMedicalCaseAction } from "@/lib/actions/healthcare-actions";

/** Đóng/mở lại hồ sơ — chỉ hiện với `healthcare.case.close` (page.tsx cha đã gate). */
export function CaseLifecycleActions({
  companyId,
  medicalCaseId,
  status,
}: {
  companyId: string;
  medicalCaseId: string;
  status: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClose(outcome: "CLOSED" | "CANCELLED") {
    const reason = window.prompt(outcome === "CLOSED" ? "Lý do đóng hồ sơ:" : "Lý do huỷ hồ sơ:");
    if (!reason || !reason.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await closeMedicalCaseAction({ companyId, medicalCaseId, outcome, reason: reason.trim() });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể thực hiện thao tác.");
      }
    });
  }

  function handleReopen() {
    const reason = window.prompt("Lý do mở lại hồ sơ:");
    if (!reason || !reason.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await reopenMedicalCaseAction({ companyId, medicalCaseId, reason: reason.trim() });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể mở lại hồ sơ.");
      }
    });
  }

  if (status === "CLOSED") {
    return (
      <div className="flex items-center gap-2">
        <button
          disabled={pending}
          onClick={handleReopen}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
        >
          Mở lại hồ sơ
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }

  if (status === "CANCELLED") return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        disabled={pending}
        onClick={() => handleClose("CLOSED")}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        Đóng hồ sơ
      </button>
      <button
        disabled={pending}
        onClick={() => handleClose("CANCELLED")}
        className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        Huỷ hồ sơ
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
