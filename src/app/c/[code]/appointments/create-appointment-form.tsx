"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAppointmentAction } from "@/lib/actions/appointment-actions";

type Option = { id: string; name: string };

export function CreateAppointmentForm({
  companyId,
  customers,
  organizationUnits,
  companyMembers,
  initialCustomerId,
}: {
  companyId: string;
  customers: Option[];
  organizationUnits: Option[];
  companyMembers: { id: string; displayName: string }[];
  initialCustomerId?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; // phải lấy trước closure async — truy cập e.currentTarget sau await sẽ lỗi
        const formData = new FormData(form);
        const customerId = String(formData.get("customerId") ?? "");
        const organizationUnitId = String(formData.get("organizationUnitId") ?? "");
        const assignedUserId = String(formData.get("assignedUserId") ?? "");
        const type = String(formData.get("type") ?? "").trim();
        const note = String(formData.get("note") ?? "").trim();
        const startAtRaw = String(formData.get("startAt") ?? "");
        setError(null);
        startTransition(async () => {
          try {
            await createAppointmentAction({
              companyId,
              title: String(formData.get("title") ?? ""),
              customerId: customerId || undefined,
              organizationUnitId: organizationUnitId || undefined,
              assignedUserId: assignedUserId || undefined,
              type: type || undefined,
              note: note || undefined,
              startAt: new Date(startAtRaw),
            });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tạo lịch hẹn.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Tiêu đề</label>
        <input
          name="title"
          required
          maxLength={200}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          placeholder="Ví dụ: Tư vấn khách hàng A"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Khách hàng (tuỳ chọn)</label>
          <select
            name="customerId"
            defaultValue={initialCustomerId ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Ngày giờ</label>
          <input
            name="startAt"
            type="datetime-local"
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Người phụ trách (tuỳ chọn)</label>
          <select
            name="assignedUserId"
            defaultValue=""
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {companyMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Loại cuộc hẹn (tuỳ chọn)</label>
          <input
            name="type"
            maxLength={100}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Ví dụ: Tư vấn, Tái khám"
          />
        </div>
        {organizationUnits.length > 0 ? (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Đơn vị (tuỳ chọn)</label>
            <select
              name="organizationUnitId"
              defaultValue=""
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {organizationUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Ghi chú (tuỳ chọn)</label>
        <textarea name="note" rows={2} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Tạo lịch hẹn
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
