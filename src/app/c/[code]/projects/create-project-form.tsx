"use client";

import { useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { createProjectAction } from "@/lib/actions/project-actions";

export function CreateProjectForm({ companyId }: { companyId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const routeParams = useParams<{ code: string }>();

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          try {
            const project = await createProjectAction({
              companyId,
              code: String(formData.get("code") ?? ""),
              name: String(formData.get("name") ?? ""),
              description: String(formData.get("description") ?? "") || undefined,
            });
            router.push(`/c/${routeParams.code}/projects/${project.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tạo dự án.");
          }
        });
      }}
    >
      <h3 className="text-sm font-semibold text-zinc-900">Tạo dự án mới</h3>
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Mã dự án</label>
          <input
            name="code"
            required
            maxLength={40}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Ví dụ: DA-2026-01"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Tên dự án</label>
          <input name="name" required maxLength={160} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Mô tả (tuỳ chọn)</label>
        <textarea name="description" rows={2} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Tạo dự án
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
