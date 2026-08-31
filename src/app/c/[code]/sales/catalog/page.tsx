import Link from "next/link";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getCatalogItems } from "@/lib/domain/sales-service";
import { CATALOG_ITEM_TYPE_LABEL, formatMoney } from "../../work-labels";
import { CreateCatalogItemForm } from "./create-catalog-item-form";
import { CatalogItemToggle } from "./catalog-item-toggle";

export const dynamic = "force-dynamic";

export default async function CatalogPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ctx = await requireCompanyPageByCode(code, "catalog.view");

  // activeOnly: false — đây là trang quản lý, cần thấy cả sản phẩm/dịch vụ
  // đã ngừng bán để có thể bán lại.
  const items = await getCatalogItems(ctx.actor.id, ctx.company.id, { activeOnly: false });
  const canManage = ctx.permissions.has("catalog.manage");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/c/${code}/sales`} className="text-sm text-zinc-500 hover:text-zinc-700">
          ← Kinh doanh
        </Link>
        <h2 className="mt-2 text-lg font-semibold text-zinc-900">Danh mục sản phẩm/dịch vụ</h2>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
          Chưa có sản phẩm/dịch vụ nào.
        </p>
      ) : (
        <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="px-4 py-2 font-medium">Tên</th>
                <th className="px-4 py-2 font-medium">Loại</th>
                <th className="px-4 py-2 font-medium">Giá mặc định</th>
                <th className="px-4 py-2 font-medium">Trạng thái</th>
                {canManage ? <th className="px-4 py-2 font-medium">Thao tác</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2 text-zinc-900">{item.name}</td>
                  <td className="px-4 py-2 text-zinc-700">{CATALOG_ITEM_TYPE_LABEL[item.type] ?? item.type}</td>
                  <td className="px-4 py-2 text-zinc-700">
                    {item.defaultPrice !== null ? formatMoney(Number(item.defaultPrice)) : "—"}
                  </td>
                  <td className="px-4 py-2 text-zinc-700">{item.active ? "Đang bán" : "Ngừng bán"}</td>
                  {canManage ? (
                    <td className="px-4 py-2">
                      <CatalogItemToggle companyId={ctx.company.id} catalogItemId={item.id} active={item.active} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {canManage ? <CreateCatalogItemForm companyId={ctx.company.id} /> : null}
    </div>
  );
}
