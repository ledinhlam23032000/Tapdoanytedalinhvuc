"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWorkItemAction } from "@/lib/actions/work-actions";

type Option = { id: string; name: string };

export function CreateWorkForm({
  companyId,
  currentUserId,
  canAssign,
  assignableUsers,
  organizationUnits,
  projects,
}: {
  companyId: string;
  currentUserId: string;
  canAssign: boolean;
  assignableUsers: { id: string; displayName: string }[];
  organizationUnits: Option[];
  projects: Option[];
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
        const dueAtRaw = String(formData.get("dueAt") ?? "");
        // Không có quyền work.assign → tự nhận việc cho chính mình (domain
        // service cho phép tự-gán không cần work.assign, xem work-service.ts).
        const assigneeUserId = canAssign ? String(formData.get("assigneeUserId") ?? "") : currentUserId;
        const organizationUnitId = String(formData.get("organizationUnitId") ?? "");
        const projectId = String(formData.get("projectId") ?? "");
        setError(null);
        const form = e.currentTarget;
        startTransition(async () => {
          try {
            await createWorkItemAction({
              companyId,
              title: String(formData.get("title") ?? ""),
              description: String(formData.get("description") ?? "") || undefined,
              priority: formData.get("priority") as "LOW" | "NORMAL" | "HIGH" | "URGENT",
              dueAt: dueAtRaw ? new Date(dueAtRaw) : undefined,
              assigneeUserId: assigneeUserId || undefined,
              organizationUnitId: organizationUnitId || undefined,
              projectId: projectId || undefined,
            });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tạo công việc.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Tên công việc</label>
        <input
          name="title"
          required
          maxLength={200}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          placeholder="Ví dụ: Gọi lại khách hàng A"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Mô tả (tuỳ chọn)</label>
        <textarea name="description" rows={2} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Mức ưu tiên</label>
          <select name="priority" defaultValue="NORMAL" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
            <option value="LOW">Thấp</option>
            <option value="NORMAL">Bình thường</option>
            <option value="HIGH">Cao</option>
            <option value="URGENT">Khẩn cấp</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Hạn hoàn thành</label>
          <input name="dueAt" type="date" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </div>
        {canAssign ? (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Giao cho</label>
            <select name="assigneeUserId" defaultValue="" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
              <option value="">Chưa giao (tự nhận sau)</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="self-end pb-2 text-xs text-zinc-500">Việc này sẽ tự động giao cho bạn.</p>
        )}
        {organizationUnits.length > 0 ? (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Đơn vị (tuỳ chọn)</label>
            <select name="organizationUnitId" defaultValue="" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
              <option value="">—</option>
              {organizationUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {projects.length > 0 ? (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Dự án (tuỳ chọn)</label>
            <select name="projectId" defaultValue="" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
              <option value="">—</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Tạo công việc
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
