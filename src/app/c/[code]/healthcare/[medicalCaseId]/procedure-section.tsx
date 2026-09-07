"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  planProcedureAction,
  startProcedureAction,
  completeProcedureAction,
  cancelProcedureAction,
  reverseProcedureMaterialAction,
  getProcedureReadinessAction,
} from "@/lib/actions/healthcare-actions";
import { PROCEDURE_STATUS_LABEL, formatDateTime } from "../../work-labels";

// Procedure + ProcedureMaterialUsage UI (Phần 7). Cha (page.tsx tổng hợp,
// viết riêng) phải Number()-hoá mọi field Decimal (materialUsages[].quantity)
// trước khi truyền props xuống đây — component này KHÔNG bao giờ nhận thẳng
// object Prisma (bug thật đã trả giá ở Phần 5, xem inventory-item-actions.tsx
// và ghi chú đầu healthcare-actions.ts).

type ProcedureStatus = "PLANNED" | "READY" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type ProcedureMaterialUsageStatus = "RECORDED" | "REVERSED";

/** Khớp field trả về của getProcedureDetail() trong procedure-service.ts —
 *  chỉ khai báo phần UI thực sự dùng (structural typing: object thật có thể
 *  có thêm field khác, không sao). quantity là number vì cha đã Number()-hoá
 *  Decimal, khác với Procedure.quantity gốc trong Prisma schema. */
export type ProcedureMaterialUsageDetail = {
  id: string;
  inventoryItemId: string;
  inventoryLocationId: string;
  quantity: number;
  status: ProcedureMaterialUsageStatus;
  inventoryItem: { id: string; name: string; unit: string };
  inventoryLocation: { id: string; name: string };
};

export type ProcedureDetail = {
  id: string;
  procedureType: string | null;
  status: ProcedureStatus;
  primaryClinician: { id: string; displayName: string } | null;
  catalogItem: { id: string; name: string } | null;
  scheduledAt: string | Date | null;
  performedAt: string | Date | null;
  materialUsages: ProcedureMaterialUsageDetail[];
};

type ProcedureSectionProps = {
  companyId: string;
  medicalCaseId: string;
  procedures: ProcedureDetail[];
  canPlan: boolean;
  canPerform: boolean;
};

/** formatDateTime() nhận iso string; scheduledAt/performedAt có thể tới dưới
 *  dạng Date (RSC serialize Date nguyên trạng) hoặc string tuỳ cha — chuẩn hoá
 *  một chỗ để khỏi lặp lại ternary khắp nơi. */
function toIso(value: string | Date | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.toISOString();
}

export function ProcedureSection({ companyId, medicalCaseId, procedures, canPlan, canPerform }: ProcedureSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-zinc-900">Thủ thuật</h3>

      {canPlan ? <PlanProcedureForm companyId={companyId} medicalCaseId={medicalCaseId} /> : null}

      {procedures.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
          Chưa có thủ thuật nào.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {procedures.map((procedure) => (
            <ProcedureCard key={procedure.id} companyId={companyId} procedure={procedure} canPlan={canPlan} canPerform={canPerform} />
          ))}
        </div>
      )}
    </section>
  );
}

function PlanProcedureForm({ companyId, medicalCaseId }: { companyId: string; medicalCaseId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; // BAT BUOC capture TRUOC closure async
        const formData = new FormData(form);
        const procedureType = String(formData.get("procedureType") ?? "").trim();
        const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();
        const primaryClinicianUserId = String(formData.get("primaryClinicianUserId") ?? "").trim();
        setError(null);
        startTransition(async () => {
          try {
            await planProcedureAction({
              companyId,
              medicalCaseId,
              procedureType: procedureType || undefined,
              scheduledAt: scheduledAtRaw ? new Date(scheduledAtRaw) : undefined,
              primaryClinicianUserId: primaryClinicianUserId || undefined,
            });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể lập kế hoạch thủ thuật.");
          }
        });
      }}
    >
      <h4 className="text-sm font-semibold text-zinc-900">Lập kế hoạch thủ thuật mới</h4>
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Loại thủ thuật</label>
          <input name="procedureType" placeholder="Ví dụ: Tiêm filler, Nâng mũi" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Ngày giờ lên lịch</label>
          <input name="scheduledAt" type="datetime-local" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">ID bác sĩ phụ trách</label>
          <input name="primaryClinicianUserId" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Lập kế hoạch
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

function ProcedureCard({
  companyId,
  procedure,
  canPlan,
  canPerform,
}: {
  companyId: string;
  procedure: ProcedureDetail;
  canPlan: boolean;
  canPerform: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể thực hiện thao tác.");
      }
    });
  }

  function handleStart() {
    run(() => startProcedureAction({ companyId, procedureId: procedure.id }));
  }

  function handleCancel() {
    if (!window.confirm("Huỷ thủ thuật này? Hành động này không thể hoàn tác.")) return;
    const reason = window.prompt("Lý do huỷ thủ thuật:");
    if (!reason || !reason.trim()) return;
    run(() => cancelProcedureAction({ companyId, procedureId: procedure.id, reason: reason.trim() }));
  }

  const isPlannedOrReady = procedure.status === "PLANNED" || procedure.status === "READY";
  const canStart = canPerform && isPlannedOrReady;
  // Huỷ dùng quyền "healthcare.procedure.plan" ở domain (cancelProcedure),
  // KHÁC với "healthcare.procedure.perform" dùng cho bắt đầu/hoàn tất — gate
  // theo canPlan cho đúng, không dùng canPerform ở đây.
  const canCancel = canPlan && procedure.status === "IN_PROGRESS";

  return (
    <div className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-zinc-900">
            {procedure.procedureType?.trim() || procedure.catalogItem?.name || "Thủ thuật"}
          </p>
          <p className="text-sm text-zinc-500">
            Bác sĩ: {procedure.primaryClinician?.displayName ?? "—"} · Lịch:{" "}
            {formatDateTime(toIso(procedure.scheduledAt)) ?? "—"} · Thực hiện:{" "}
            {formatDateTime(toIso(procedure.performedAt)) ?? "—"}
          </p>
        </div>
        <span className="whitespace-nowrap rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
          {PROCEDURE_STATUS_LABEL[procedure.status] ?? procedure.status}
        </span>
      </div>

      {isPlannedOrReady ? <ReadinessCheck companyId={companyId} procedureId={procedure.id} /> : null}

      {canStart || canCancel ? (
        <div className="flex flex-wrap gap-2">
          {canStart ? (
            <button
              type="button"
              disabled={pending}
              onClick={handleStart}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              Bắt đầu
            </button>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              disabled={pending}
              onClick={handleCancel}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              Huỷ
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {procedure.status === "IN_PROGRESS" && canPerform ? (
        <CompleteProcedureForm companyId={companyId} procedureId={procedure.id} />
      ) : null}

      {procedure.materialUsages.length > 0 ? (
        <MaterialUsageList companyId={companyId} usages={procedure.materialUsages} canPerform={canPerform} />
      ) : null}
    </div>
  );
}

function ReadinessCheck({ companyId, procedureId }: { companyId: string; procedureId: string }) {
  const [result, setResult] = useState<{ ready: boolean; reasons: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCheck() {
    setError(null);
    startTransition(async () => {
      try {
        const readiness = await getProcedureReadinessAction(companyId, procedureId);
        setResult(readiness);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể kiểm tra điều kiện.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <button
          type="button"
          disabled={pending}
          onClick={handleCheck}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
        >
          Kiểm tra điều kiện
        </button>
      </div>
      {result ? (
        result.ready ? (
          <p className="text-sm text-emerald-600">Đủ điều kiện thực hiện.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm text-red-600">
            {result.reasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        )
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function CompleteProcedureForm({ companyId, procedureId }: { companyId: string; procedureId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; // BAT BUOC capture TRUOC closure async
        const formData = new FormData(form);
        const inventoryItemId = String(formData.get("inventoryItemId") ?? "").trim();
        const inventoryLocationId = String(formData.get("inventoryLocationId") ?? "").trim();
        const quantityRaw = String(formData.get("quantity") ?? "").trim();
        // Hoàn tất không thể tuỳ ý sửa lại — bắt buộc xác nhận trước khi gửi.
        if (!window.confirm("Hoàn tất thủ thuật này? Sau khi hoàn tất sẽ không sửa lại được.")) return;
        setError(null);
        startTransition(async () => {
          try {
            await completeProcedureAction({
              companyId,
              procedureId,
              // Để trống dòng vật tư -> materials: undefined (KHÔNG gửi mảng rỗng).
              materials:
                inventoryItemId && inventoryLocationId && quantityRaw
                  ? [{ inventoryItemId, inventoryLocationId, quantity: Number(quantityRaw) }]
                  : undefined,
            });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể hoàn tất thủ thuật.");
          }
        });
      }}
    >
      <h4 className="text-sm font-semibold text-zinc-900">Hoàn tất thủ thuật</h4>
      <p className="text-sm text-zinc-500">Vật tư tiêu hao (để trống nếu không dùng vật tư):</p>
      <div className="flex flex-wrap gap-2">
        <input
          name="inventoryItemId"
          placeholder="ID sản phẩm/vật tư"
          className="w-48 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <input
          name="inventoryLocationId"
          placeholder="ID kho/địa điểm"
          className="w-48 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <input
          name="quantity"
          type="number"
          min={0}
          step="any"
          placeholder="Số lượng"
          className="w-28 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          Hoàn tất
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

function MaterialUsageList({
  companyId,
  usages,
  canPerform,
}: {
  companyId: string;
  usages: ProcedureMaterialUsageDetail[];
  canPerform: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3">
      <p className="text-sm font-semibold text-zinc-900">Vật tư đã dùng</p>
      <ul className="flex flex-col gap-2">
        {usages.map((usage) => (
          <MaterialUsageRow key={usage.id} companyId={companyId} usage={usage} canPerform={canPerform} />
        ))}
      </ul>
    </div>
  );
}

function MaterialUsageRow({
  companyId,
  usage,
  canPerform,
}: {
  companyId: string;
  usage: ProcedureMaterialUsageDetail;
  canPerform: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleReverse() {
    if (!window.confirm("Hoàn trả vật tư này về kho?")) return;
    const reason = window.prompt("Lý do hoàn trả:");
    if (!reason || !reason.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await reverseProcedureMaterialAction({ companyId, usageId: usage.id, reason: reason.trim() });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể hoàn trả vật tư.");
      }
    });
  }

  const canReverse = canPerform && usage.status !== "REVERSED";

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-100 px-3 py-2 text-sm">
      <span className="text-zinc-700">
        {usage.inventoryItem.name} · {usage.quantity} {usage.inventoryItem.unit} · {usage.inventoryLocation.name}
        {usage.status === "REVERSED" ? " · Đã hoàn trả" : ""}
      </span>
      <div className="flex items-center gap-2">
        {canReverse ? (
          <button
            type="button"
            disabled={pending}
            onClick={handleReverse}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            Hoàn trả
          </button>
        ) : null}
      </div>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </li>
  );
}
