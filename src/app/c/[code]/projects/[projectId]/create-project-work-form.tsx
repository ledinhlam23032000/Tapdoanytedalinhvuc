"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWorkItemAction } from "@/lib/actions/work-actions";

export function CreateProjectWorkForm({
  companyId,
  projectId,
  currentUserId,
  canAssign,
  projectMembers,
}: {
  companyId: string;
  projectId: string;
  currentUserId: string;
  canAssign: boolean;
  projectMembers: { id: string; displayName: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const dueAtRaw = String(formData.get("dueAt") ?? "");
        const assigneeUserId = canAssign ? String(formData.get("assigneeUserId") ?? "") : currentUserId;
        setError(null);
        const form = e.currentTarget;
        startTransition(async () => {
          try {
            await createWorkItemAction({
              companyId,
              projectId,
              title: String(formData.get("title") ?? ""),
              priority: (formData.get("priority") as "LOW" | "NORMAL" | "HIGH" | "URGENT") ?? "NORMAL",
              dueAt: dueAtRaw ? new Date(dueAtRaw) : undefined,
              assigneeUserId: assigneeUserId || undefined,
            });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tạo công việc dự án.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Việc mới trong dự án</label>
        <input name="title" required maxLength={200} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Ưu tiên</label>
        <select name="priority" defaultValue="NORMAL" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
          <option value="LOW">Thấp</option>
          <option value="NORMAL">Bình thường</option>
          <option value="HIGH">Cao</option>
          <option value="URGENT">Khẩn cấp</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Hạn</label>
        <input name="dueAt" type="date" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      {canAssign ? (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Giao cho</label>
          <select name="assigneeUserId" defaultValue="" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
            <option value="">Chưa giao</option>
            {projectMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        Thêm việc
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
