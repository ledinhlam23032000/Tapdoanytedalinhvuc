"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startWorkItemAction, completeWorkItemAction, cancelWorkItemAction } from "@/lib/actions/work-actions";
import { WORK_STATUS_LABEL, WORK_PRIORITY_LABEL, formatDueDate } from "../work-labels";

type WorkRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  assigneeUserId: string | null;
  createdByUserId: string;
  assigneeName: string | null;
  projectName: string | null;
  organizationUnitName: string | null;
};

export function WorkTable({
  companyId,
  currentUserId,
  canManage,
  items,
}: {
  companyId: string;
  currentUserId: string;
  canManage: boolean;
  items: WorkRow[];
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function run(id: string, action: () => Promise<unknown>) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể cập nhật công việc.");
      } finally {
        setPendingId(null);
      }
    });
  }

  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
        Chưa có công việc nào.
      </p>
    );
  }

  return (
    <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
      {error ? <p className="px-4 py-2 text-sm text-red-600">{error}</p> : null}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500">
            <th className="px-4 py-2 font-medium">Việc</th>
            <th className="px-4 py-2 font-medium">Người phụ trách</th>
            <th className="px-4 py-2 font-medium">Trạng thái</th>
            <th className="px-4 py-2 font-medium">Ưu tiên</th>
            <th className="px-4 py-2 font-medium">Hạn</th>
            <th className="px-4 py-2 font-medium">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isPending = pendingId === item.id;
            // Khớp đúng canActOnWorkItem() ở work-service.ts: work.manage
            // HOẶC chính người được giao HOẶC chính người tạo.
            const mayAct =
              canManage || item.assigneeUserId === currentUserId || item.createdByUserId === currentUserId;
            return (
              <tr key={item.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-2">
                  <div className="text-zinc-900">{item.title}</div>
                  <div className="text-xs text-zinc-500">
                    {[item.projectName, item.organizationUnitName].filter(Boolean).join(" · ")}
                  </div>
                </td>
                <td className="px-4 py-2 text-zinc-700">{item.assigneeName ?? "—"}</td>
                <td className="px-4 py-2 text-zinc-700">{WORK_STATUS_LABEL[item.status] ?? item.status}</td>
                <td className="px-4 py-2 text-zinc-700">{WORK_PRIORITY_LABEL[item.priority] ?? item.priority}</td>
                <td className="px-4 py-2 text-zinc-700">{formatDueDate(item.dueAt) ?? "—"}</td>
                <td className="px-4 py-2">
                  {mayAct ? (
                    <div className="flex gap-2">
                      {item.status === "TODO" ? (
                        <button
                          disabled={isPending}
                          onClick={() => run(item.id, () => startWorkItemAction(companyId, item.id))}
                          className="text-sm text-zinc-900 hover:underline disabled:opacity-60"
                        >
                          Bắt đầu
                        </button>
                      ) : null}
                      {item.status === "TODO" || item.status === "IN_PROGRESS" ? (
                        <button
                          disabled={isPending}
                          onClick={() => run(item.id, () => completeWorkItemAction(companyId, item.id))}
                          className="text-sm text-emerald-700 hover:underline disabled:opacity-60"
                        >
                          Hoàn thành
                        </button>
                      ) : null}
                      {item.status === "TODO" || item.status === "IN_PROGRESS" ? (
                        <button
                          disabled={isPending}
                          onClick={() => run(item.id, () => cancelWorkItemAction(companyId, item.id))}
                          className="text-sm text-red-600 hover:underline disabled:opacity-60"
                        >
                          Huỷ
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
