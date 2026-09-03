import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getActionableStockAdjustmentRequests } from "@/lib/domain/inventory-service";
import { db } from "@/lib/db";
import { APPROVAL_REQUEST_STATUS_LABEL } from "../../work-labels";
import { AdjustmentRequestActions } from "./adjustment-actions";

export const dynamic = "force-dynamic";

export default async function InventoryAdjustmentsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ctx = await requireCompanyPageByCode(code, "inventory.adjust");

  // getActionableStockAdjustmentRequests (không phải getPendingApprovalRequests
  // chung của approval-service.ts) — gồm cả APPROVED chưa thực thi, xem
  // comment tại nơi khai báo cho lý do bug đã phát hiện.
  const items = await getActionableStockAdjustmentRequests(ctx.actor.id, ctx.company.id);

  const [inventoryItems, locations] = await Promise.all([
    db.inventoryItem.findMany({ where: { companyId: ctx.company.id }, select: { id: true, name: true } }),
    db.inventoryLocation.findMany({ where: { companyId: ctx.company.id }, select: { id: true, name: true } }),
  ]);
  const itemNameById = new Map(inventoryItems.map((i) => [i.id, i.name]));
  const locationNameById = new Map(locations.map((l) => [l.id, l.name]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Yêu cầu điều chỉnh tồn kho</h2>
        <p className="text-sm text-zinc-500">Duyệt hai người cho các yêu cầu điều chỉnh số lượng tồn kho.</p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
          Chưa có yêu cầu điều chỉnh tồn kho nào đang chờ xử lý.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((request) => {
            const payload = request.payload as {
              inventoryItemId: string;
              locationId: string;
              direction: "IN" | "OUT";
              quantity: number;
            };
            return (
              <li key={request.id} className="rounded-md border border-zinc-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-zinc-900">
                        {itemNameById.get(payload.inventoryItemId) ?? payload.inventoryItemId}
                      </span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        {APPROVAL_REQUEST_STATUS_LABEL[request.status] ?? request.status}
                      </span>
                    </div>
                    <p className="text-zinc-600">
                      {payload.direction === "IN" ? "Tăng" : "Giảm"} {payload.quantity} tại{" "}
                      {locationNameById.get(payload.locationId) ?? payload.locationId}
                    </p>
                    <p className="text-zinc-600">Lý do: {request.reason}</p>
                    <p className="text-xs text-zinc-500">Người yêu cầu: {request.requestedBy.displayName}</p>
                  </div>
                  <AdjustmentRequestActions
                    companyId={ctx.company.id}
                    approvalRequestId={request.id}
                    status={request.status}
                    firstApprovedByName={request.firstApprovedByUser?.displayName ?? null}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
