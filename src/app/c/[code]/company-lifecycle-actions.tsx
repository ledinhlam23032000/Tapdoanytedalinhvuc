"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  suspendCompanyAction,
  resumeCompanyAction,
  archiveCompanyAction,
} from "@/lib/actions/company-actions";

export function CompanyLifecycleActions({
  companyId,
  status,
}: {
  companyId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function run(action: () => Promise<void>, confirmMessage: string) {
    if (!window.confirm(confirmMessage)) return;
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Thao tác thất bại.");
      }
    });
  }

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-medium text-zinc-700">Quản trị công ty</h2>
      <div className="flex flex-wrap gap-2">
        {status === "ACTIVE" ? (
          <button
            disabled={pending}
            onClick={() =>
              run(
                () => suspendCompanyAction(companyId),
                "Tạm dừng công ty? Nhân viên sẽ không thể thực hiện nghiệp vụ mới. Dữ liệu vẫn được giữ.",
              )
            }
            className="rounded-md border border-amber-300 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-60"
          >
            Tạm dừng công ty
          </button>
        ) : null}
        {status === "SUSPENDED" ? (
          <button
            disabled={pending}
            onClick={() => run(() => resumeCompanyAction(companyId), "Tiếp tục hoạt động công ty này?")}
            className="rounded-md border border-emerald-300 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
          >
            Tiếp tục hoạt động
          </button>
        ) : null}
        {status !== "ARCHIVED" ? (
          <button
            disabled={pending}
            onClick={() =>
              run(
                () => archiveCompanyAction(companyId),
                "Lưu trữ công ty? Công ty sẽ được đưa khỏi danh sách hoạt động. Dữ liệu và lịch sử vẫn được giữ.",
              )
            }
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
          >
            Lưu trữ công ty
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
