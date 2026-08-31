"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { convertLeadAction } from "@/lib/actions/lead-actions";

export function ConvertLeadButton({
  companyId,
  leadId,
  code,
}: {
  companyId: string;
  leadId: string;
  code: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await convertLeadAction(companyId, leadId);
        router.push(`/c/${code}/customers/${result.customer.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể chuyển đổi Lead.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        disabled={pending}
        onClick={run}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        Chuyển đổi thành khách hàng
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
