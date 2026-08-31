"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCustomerAction, findPossibleDuplicateCustomersAction } from "@/lib/actions/customer-actions";

type Option = { id: string; name: string };

export function CreateCustomerForm({
  companyId,
  code,
  sources,
  owners,
  organizationUnits,
}: {
  companyId: string;
  code: string;
  sources: Option[];
  owners: { id: string; displayName: string }[];
  organizationUnits: Option[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        const phone = String(formData.get("phone") ?? "").trim();
        setError(null);
        startTransition(async () => {
          try {
            // mục CXCIII: cảnh báo trùng SĐT trước khi tạo — không chặn, chỉ
            // yêu cầu bấm lại nút để xác nhận vẫn tạo mới.
            if (phone && !confirmed) {
              const duplicates = await findPossibleDuplicateCustomersAction(companyId, phone);
              if (duplicates.length > 0) {
                setDuplicateWarning(
                  "Có thể khách hàng này đã tồn tại. Trùng số điện thoại với: " +
                    duplicates.map((d) => d.name).join(", "),
                );
                setConfirmed(true);
                return;
              }
            }
            const customer = await createCustomerAction({
              companyId,
              name: String(formData.get("name") ?? ""),
              phone: phone || undefined,
              sourceId: String(formData.get("sourceId") ?? "") || undefined,
              ownerUserId: String(formData.get("ownerUserId") ?? "") || undefined,
              organizationUnitId: String(formData.get("organizationUnitId") ?? "") || undefined,
            });
            router.push(`/c/${code}/customers/${customer.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tạo khách hàng.");
          }
        });
      }}
    >
      <h3 className="text-sm font-semibold text-zinc-900">Thêm khách hàng nhanh</h3>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Tên</label>
        <input name="name" required maxLength={200} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Điện thoại</label>
          <input
            name="phone"
            maxLength={20}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            onChange={() => {
              setConfirmed(false);
              setDuplicateWarning(null);
            }}
          />
        </div>
        {sources.length > 0 ? (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Nguồn</label>
            <select name="sourceId" defaultValue="" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
              <option value="">—</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {owners.length > 0 ? (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Người phụ trách</label>
            <select
              name="ownerUserId"
              defaultValue=""
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.displayName}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {organizationUnits.length > 0 ? (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Đơn vị</label>
            <select
              name="organizationUnitId"
              defaultValue=""
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {organizationUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {duplicateWarning ? "Vẫn tạo mới" : "Tạo khách hàng"}
        </button>
      </div>
      {duplicateWarning ? <p className="text-sm text-zinc-600">{duplicateWarning}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
