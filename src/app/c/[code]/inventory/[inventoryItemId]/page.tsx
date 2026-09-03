import { notFound } from "next/navigation";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getStockBalance, getInventoryLocationList } from "@/lib/domain/inventory-service";
import { db } from "@/lib/db";
import { STOCK_MOVEMENT_TYPE_LABEL, formatDateTime } from "../../work-labels";
import { ReceiveStockForm, IssueStockForm, TransferStockForm, RequestAdjustmentForm } from "./inventory-item-actions";

export const dynamic = "force-dynamic";

export default async function InventoryItemDetailPage({
  params,
}: {
  params: Promise<{ code: string; inventoryItemId: string }>;
}) {
  const { code, inventoryItemId } = await params;
  const ctx = await requireCompanyPageByCode(code, "inventory.view");

  const item = await db.inventoryItem.findUnique({ where: { id: inventoryItemId } });
  if (!item || item.companyId !== ctx.company.id) notFound();

  const [balances, locations, movements] = await Promise.all([
    getStockBalance(ctx.actor.id, ctx.company.id, item.id) as Promise<{ locationId: string; balance: number }[]>,
    getInventoryLocationList(ctx.actor.id, ctx.company.id),
    db.stockMovement.findMany({
      where: { companyId: ctx.company.id, inventoryItemId: item.id },
      orderBy: { occurredAt: "desc" },
      take: 50,
      include: { location: true },
    }),
  ]);

  const locationNameById = new Map(locations.map((l) => [l.id, l.name]));
  const locationOptions = locations.map((l) => ({ id: l.id, name: l.name }));

  const canReceive = ctx.permissions.has("inventory.receive");
  const canIssue = ctx.permissions.has("inventory.issue");
  const canTransfer = ctx.permissions.has("inventory.transfer") && locations.length >= 2;
  const canAdjust = ctx.permissions.has("inventory.adjust");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">{item.name}</h2>
        <p className="text-sm text-zinc-500">
          SKU: {item.sku ?? "—"} · Đơn vị tính: {item.unit} · Ngưỡng cảnh báo:{" "}
          {item.reorderLevel !== null ? Number(item.reorderLevel) : "—"}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">Số dư theo kho</h3>
        {balances.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            Chưa có số dư nào.
          </p>
        ) : (
          <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="px-4 py-2 font-medium">Kho</th>
                  <th className="px-4 py-2 font-medium">Số dư</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={b.locationId} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2 text-zinc-700">{locationNameById.get(b.locationId) ?? b.locationId}</td>
                    <td className="px-4 py-2 text-zinc-700">{b.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </section>

      {canReceive || canIssue || canTransfer || canAdjust ? (
        <div className="flex flex-wrap gap-4">
          {canReceive ? (
            <div className="flex-1 min-w-[280px]">
              <ReceiveStockForm companyId={ctx.company.id} inventoryItemId={item.id} locations={locationOptions} />
            </div>
          ) : null}
          {canIssue ? (
            <div className="flex-1 min-w-[280px]">
              <IssueStockForm companyId={ctx.company.id} inventoryItemId={item.id} locations={locationOptions} />
            </div>
          ) : null}
          {canTransfer ? (
            <div className="flex-1 min-w-[280px]">
              <TransferStockForm companyId={ctx.company.id} inventoryItemId={item.id} locations={locationOptions} />
            </div>
          ) : null}
          {canAdjust ? (
            <div className="flex-1 min-w-[280px]">
              <RequestAdjustmentForm
                companyId={ctx.company.id}
                code={code}
                inventoryItemId={item.id}
                locations={locationOptions}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">Lịch sử di chuyển kho</h3>
        {movements.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            Chưa có lịch sử di chuyển kho.
          </p>
        ) : (
          <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="px-4 py-2 font-medium">Ngày</th>
                  <th className="px-4 py-2 font-medium">Loại</th>
                  <th className="px-4 py-2 font-medium">Số lượng</th>
                  <th className="px-4 py-2 font-medium">Kho</th>
                  <th className="px-4 py-2 font-medium">Lý do</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2 text-zinc-700">{formatDateTime(m.occurredAt.toISOString())}</td>
                    <td className="px-4 py-2 text-zinc-700">{STOCK_MOVEMENT_TYPE_LABEL[m.type] ?? m.type}</td>
                    <td className="px-4 py-2 text-zinc-700">{Number(m.quantity)}</td>
                    <td className="px-4 py-2 text-zinc-700">{m.location.name}</td>
                    <td className="px-4 py-2 text-zinc-700">{m.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </section>
    </div>
  );
}
