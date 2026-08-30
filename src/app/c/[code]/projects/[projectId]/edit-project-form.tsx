"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProjectAction } from "@/lib/actions/project-actions";

type Initial = {
  name: string;
  description: string;
  owningUnitId: string;
  startAt: string;
  dueAt: string;
  budgetAmount: string;
};

export function EditProjectForm({
  companyId,
  projectId,
  initial,
  organizationUnits,
}: {
  companyId: string;
  projectId: string;
  initial: Initial;
  organizationUnits: { id: string; name: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const owningUnitId = String(formData.get("owningUnitId") ?? "");
        const startAt = String(formData.get("startAt") ?? "");
        const dueAt = String(formData.get("dueAt") ?? "");
        const budgetAmount = String(formData.get("budgetAmount") ?? "");
        setError(null);
        startTransition(async () => {
          try {
            await updateProjectAction({
              companyId,
              projectId,
              name: String(formData.get("name") ?? ""),
              description: String(formData.get("description") ?? "") || undefined,
              owningUnitId: owningUnitId || undefined,
              startAt: startAt ? new Date(startAt) : undefined,
              dueAt: dueAt ? new Date(dueAt) : undefined,
              budgetAmount: budgetAmount ? Number(budgetAmount) : undefined,
            });
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể cập nhật dự án.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Tên dự án</label>
        <input
          name="name"
          required
          maxLength={160}
          defaultValue={initial.name}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Mô tả</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={initial.description}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        {organizationUnits.length > 0 ? (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Đơn vị chủ quản</label>
            <select
              name="owningUnitId"
              defaultValue={initial.owningUnitId}
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
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Bắt đầu</label>
          <input
            name="startAt"
            type="date"
            defaultValue={initial.startAt}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Hạn</label>
          <input
            name="dueAt"
            type="date"
            defaultValue={initial.dueAt}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Ngân sách (VNĐ)</label>
          <input
            name="budgetAmount"
            type="number"
            min="0"
            step="1000"
            defaultValue={initial.budgetAmount}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Lưu thay đổi
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
