"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeProjectAction, archiveProjectAction } from "@/lib/actions/project-actions";

export function ProjectLifecycleActions({
  companyId,
  projectId,
  status,
  canArchive,
}: {
  companyId: string;
  projectId: string;
  status: string;
  canArchive: boolean;
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
        setError(err instanceof Error ? err.message : "Không thể cập nhật dự án.");
      }
    });
  }

  const canComplete = status !== "COMPLETED" && status !== "CANCELLED" && status !== "ARCHIVED";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {canComplete ? (
          <button
            disabled={pending}
            onClick={() => run(() => completeProjectAction(companyId, projectId))}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Hoàn thành dự án
          </button>
        ) : null}
        {canArchive && status !== "ARCHIVED" ? (
          <button
            disabled={pending}
            onClick={() => {
              if (window.confirm("Lưu trữ dự án này? Dự án sẽ chuyển sang trạng thái lưu trữ.")) {
                run(() => archiveProjectAction(companyId, projectId));
              }
            }}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
          >
            Lưu trữ
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
