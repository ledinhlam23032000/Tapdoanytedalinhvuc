"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  receiveStockAction,
  issueStockAction,
  transferStockAction,
  requestStockAdjustmentAction,
} from "@/lib/actions/inventory-actions";

type LocationOption = { id: string; name: string };

// Quy ước Phan 6: Nhận kho/Xuất kho/Chuyển kho/Gửi yêu cầu điều chỉnh đều là
// hành động THƯỜNG (không phải void/huỷ/từ chối) — KHÔNG cần window.confirm.

export function ReceiveStockForm({
  companyId,
  inventoryItemId,
  locations,
}: {
  companyId: string;
  inventoryItemId: string;
  locations: LocationOption[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  // Ổn định qua double-click/network-retry của CÙNG 1 lần submit (ADR-034),
  // sinh key mới sau khi thành công.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; // BAT BUOC capture TRUOC closure async
        const formData = new FormData(form);
        const locationId = String(formData.get("locationId") ?? "");
        const quantity = Number(formData.get("quantity") ?? 0);
        const reason = String(formData.get("reason") ?? "").trim();
        setError(null);
        startTransition(async () => {
          try {
            await receiveStockAction({
              companyId,
              inventoryItemId,
              locationId,
              quantity,
              reason: reason || undefined,
              idempotencyKey,
            });
            form.reset();
            setIdempotencyKey(crypto.randomUUID());
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể nhập kho.");
          }
        });
      }}
    >
      <h4 className="text-sm font-semibold text-zinc-900">Nhập kho</h4>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Kho</label>
        <select name="locationId" required defaultValue="" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
          <option value="" disabled>
            Chọn kho
          </option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Số lượng</label>
        <input name="quantity" type="number" min={0} step="any" required className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Lý do</label>
        <input name="reason" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Nhập kho
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

export function IssueStockForm({
  companyId,
  inventoryItemId,
  locations,
}: {
  companyId: string;
  inventoryItemId: string;
  locations: LocationOption[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; // BAT BUOC capture TRUOC closure async
        const formData = new FormData(form);
        const locationId = String(formData.get("locationId") ?? "");
        const quantity = Number(formData.get("quantity") ?? 0);
        const reason = String(formData.get("reason") ?? "").trim();
        setError(null);
        startTransition(async () => {
          try {
            await issueStockAction({
              companyId,
              inventoryItemId,
              locationId,
              quantity,
              reason: reason || undefined,
              idempotencyKey,
            });
            form.reset();
            setIdempotencyKey(crypto.randomUUID());
            router.refresh();
          } catch (err) {
            // LUU Y: KHONG che giau loi "Số lượng xuất kho vượt quá tồn kho
            // hiện có." — hien nguyen van thong bao tu domain service.
            setError(err instanceof Error ? err.message : "Không thể xuất kho.");
          }
        });
      }}
    >
      <h4 className="text-sm font-semibold text-zinc-900">Xuất kho</h4>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Kho</label>
        <select name="locationId" required defaultValue="" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
          <option value="" disabled>
            Chọn kho
          </option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Số lượng</label>
        <input name="quantity" type="number" min={0} step="any" required className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Lý do</label>
        <input name="reason" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Xuất kho
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

export function TransferStockForm({
  companyId,
  inventoryItemId,
  locations,
}: {
  companyId: string;
  inventoryItemId: string;
  locations: LocationOption[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; // BAT BUOC capture TRUOC closure async
        const formData = new FormData(form);
        const fromLocationId = String(formData.get("fromLocationId") ?? "");
        const toLocationId = String(formData.get("toLocationId") ?? "");
        const quantity = Number(formData.get("quantity") ?? 0);
        setError(null);
        if (fromLocationId === toLocationId) {
          setError("Kho nguồn và kho đích không được trùng nhau.");
          return;
        }
        startTransition(async () => {
          try {
            await transferStockAction({
              companyId,
              inventoryItemId,
              fromLocationId,
              toLocationId,
              quantity,
              idempotencyKey,
            });
            form.reset();
            setIdempotencyKey(crypto.randomUUID());
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể chuyển kho.");
          }
        });
      }}
    >
      <h4 className="text-sm font-semibold text-zinc-900">Chuyển kho</h4>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Từ kho</label>
        <select name="fromLocationId" required defaultValue="" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
          <option value="" disabled>
            Chọn kho nguồn
          </option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Đến kho</label>
        <select name="toLocationId" required defaultValue="" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
          <option value="" disabled>
            Chọn kho đích
          </option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Số lượng</label>
        <input name="quantity" type="number" min={0} step="any" required className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Chuyển kho
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

export function RequestAdjustmentForm({
  companyId,
  code,
  inventoryItemId,
  locations,
}: {
  companyId: string;
  code: string;
  inventoryItemId: string;
  locations: LocationOption[];
}) {
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
        const locationId = String(formData.get("locationId") ?? "");
        const direction = String(formData.get("direction") ?? "IN") as "IN" | "OUT";
        const quantity = Number(formData.get("quantity") ?? 0);
        const reason = String(formData.get("reason") ?? "");
        setError(null);
        startTransition(async () => {
          try {
            await requestStockAdjustmentAction({ companyId, inventoryItemId, locationId, direction, quantity, reason });
            router.push(`/c/${code}/inventory/adjustments`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể gửi yêu cầu điều chỉnh.");
          }
        });
      }}
    >
      <h4 className="text-sm font-semibold text-zinc-900">Yêu cầu điều chỉnh tồn kho</h4>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Kho</label>
        <select name="locationId" required defaultValue="" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
          <option value="" disabled>
            Chọn kho
          </option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Chiều điều chỉnh</label>
        <select name="direction" defaultValue="IN" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
          <option value="IN">Tăng</option>
          <option value="OUT">Giảm</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Số lượng</label>
        <input name="quantity" type="number" min={0} step="any" required className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Lý do</label>
        <input name="reason" required className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Gửi yêu cầu
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
