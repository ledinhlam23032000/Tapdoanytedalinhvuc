"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMedicalCaseAction } from "@/lib/actions/healthcare-actions";
import { MEDICAL_CASE_TYPE_LABEL } from "../work-labels";

type CustomerOption = { id: string; name: string };

const CASE_TYPE_OPTIONS = Object.entries(MEDICAL_CASE_TYPE_LABEL) as [string, string][];

export function CreateMedicalCaseForm({
  companyId,
  customers,
}: {
  companyId: string;
  customers: CustomerOption[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (customers.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-500">
        Chưa có khách hàng nào — hãy tạo khách hàng trước khi mở hồ sơ ca.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; // BAT BUOC capture TRUOC async closure
        const formData = new FormData(form);
        const customerId = String(formData.get("customerId") ?? "");
        const caseType = String(formData.get("caseType") ?? "");
        const chiefComplaint = String(formData.get("chiefComplaint") ?? "").trim();
        setError(null);
        startTransition(async () => {
          try {
            await createMedicalCaseAction({
              companyId,
              customerId,
              caseType: caseType
                ? (caseType as "CONSULTATION" | "TREATMENT" | "AESTHETIC_PROCEDURE" | "FOLLOW_UP" | "OTHER")
                : undefined,
              chiefComplaint: chiefComplaint || undefined,
            });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể mở hồ sơ ca.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Khách hàng</label>
        <select
          name="customerId"
          required
          defaultValue=""
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="" disabled>
            — Chọn khách hàng —
          </option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Loại ca</label>
        <select
          name="caseType"
          defaultValue="CONSULTATION"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          {CASE_TYPE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Lý do khám (tuỳ chọn)</label>
        <textarea name="chiefComplaint" rows={2} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Mở hồ sơ
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
