"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCompanyMemberRoleAction, removeCompanyMemberAction } from "@/lib/actions/company-actions";
import type { CompanyRolePreset } from "@/generated/prisma";

const ROLE_LABEL: Record<CompanyRolePreset, string> = {
  OWNER: "Chủ sở hữu",
  COMPANY_ADMIN: "Quản trị viên",
  MANAGER: "Quản lý",
  MEMBER: "Thành viên",
  VIEWER: "Chỉ xem",
};

const ROLE_OPTIONS: CompanyRolePreset[] = ["OWNER", "COMPANY_ADMIN", "MANAGER", "MEMBER", "VIEWER"];

type Member = {
  membershipId: string;
  userId: string;
  displayName: string;
  email: string;
  rolePreset: CompanyRolePreset;
};

export function MembersTable({
  companyId,
  currentUserId,
  canManage,
  actorIsOwner,
  members,
}: {
  companyId: string;
  currentUserId: string;
  canManage: boolean;
  actorIsOwner: boolean;
  members: Member[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function changeRole(membershipId: string, rolePreset: CompanyRolePreset) {
    setError(null);
    startTransition(async () => {
      try {
        await updateCompanyMemberRoleAction({ companyId, membershipId, rolePreset });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể đổi vai trò.");
      }
    });
  }

  function remove(membershipId: string) {
    if (!window.confirm("Xoá thành viên này khỏi công ty?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await removeCompanyMemberAction(companyId, membershipId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể xoá thành viên.");
      }
    });
  }

  return (
    <section className="rounded-md border border-zinc-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500">
            <th className="px-4 py-2 font-medium">Tên</th>
            <th className="px-4 py-2 font-medium">Vai trò</th>
            {canManage ? <th className="px-4 py-2 font-medium">Thao tác</th> : null}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const isSelf = m.userId === currentUserId;
            const canEditThisRow = canManage && !isSelf && (m.rolePreset !== "OWNER" || actorIsOwner);
            return (
              <tr key={m.membershipId} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-2">
                  <div className="text-zinc-900">{m.displayName}</div>
                  <div className="text-xs text-zinc-500">{m.email}</div>
                </td>
                <td className="px-4 py-2">
                  {canEditThisRow ? (
                    <select
                      defaultValue={m.rolePreset}
                      disabled={pending}
                      onChange={(e) => changeRole(m.membershipId, e.target.value as CompanyRolePreset)}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    >
                      {ROLE_OPTIONS.filter((r) => r !== "OWNER" || actorIsOwner).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-zinc-700">{ROLE_LABEL[m.rolePreset]}</span>
                  )}
                </td>
                {canManage ? (
                  <td className="px-4 py-2">
                    {!isSelf ? (
                      <button
                        disabled={pending}
                        onClick={() => remove(m.membershipId)}
                        className="text-sm text-red-600 hover:underline disabled:opacity-60"
                      >
                        Xoá
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-400">Bạn</span>
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      {error ? <p className="px-4 py-2 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
