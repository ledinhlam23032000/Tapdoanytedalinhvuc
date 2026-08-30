"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { endAssignmentAction } from "@/lib/actions/organization-actions";

type PersonRow = {
  assignmentId: string;
  userDisplayName: string;
  positionName: string;
  organizationUnitName: string | null;
};

export function PeopleTable({
  companyId,
  canAssign,
  people,
}: {
  companyId: string;
  canAssign: boolean;
  people: PersonRow[];
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function endAssignment(assignmentId: string) {
    if (!window.confirm("Kết thúc phân công này?")) return;
    setError(null);
    setPendingId(assignmentId);
    startTransition(async () => {
      try {
        await endAssignmentAction(companyId, assignmentId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể kết thúc phân công.");
      } finally {
        setPendingId(null);
      }
    });
  }

  if (people.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
        Chưa có ai được gán vị trí.
      </p>
    );
  }

  return (
    <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
      {error ? <p className="px-4 py-2 text-sm text-red-600">{error}</p> : null}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500">
            <th className="px-4 py-2 font-medium">Người</th>
            <th className="px-4 py-2 font-medium">Vị trí</th>
            <th className="px-4 py-2 font-medium">Đơn vị</th>
            {canAssign ? <th className="px-4 py-2 font-medium">Thao tác</th> : null}
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.assignmentId} className="border-b border-zinc-100 last:border-0">
              <td className="px-4 py-2 text-zinc-900">{p.userDisplayName}</td>
              <td className="px-4 py-2 text-zinc-700">{p.positionName}</td>
              <td className="px-4 py-2 text-zinc-700">{p.organizationUnitName ?? "—"}</td>
              {canAssign ? (
                <td className="px-4 py-2">
                  <button
                    disabled={pendingId === p.assignmentId}
                    onClick={() => endAssignment(p.assignmentId)}
                    className="text-sm text-red-600 hover:underline disabled:opacity-60"
                  >
                    Kết thúc
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
