"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCompanyMemberAction } from "@/lib/actions/company-actions";
import type { CompanyRolePreset } from "@/generated/prisma";

const ROLE_OPTIONS: { value: CompanyRolePreset; label: string }[] = [
  { value: "COMPANY_ADMIN", label: "Quản trị viên" },
  { value: "MANAGER", label: "Quản lý" },
  { value: "MEMBER", label: "Thành viên" },
  { value: "VIEWER", label: "Chỉ xem" },
  { value: "OWNER", label: "Chủ sở hữu" },
];

export function AddMemberForm({ companyId, actorIsOwner }: { companyId: string; actorIsOwner: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const options = ROLE_OPTIONS.filter((r) => r.value !== "OWNER" || actorIsOwner);

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        setError(null);
        startTransition(async () => {
          try {
            await addCompanyMemberAction({
              companyId,
              email: String(formData.get("email") ?? ""),
              rolePreset: formData.get("rolePreset") as CompanyRolePreset,
            });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể thêm thành viên.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Email người dùng có sẵn</label>
        <input name="email" type="email" required className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Vai trò</label>
        <select name="rolePreset" defaultValue="MEMBER" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
          {options.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        Thêm thành viên
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
