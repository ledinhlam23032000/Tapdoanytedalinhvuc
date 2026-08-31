"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCustomerAction } from "@/lib/actions/customer-actions";

type Initial = {
  name: string;
  phone: string;
  email: string;
  address: string;
  sourceId: string;
  organizationUnitId: string;
};

export function EditCustomerForm({
  companyId,
  customerId,
  initial,
  sources,
  organizationUnits,
}: {
  companyId: string;
  customerId: string;
  initial: Initial;
  sources: { id: string; name: string }[];
  organizationUnits: { id: string; name: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          try {
            await updateCustomerAction({
              companyId,
              customerId,
              name: String(formData.get("name") ?? ""),
              phone: String(formData.get("phone") ?? "") || undefined,
              email: String(formData.get("email") ?? "") || undefined,
              address: String(formData.get("address") ?? "") || undefined,
              sourceId: String(formData.get("sourceId") ?? "") || undefined,
              organizationUnitId: String(formData.get("organizationUnitId") ?? "") || undefined,
            });
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể cập nhật khách hàng.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Tên</label>
        <input
          name="name"
          required
          maxLength={200}
          defaultValue={initial.name}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Điện thoại</label>
          <input
            name="phone"
            maxLength={20}
            defaultValue={initial.phone}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Email</label>
          <input
            name="email"
            type="email"
            defaultValue={initial.email}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Địa chỉ</label>
          <input
            name="address"
            maxLength={500}
            defaultValue={initial.address}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        {sources.length > 0 ? (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Nguồn</label>
            <select
              name="sourceId"
              defaultValue={initial.sourceId}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
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
              defaultValue={initial.organizationUnitId}
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
          Lưu thay đổi
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
