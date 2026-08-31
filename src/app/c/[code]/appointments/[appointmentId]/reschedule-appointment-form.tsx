"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rescheduleAppointmentAction } from "@/lib/actions/appointment-actions";

export function RescheduleAppointmentForm({
  companyId,
  appointmentId,
}: {
  companyId: string;
  appointmentId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; // phải lấy trước closure async — truy cập e.currentTarget sau await sẽ lỗi
        const formData = new FormData(form);
        const startAtRaw = String(formData.get("startAt") ?? "");
        setError(null);
        startTransition(async () => {
          try {
            await rescheduleAppointmentAction({
              companyId,
              appointmentId,
              startAt: new Date(startAtRaw),
            });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể đổi giờ lịch hẹn.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Đổi giờ</label>
        <input
          name="startAt"
          type="datetime-local"
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        Lưu
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
