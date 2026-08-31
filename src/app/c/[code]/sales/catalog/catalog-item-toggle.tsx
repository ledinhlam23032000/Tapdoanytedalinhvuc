"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCatalogItemAction } from "@/lib/actions/sales-actions";

export function CatalogItemToggle({
  companyId,
  catalogItemId,
  active,
}: {
  companyId: string;
  catalogItemId: string;
  active: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    setError(null);
    startTransition(async () => {
      try {
        await updateCatalogItemAction({ companyId, catalogItemId, active: !active });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể cập nhật trạng thái.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        disabled={pending}
        onClick={toggle}
        className={
          active
            ? "text-sm text-red-600 hover:underline disabled:opacity-60"
            : "text-sm text-emerald-700 hover:underline disabled:opacity-60"
        }
      >
        {active ? "Ngừng bán" : "Bán lại"}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
