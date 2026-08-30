"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addProjectMemberAction } from "@/lib/actions/project-actions";

export function AddProjectMemberForm({
  companyId,
  projectId,
  candidates,
}: {
  companyId: string;
  projectId: string;
  candidates: { id: string; displayName: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (candidates.length === 0) {
    return <p className="text-xs text-zinc-500">Không còn thành viên công ty nào để thêm vào dự án.</p>;
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setError(null);
        const form = e.currentTarget;
        startTransition(async () => {
          try {
            await addProjectMemberAction({
              companyId,
              projectId,
              userId: String(formData.get("userId") ?? ""),
              rolePreset: formData.get("rolePreset") as "OWNER" | "MEMBER" | "VIEWER",
            });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể thêm thành viên dự án.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Thành viên</label>
        <select name="userId" required defaultValue="" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
          <option value="" disabled>
            Chọn người
          </option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Vai trò</label>
        <select name="rolePreset" defaultValue="MEMBER" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
          <option value="MEMBER">Thành viên</option>
          <option value="VIEWER">Chỉ xem</option>
          <option value="OWNER">Chủ dự án</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        Thêm vào dự án
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
