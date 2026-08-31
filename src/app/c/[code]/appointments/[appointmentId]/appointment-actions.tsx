"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  completeAppointmentAction,
  markNoShowAction,
  cancelAppointmentAction,
} from "@/lib/actions/appointment-actions";
import { APPOINTMENT_STATUS_LABEL } from "../../work-labels";

export function AppointmentActions({
  companyId,
  appointmentId,
  status,
}: {
  companyId: string;
  appointmentId: string;
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
        setError(err instanceof Error ? err.message : "Không thể cập nhật lịch hẹn.");
      }
    });
  }

  const canAct = status === "SCHEDULED" || status === "CONFIRMED";

  if (!canAct) {
    return (
      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
        {APPOINTMENT_STATUS_LABEL[status] ?? status}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          disabled={pending}
          onClick={() => run(() => completeAppointmentAction(companyId, appointmentId))}
          className="text-sm text-emerald-700 hover:underline disabled:opacity-60"
        >
          Hoàn thành
        </button>
        <button
          disabled={pending}
          onClick={() => run(() => markNoShowAction(companyId, appointmentId))}
          className="text-sm text-zinc-900 hover:underline disabled:opacity-60"
        >
          Không đến
        </button>
        <button
          disabled={pending}
          onClick={() => {
            if (window.confirm("Huỷ lịch hẹn này?")) {
              run(() => cancelAppointmentAction(companyId, appointmentId));
            }
          }}
          className="text-sm text-red-600 hover:underline disabled:opacity-60"
        >
          Huỷ
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
