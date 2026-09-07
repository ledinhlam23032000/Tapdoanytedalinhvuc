"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enableHealthcareModuleAction, disableHealthcareModuleAction } from "@/lib/actions/healthcare-actions";

/** Bật/tắt phân hệ Y tế cho công ty (ADR-047). Chỉ render khi actor có
 * "healthcare.module.manage" (page.tsx đã gate qua requireCompanyPageByCode).
 * Tắt module là hành động nguy hiểm (chặn truy cập nghiệp vụ mới) nên PHẢI
 * window.confirm — cùng pattern với company-lifecycle-actions.tsx. */
export function HealthcareModuleToggle({ companyId, enabled }: { companyId: string; enabled: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleEnable() {
    setError(null);
    startTransition(async () => {
      try {
        await enableHealthcareModuleAction({ companyId, module: "HEALTHCARE" });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể bật phân hệ Y tế.");
      }
    });
  }

  function handleDisable() {
    if (
      !window.confirm(
        "Tắt phân hệ Y tế? Nhân viên sẽ không thể truy cập nghiệp vụ Y tế mới. Dữ liệu lâm sàng đã có sẽ KHÔNG bị xoá.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await disableHealthcareModuleAction({ companyId, module: "HEALTHCARE" });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể tắt phân hệ Y tế.");
      }
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Trạng thái phân hệ Y tế</h3>
          <p className="mt-1 text-sm">
            {enabled ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                Đã bật
              </span>
            ) : (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                Chưa bật
              </span>
            )}
          </p>
        </div>
        {enabled ? (
          <button
            type="button"
            disabled={pending}
            onClick={handleDisable}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            Tắt phân hệ
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={handleEnable}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            Bật phân hệ
          </button>
        )}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
