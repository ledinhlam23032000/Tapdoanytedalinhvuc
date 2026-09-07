"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createConsentTemplateAction,
  archiveConsentTemplateAction,
  createConsentRecordAction,
  signConsentAction,
  revokeConsentAction,
} from "@/lib/actions/healthcare-actions";
import { CONSENT_STATUS_LABEL, CONSENT_TYPE_LABEL, formatDateTime } from "../../work-labels";
import type { ConsentStatus, ConsentType } from "@/generated/prisma";

// Kiểu prop dựa theo ConsentTemplateView/ConsentRecordView của
// "@/lib/domain/healthcare/consent-service" (đọc trực tiếp field cần cho UI,
// không import type từ service vì Server Component gọi service — page.tsx
// tổng hợp do người khác viết sẽ tự map sang đúng shape này).

type ConsentTemplateItem = {
  id: string;
  code: string;
  title: string;
  version: number;
  consentType: ConsentType;
  status: "ACTIVE" | "ARCHIVED";
};

type ConsentRecordItem = {
  id: string;
  /** Trạng thái đã lưu trong DB — dùng để quyết định hiện form ký/nút thu hồi. */
  status: ConsentStatus;
  /** Trạng thái sau khi tính hạn — dùng để hiển thị nhãn (vd SIGNED quá hạn hiện "Hết hạn"). */
  effectiveStatus: ConsentStatus;
  consentType: ConsentType;
  titleSnapshot: string;
  bodySnapshot: string;
  templateVersion: number | null;
  signedAt: Date | null;
  signedByCustomerId: string | null;
  signerName: string | null;
  signerRelationship: string | null;
  revokedAt: Date | null;
  revokeReason: string | null;
};

function truncateBody(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}...` : trimmed;
}

export function ConsentSection({
  companyId,
  medicalCaseId,
  consentRecords,
  consentTemplates,
  canManage,
}: {
  companyId: string;
  medicalCaseId: string;
  consentRecords: ConsentRecordItem[];
  consentTemplates: ConsentTemplateItem[];
  canManage: boolean;
}) {
  const activeTemplates = consentTemplates.filter((t) => t.status === "ACTIVE");

  return (
    <div className="flex flex-col gap-6">
      {canManage ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-zinc-900">Mẫu phiếu đồng ý</h3>
          <CreateConsentTemplateForm companyId={companyId} />
          {consentTemplates.length === 0 ? (
            <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
              Chưa có mẫu phiếu đồng ý nào.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {consentTemplates.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm"
                >
                  <div>
                    <p className="text-zinc-900">
                      {t.title} <span className="text-zinc-500">({t.code} · v{t.version})</span>
                    </p>
                    <p className="text-xs text-zinc-500">{CONSENT_TYPE_LABEL[t.consentType] ?? t.consentType}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        t.status === "ACTIVE"
                          ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
                          : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                      }
                    >
                      {t.status === "ACTIVE" ? "Đang dùng" : "Đã ngừng dùng"}
                    </span>
                    {t.status === "ACTIVE" ? (
                      <ArchiveConsentTemplateButton companyId={companyId} consentTemplateId={t.id} />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">Phiếu đồng ý</h3>
        {canManage ? (
          <CreateConsentRecordForm
            companyId={companyId}
            medicalCaseId={medicalCaseId}
            consentTemplates={activeTemplates}
          />
        ) : null}
        {consentRecords.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            Chưa có phiếu đồng ý nào.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {consentRecords.map((r) => (
              <li key={r.id} className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">
                    {CONSENT_TYPE_LABEL[r.consentType] ?? r.consentType}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">
                    {CONSENT_STATUS_LABEL[r.effectiveStatus] ?? r.effectiveStatus}
                  </span>
                  {r.templateVersion !== null ? <span>Phiên bản mẫu: v{r.templateVersion}</span> : null}
                </div>

                <p className="mt-1 font-medium text-zinc-900">{r.titleSnapshot}</p>
                <p className="mt-1 text-zinc-600">{truncateBody(r.bodySnapshot, 200)}</p>

                {r.status === "SIGNED" ? (
                  <p className="mt-2 text-xs text-zinc-500">
                    Ký bởi {r.signerName ? `${r.signerName} (${r.signerRelationship ?? "—"})` : "khách hàng"} lúc{" "}
                    {formatDateTime(r.signedAt ? r.signedAt.toISOString() : null) ?? "—"}
                  </p>
                ) : null}

                {r.status === "REVOKED" ? (
                  <p className="mt-2 text-xs text-red-600">Đã thu hồi — lý do: {r.revokeReason}</p>
                ) : null}

                {canManage && r.status === "DRAFT" ? (
                  <SignConsentForm companyId={companyId} consentRecordId={r.id} />
                ) : null}

                {canManage && r.status === "SIGNED" ? (
                  <div className="mt-2">
                    <RevokeConsentButton companyId={companyId} consentRecordId={r.id} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CreateConsentTemplateForm({ companyId }: { companyId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; // BAT BUOC capture TRUOC async closure
        const formData = new FormData(form);
        const code = String(formData.get("code") ?? "");
        const title = String(formData.get("title") ?? "");
        const body = String(formData.get("body") ?? "");
        const consentType = String(formData.get("consentType") ?? "PROCEDURE") as ConsentType;
        setError(null);
        startTransition(async () => {
          try {
            await createConsentTemplateAction({ companyId, code, title, body, consentType });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tạo mẫu phiếu đồng ý.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Mã mẫu</label>
        <input name="code" required className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Tiêu đề</label>
        <input name="title" required className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Loại</label>
        <select
          name="consentType"
          defaultValue="PROCEDURE"
          className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          {Object.entries(CONSENT_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Nội dung</label>
        <textarea name="body" required rows={4} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Tạo mẫu
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

function ArchiveConsentTemplateButton({
  companyId,
  consentTemplateId,
}: {
  companyId: string;
  consentTemplateId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Ngừng dùng mẫu phiếu đồng ý này?")) return;
          setError(null);
          startTransition(async () => {
            try {
              await archiveConsentTemplateAction({ companyId, consentTemplateId });
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Không thể ngừng dùng mẫu phiếu đồng ý.");
            }
          });
        }}
        className="text-sm text-red-600 hover:underline disabled:opacity-60"
      >
        Ngừng dùng
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function CreateConsentRecordForm({
  companyId,
  medicalCaseId,
  consentTemplates,
}: {
  companyId: string;
  medicalCaseId: string;
  consentTemplates: ConsentTemplateItem[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [templateId, setTemplateId] = useState("");
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; // BAT BUOC capture TRUOC async closure
        const formData = new FormData(form);
        const consentTemplateId = String(formData.get("consentTemplateId") ?? "").trim();
        const title = String(formData.get("title") ?? "").trim();
        const body = String(formData.get("body") ?? "").trim();
        setError(null);
        startTransition(async () => {
          try {
            await createConsentRecordAction({
              companyId,
              medicalCaseId,
              consentTemplateId: consentTemplateId || undefined,
              title: consentTemplateId ? undefined : title || undefined,
              body: consentTemplateId ? undefined : body || undefined,
            });
            form.reset();
            setTemplateId("");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể lập phiếu đồng ý.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Mẫu phiếu (tuỳ chọn)</label>
        <select
          name="consentTemplateId"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">— Nhập tay —</option>
          {consentTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} ({t.code} · v{t.version})
            </option>
          ))}
        </select>
      </div>
      {templateId === "" ? (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Tiêu đề</label>
            <input name="title" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Nội dung</label>
            <textarea name="body" rows={4} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          </div>
        </>
      ) : null}
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Lập phiếu
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

function SignConsentForm({ companyId, consentRecordId }: { companyId: string; consentRecordId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"customer" | "proxy">("customer");
  const router = useRouter();

  return (
    <form
      className="mt-3 flex flex-col gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; // BAT BUOC capture TRUOC async closure
        const formData = new FormData(form);
        setError(null);
        startTransition(async () => {
          try {
            if (mode === "customer") {
              const customerId = String(formData.get("customerId") ?? "").trim();
              await signConsentAction({
                companyId,
                consentRecordId,
                signedByCustomerId: customerId || undefined,
              });
            } else {
              const signerName = String(formData.get("signerName") ?? "").trim();
              const signerRelationship = String(formData.get("signerRelationship") ?? "").trim();
              await signConsentAction({
                companyId,
                consentRecordId,
                signerName: signerName || undefined,
                signerRelationship: signerRelationship || undefined,
              });
            }
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể ký phiếu đồng ý.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-2 text-sm text-zinc-700">
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "customer"} onChange={() => setMode("customer")} />
          Khách tự ký
        </label>
        {mode === "customer" ? (
          <input
            name="customerId"
            placeholder="ID khách hàng (để trống nếu là khách của ca này)"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        ) : null}

        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "proxy"} onChange={() => setMode("proxy")} />
          Người nhà ký thay
        </label>
        {mode === "proxy" ? (
          <div className="flex flex-col gap-2">
            <input
              name="signerName"
              placeholder="Tên người ký thay"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              name="signerRelationship"
              placeholder="Quan hệ với khách hàng"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        ) : null}
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          Ký phiếu
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

function RevokeConsentButton({ companyId, consentRecordId }: { companyId: string; consentRecordId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Thu hồi phiếu đồng ý này? Hành động này không thể hoàn tác.")) return;
          const reason = window.prompt("Lý do thu hồi:");
          if (!reason || !reason.trim()) return;
          setError(null);
          startTransition(async () => {
            try {
              await revokeConsentAction({ companyId, consentRecordId, reason: reason.trim() });
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Không thể thu hồi phiếu đồng ý.");
            }
          });
        }}
        className="text-sm text-red-600 hover:underline disabled:opacity-60"
      >
        Thu hồi
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
