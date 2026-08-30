"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startWorkItemAction, completeWorkItemAction } from "@/lib/actions/work-actions";
import { WORK_PRIORITY_LABEL, formatDueDate } from "../work-labels";

type TodayItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  projectName: string | null;
  organizationUnitName: string | null;
};

export function TodayWorkList({ companyId, items }: { companyId: string; items: TodayItem[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function start(id: string) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      try {
        await startWorkItemAction(companyId, id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể bắt đầu công việc.");
      } finally {
        setPendingId(null);
      }
    });
  }

  function complete(id: string) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      try {
        await completeWorkItemAction(companyId, id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể hoàn thành công việc.");
      } finally {
        setPendingId(null);
      }
    });
  }

  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
        Không có việc nào cho hôm nay.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const dueLabel = formatDueDate(item.dueAt);
          const isPending = pendingId === item.id;
          return (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-900">{item.title}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {WORK_PRIORITY_LABEL[item.priority] ?? item.priority}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-zinc-500">
                  {dueLabel ? <span>Hạn: {dueLabel}</span> : null}
                  {item.projectName ? <span>Dự án: {item.projectName}</span> : null}
                  {item.organizationUnitName ? <span>Đơn vị: {item.organizationUnitName}</span> : null}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {item.status === "TODO" ? (
                  <button
                    disabled={isPending}
                    onClick={() => start(item.id)}
                    className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                  >
                    Bắt đầu
                  </button>
                ) : null}
                {item.status === "IN_PROGRESS" ? (
                  <button
                    disabled={isPending}
                    onClick={() => complete(item.id)}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Hoàn thành
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
