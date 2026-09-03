import Link from "next/link";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getInventoryItemList, getInventoryLocationList } from "@/lib/domain/inventory-service";
import { INVENTORY_LOCATION_TYPE_LABEL } from "../work-labels";
import { CreateInventoryItemForm } from "./create-inventory-item-form";
import { CreateInventoryLocationForm } from "./create-inventory-location-form";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ctx = await requireCompanyPageByCode(code, "inventory.view");

  const [items, locations] = await Promise.all([
    getInventoryItemList(ctx.actor.id, ctx.company.id),
    getInventoryLocationList(ctx.actor.id, ctx.company.id),
  ]);

  const canManage = ctx.permissions.has("inventory.manage");
  const canAdjust = ctx.permissions.has("inventory.adjust");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Tồn kho</h2>
          <p className="text-sm text-zinc-500">Sản phẩm/vật tư, kho/địa điểm và số dư tồn kho của công ty.</p>
        </div>
        {canAdjust ? (
          <Link href={`/c/${code}/inventory/adjustments`} className="text-sm text-zinc-900 hover:underline">
            Xem yêu cầu điều chỉnh tồn kho →
          </Link>
        ) : null}
      </div>

      {canManage ? (
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[280px]">
            <h3 className="mb-2 text-sm font-semibold text-zinc-900">Thêm sản phẩm/vật tư</h3>
            <CreateInventoryItemForm companyId={ctx.company.id} />
          </div>
          <div className="flex-1 min-w-[280px]">
            <h3 className="mb-2 text-sm font-semibold text-zinc-900">Thêm kho/địa điểm</h3>
            <CreateInventoryLocationForm companyId={ctx.company.id} />
          </div>
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">Sản phẩm/Vật tư tồn kho</h3>
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            Chưa có sản phẩm/vật tư nào.
          </p>
        ) : (
          <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="px-4 py-2 font-medium">Tên</th>
                  <th className="px-4 py-2 font-medium">SKU</th>
                  <th className="px-4 py-2 font-medium">Đơn vị tính</th>
                  <th className="px-4 py-2 font-medium">Ngưỡng cảnh báo</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2">
                      <Link href={`/c/${code}/inventory/${item.id}`} className="text-zinc-900 hover:underline">
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-700">{item.sku ?? "—"}</td>
                    <td className="px-4 py-2 text-zinc-700">{item.unit}</td>
                    <td className="px-4 py-2 text-zinc-700">
                      {item.reorderLevel !== null ? Number(item.reorderLevel) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">Kho/Địa điểm</h3>
        {locations.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            Chưa có kho/địa điểm nào.
          </p>
        ) : (
          <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="px-4 py-2 font-medium">Tên</th>
                  <th className="px-4 py-2 font-medium">Loại</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((location) => (
                  <tr key={location.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2 text-zinc-700">{location.name}</td>
                    <td className="px-4 py-2 text-zinc-700">
                      {INVENTORY_LOCATION_TYPE_LABEL[location.type] ?? location.type}
                    </td>
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
