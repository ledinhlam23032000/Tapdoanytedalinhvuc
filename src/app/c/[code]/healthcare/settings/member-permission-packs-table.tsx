"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { grantPermissionPackAction, revokePermissionPackAction } from "@/lib/actions/healthcare-actions";
import type { PermissionPack } from "@/generated/prisma";

const PACK_OPTIONS: PermissionPack[] = [
  "HEALTHCARE_RECEPTION",
  "HEALTHCARE_NURSE",
  "HEALTHCARE_DOCTOR",
  "HEALTHCARE_CARE",
];

const PACK_LABEL: Record<PermissionPack, string> = {
  HEALTHCARE_RECEPTION: "Lễ tân y tế",
  HEALTHCARE_NURSE: "Điều dưỡng",
  HEALTHCARE_DOCTOR: "Bác sĩ",
  HEALTHCARE_CARE: "Chăm sóc / Theo dõi",
};

type Member = {
  userId: string;
  displayName: string;
  email: string;
  packs: PermissionPack[];
};

/** Gán/thu hồi gói quyền chuyên môn Y tế cho từng thành viên (ADR-051). Chỉ
 * render khi actor có "company.members.manage" (page.tsx đã gate). Thu hồi
 * là hành động nguy hiểm (giảm quyền truy cập ngay) nên PHẢI window.confirm;
 * gán thêm gói là hành động thường nên không cần. */
export function MemberPermissionPacksTable({ companyId, members }: { companyId: string; members: Member[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedPack, setSelectedPack] = useState<Record<string, PermissionPack>>({});
  const router = useRouter();

  function grant(userId: string) {
    const pack = selectedPack[userId] ?? PACK_OPTIONS[0];
    setError(null);
    startTransition(async () => {
      try {
        await grantPermissionPackAction({ companyId, userId, pack });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể gán gói quyền.");
      }
    });
  }

  function revoke(userId: string, pack: PermissionPack) {
    if (!window.confirm(`Thu hồi gói quyền "${PACK_LABEL[pack]}" của thành viên này?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await revokePermissionPackAction({ companyId, userId, pack });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể thu hồi gói quyền.");
      }
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-zinc-900">Gói quyền chuyên môn Y tế theo thành viên</h3>
      {members.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
          Chưa có thành viên nào trong công ty.
        </p>
      ) : (
        <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="px-4 py-2 font-medium">Thành viên</th>
                <th className="px-4 py-2 font-medium">Gói quyền hiện có</th>
                <th className="px-4 py-2 font-medium">Gán thêm</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const nextDefault = PACK_OPTIONS.find((p) => !m.packs.includes(p)) ?? PACK_OPTIONS[0];
                return (
                  <tr key={m.userId} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2 align-top">
                      <div className="text-zinc-900">{m.displayName}</div>
                      <div className="text-xs text-zinc-500">{m.email}</div>
                    </td>
                    <td className="px-4 py-2 align-top">
                      {m.packs.length === 0 ? (
                        <span className="text-xs text-zinc-400">Chưa có gói nào</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {m.packs.map((p) => (
                            <span
                              key={p}
                              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                            >
                              {PACK_LABEL[p]}
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => revoke(m.userId, p)}
                                className="text-red-600 hover:underline disabled:opacity-60"
                              >
                                Thu hồi
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top">
                      <div className="flex items-center gap-2">
                        <select
                          defaultValue={nextDefault}
                          disabled={pending}
                          onChange={(e) =>
                            setSelectedPack((s) => ({ ...s, [m.userId]: e.target.value as PermissionPack }))
                          }
                          className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                        >
                          {PACK_OPTIONS.map((p) => (
                            <option key={p} value={p}>
                              {PACK_LABEL[p]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => grant(m.userId)}
                          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                        >
                          Gán
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
