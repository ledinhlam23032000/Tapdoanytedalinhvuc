"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveClinicalPhotoAction,
  createMedicalFollowUpAction,
  recordFollowUpOutcomeAction,
  closeMedicalFollowUpAction,
} from "@/lib/actions/healthcare-actions";
import { CLINICAL_PHOTO_TYPE_LABEL, MEDICAL_FOLLOWUP_STATUS_LABEL, formatDateTime } from "../../work-labels";

// Ảnh lâm sàng (ClinicalPhoto) + Theo dõi (MedicalFollowUp) — Phần 7.
//
// ẢNH LÂM SÀNG (ADR-041): upload THẬT qua route server
// `/api/healthcare/photos` (multipart, local filesystem MVP — chưa có
// provider S3/GCS ngoài) — form gửi `<input type="file">` thẳng tới route,
// route tự tính checksum/sinh storageKey rồi gọi `registerClinicalPhoto`.
// Component này KHÔNG gọi `registerClinicalPhotoAction` trực tiếp (đó chỉ
// nhận metadata đã có sẵn, không nhận binary) — xem
// `src/app/api/healthcare/photos/route.ts`. Xem ảnh qua
// `/api/healthcare/photos/[id]` (route thứ hai, có đủ 4 lớp kiểm quyền tại
// thời điểm request, KHÔNG phải signed URL).
//
// THEO DÕI (ADR-045 / bất biến #42/#93/#104): MedicalFollowUp chỉ ghi Ý
// NGHĨA LÂM SÀNG, không phải task. `recordFollowUpOutcomeAction` là đường
// DUY NHẤT chuyển trạng thái sang DONE (ngầm, bên trong service) — KHÔNG có
// nút "đánh dấu DONE" tay ở đây. Đóng lịch theo dõi qua đường khác
// (`closeMedicalFollowUpAction`) chỉ cho phép kết quả MISSED/CANCELLED khi
// chưa có kết luận lâm sàng.
//
// Kiểu prop dưới đây TỰ ĐỊNH NGHĨA dựa theo field trả về của
// `getClinicalPhotoList`/`getFollowUpList` trong
// "@/lib/domain/healthcare/clinical-photo-service" và "...followup-service"
// — chỉ khai phần UI thực sự dùng. page.tsx tổng hợp (viết riêng, không phải
// file này) chịu trách nhiệm fetch bằng domain service rồi map/truyền props
// đúng shape này xuống; component này là Client Component nên không được tự
// gọi domain service (chỉ gọi Server Action, đúng ranh giới boundary).

type ClinicalPhotoTypeValue = "BEFORE" | "AFTER" | "PROGRESS" | "CLINICAL_FINDING" | "OTHER";
type ClinicalPhotoStatusValue = "ACTIVE" | "ARCHIVED";
type MedicalFollowUpStatusValue = "PLANNED" | "DUE" | "DONE" | "MISSED" | "CANCELLED";

/** Procedure rút gọn — chỉ để chọn liên kết ảnh/lịch theo dõi với 1 thủ
 *  thuật cụ thể, không phải chi tiết Procedure đầy đủ (xem procedure-section.tsx
 *  cho bản đầy đủ). `procedureType` là String? tự do trên schema (không phải
 *  enum) nên có thể null — KHÔNG tự bịa nhãn dịch cho nó. */
export type ProcedureLinkOption = {
  id: string;
  procedureType: string | null;
};

/** Khớp field trả về của `getClinicalPhotoList` (Omit checksumSha256) —
 *  danh sách hiển thị không cần checksum. */
export type PhotoListItem = {
  id: string;
  fileName: string;
  photoType: ClinicalPhotoTypeValue;
  capturedAt: Date;
  status: ClinicalPhotoStatusValue;
};

/** Khớp field trả về của `getFollowUpList` (MedicalFollowUpView) — chỉ lấy
 *  phần UI cần, đúng như nhiệm vụ yêu cầu. */
export type FollowUpListItem = {
  id: string;
  scheduledFor: Date;
  status: MedicalFollowUpStatusValue;
  clinicalOutcome: string | null;
  procedureId: string | null;
  workItemId: string | null;
};

type PhotoFollowUpSectionProps = {
  companyId: string;
  medicalCaseId: string;
  procedures: ProcedureLinkOption[];
  photos: PhotoListItem[];
  followUps: FollowUpListItem[];
  canManagePhoto: boolean;
  canManageFollowUp: boolean;
};

function procedureOptionLabel(p: ProcedureLinkOption): string {
  const type = p.procedureType?.trim();
  return type ? `${type} (#${p.id.slice(-6)})` : `Thủ thuật #${p.id.slice(-6)}`;
}

export function PhotoFollowUpSection({
  companyId,
  medicalCaseId,
  procedures,
  photos,
  followUps,
  canManagePhoto,
  canManageFollowUp,
}: PhotoFollowUpSectionProps) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">Ảnh lâm sàng</h3>

        {canManagePhoto ? (
          <RegisterClinicalPhotoForm companyId={companyId} medicalCaseId={medicalCaseId} procedures={procedures} />
        ) : null}

        {photos.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            Chưa có ảnh lâm sàng nào.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {photos.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm"
              >
                <div>
                  <a
                    href={`/api/healthcare/photos/${p.id}?companyId=${companyId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-900 underline"
                  >
                    {p.fileName}
                  </a>
                  <p className="text-xs text-zinc-500">
                    {CLINICAL_PHOTO_TYPE_LABEL[p.photoType] ?? p.photoType} ·{" "}
                    {formatDateTime(p.capturedAt.toISOString())}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={
                      p.status === "ACTIVE"
                        ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
                        : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                    }
                  >
                    {p.status === "ACTIVE" ? "Đang dùng" : "Đã lưu trữ"}
                  </span>
                  {canManagePhoto && p.status === "ACTIVE" ? (
                    <ArchivePhotoButton companyId={companyId} clinicalPhotoId={p.id} />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">Theo dõi</h3>

        {canManageFollowUp ? (
          <CreateFollowUpForm companyId={companyId} medicalCaseId={medicalCaseId} procedures={procedures} />
        ) : null}

        {followUps.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            Chưa có lịch theo dõi nào.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {followUps.map((f) => (
              <li key={f.id} className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">
                    {MEDICAL_FOLLOWUP_STATUS_LABEL[f.status] ?? f.status}
                  </span>
                  <span>{formatDateTime(f.scheduledFor.toISOString())}</span>
                </div>

                {f.clinicalOutcome ? <p className="mt-1 text-zinc-700">Kết quả: {f.clinicalOutcome}</p> : null}

                {canManageFollowUp && (f.status === "PLANNED" || f.status === "DUE") ? (
                  <FollowUpActionForms companyId={companyId} followUpId={f.id} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ===== Ảnh lâm sàng — đăng ký metadata =====

function RegisterClinicalPhotoForm({
  companyId,
  medicalCaseId,
  procedures,
}: {
  companyId: string;
  medicalCaseId: string;
  procedures: ProcedureLinkOption[];
}) {
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
        const file = formData.get("file");
        if (!(file instanceof File) || file.size === 0) {
          setError("Chọn một tệp ảnh.");
          return;
        }
        setError(null);
        startTransition(async () => {
          try {
            // Upload THẬT qua route server (ADR-041): route tính checksum,
            // ghi binary xuống đĩa, sinh storageKey ngẫu nhiên rồi tự gọi
            // registerClinicalPhoto — Client Component ở đây KHÔNG tự tính
            // checksum/storageKey (đó là việc của server, không phải trình
            // duyệt tự khai).
            const upload = new FormData();
            upload.set("file", file);
            upload.set("companyId", companyId);
            upload.set("medicalCaseId", medicalCaseId);
            if (formData.get("procedureId")) upload.set("procedureId", String(formData.get("procedureId")));
            if (formData.get("photoType")) upload.set("photoType", String(formData.get("photoType")));
            if (formData.get("bodyArea")) upload.set("bodyArea", String(formData.get("bodyArea")));

            const res = await fetch("/api/healthcare/photos", { method: "POST", body: upload });
            if (!res.ok) {
              const body = (await res.json().catch(() => null)) as { error?: string } | null;
              throw new Error(body?.error ?? "Không thể tải ảnh lên.");
            }
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tải ảnh lên.");
          }
        });
      }}
    >
      <h4 className="text-sm font-semibold text-zinc-900">Tải ảnh lâm sàng lên</h4>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Tệp ảnh</label>
        <input
          name="file"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Loại ảnh (tuỳ chọn)</label>
          <select name="photoType" defaultValue="" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
            <option value="">— Mặc định —</option>
            {Object.entries(CLINICAL_PHOTO_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {procedures.length > 0 ? (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Gắn với thủ thuật (tuỳ chọn)</label>
            <select name="procedureId" defaultValue="" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
              <option value="">Không gắn thủ thuật</option>
              {procedures.map((p) => (
                <option key={p.id} value={p.id}>
                  {procedureOptionLabel(p)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Vị trí trên cơ thể (tuỳ chọn)</label>
        <input name="bodyArea" maxLength={200} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Tải lên
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

function ArchivePhotoButton({ companyId, clinicalPhotoId }: { companyId: string; clinicalPhotoId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Lưu trữ ảnh này? Ảnh sẽ không còn hiện ở luồng xem thông thường.")) return;
          const archiveReason = window.prompt("Lý do lưu trữ:");
          if (!archiveReason || !archiveReason.trim()) return;
          setError(null);
          startTransition(async () => {
            try {
              await archiveClinicalPhotoAction({ companyId, clinicalPhotoId, archiveReason: archiveReason.trim() });
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Không thể lưu trữ ảnh.");
            }
          });
        }}
        className="text-sm text-red-600 hover:underline disabled:opacity-60"
      >
        Lưu trữ
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

// ===== Theo dõi (MedicalFollowUp) =====

function CreateFollowUpForm({
  companyId,
  medicalCaseId,
  procedures,
}: {
  companyId: string;
  medicalCaseId: string;
  procedures: ProcedureLinkOption[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [createWorkItem, setCreateWorkItem] = useState(false);
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; // BAT BUOC capture TRUOC async closure
        const formData = new FormData(form);
        const scheduledForRaw = String(formData.get("scheduledFor") ?? "");
        const procedureId = String(formData.get("procedureId") ?? "");
        const workItemTitle = String(formData.get("workItemTitle") ?? "").trim();
        setError(null);
        if (createWorkItem && !workItemTitle) {
          setError("Nhập tiêu đề công việc nhắc nhở.");
          return;
        }
        startTransition(async () => {
          try {
            await createMedicalFollowUpAction({
              companyId,
              medicalCaseId,
              scheduledFor: new Date(scheduledForRaw),
              procedureId: procedureId || undefined,
              workItem: createWorkItem ? { title: workItemTitle } : undefined,
            });
            form.reset();
            setCreateWorkItem(false);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tạo lịch theo dõi.");
          }
        });
      }}
    >
      <h4 className="text-sm font-semibold text-zinc-900">Tạo lịch theo dõi</h4>

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Ngày hẹn</label>
          <input
            name="scheduledFor"
            type="datetime-local"
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>

        {procedures.length > 0 ? (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Gắn với thủ thuật (tuỳ chọn)</label>
            <select name="procedureId" defaultValue="" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
              <option value="">Không gắn thủ thuật</option>
              {procedures.map((p) => (
                <option key={p.id} value={p.id}>
                  {procedureOptionLabel(p)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input type="checkbox" checked={createWorkItem} onChange={(e) => setCreateWorkItem(e.target.checked)} />
        Tạo công việc nhắc nhở
      </label>

      {createWorkItem ? (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Tiêu đề công việc</label>
          <input
            name="workItemTitle"
            required={createWorkItem}
            maxLength={200}
            placeholder="Ví dụ: Gọi nhắc tái khám ngày 3"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Tạo lịch theo dõi
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

const CLOSING_STATUS_LABEL: Record<"MISSED" | "CANCELLED", string> = {
  MISSED: MEDICAL_FOLLOWUP_STATUS_LABEL.MISSED,
  CANCELLED: MEDICAL_FOLLOWUP_STATUS_LABEL.CANCELLED,
};

/** Hai form nhỏ cạnh mỗi lịch theo dõi PLANNED/DUE — ghi kết luận lâm sàng
 *  (đường DUY NHẤT tới DONE, xem followup-service.ts) và đóng lịch với kết
 *  quả MISSED/CANCELLED (DONE cố tình KHÔNG có ở đây — muốn đóng với DONE thì
 *  phải ghi kết luận lâm sàng trước, service tự chặn nếu làm ngược). */
function FollowUpActionForms({ companyId, followUpId }: { companyId: string; followUpId: string }) {
  const [outcomeError, setOutcomeError] = useState<string | null>(null);
  const [outcomePending, startOutcomeTransition] = useTransition();
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closePending, startCloseTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget; // BAT BUOC capture TRUOC async closure
          const formData = new FormData(form);
          const clinicalOutcome = String(formData.get("clinicalOutcome") ?? "").trim();
          setOutcomeError(null);
          startOutcomeTransition(async () => {
            try {
              await recordFollowUpOutcomeAction({ companyId, followUpId, clinicalOutcome });
              form.reset();
              router.refresh();
            } catch (err) {
              setOutcomeError(err instanceof Error ? err.message : "Không thể ghi nhận kết quả.");
            }
          });
        }}
      >
        <label className="text-sm font-medium text-zinc-700">Ghi nhận kết quả lâm sàng</label>
        <textarea name="clinicalOutcome" required rows={2} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        <div>
          <button
            type="submit"
            disabled={outcomePending}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Ghi nhận
          </button>
        </div>
        {outcomeError ? <p className="text-sm text-red-600">{outcomeError}</p> : null}
      </form>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget; // BAT BUOC capture TRUOC async closure
          const formData = new FormData(form);
          const finalStatus = String(formData.get("finalStatus") ?? "MISSED") as "MISSED" | "CANCELLED";
          if (!window.confirm("Đóng lịch theo dõi này? Hành động này không thể hoàn tác.")) return;
          setCloseError(null);
          startCloseTransition(async () => {
            try {
              await closeMedicalFollowUpAction({ companyId, followUpId, finalStatus });
              router.refresh();
            } catch (err) {
              setCloseError(err instanceof Error ? err.message : "Không thể đóng lịch theo dõi.");
            }
          });
        }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Đóng với kết quả</label>
          <select name="finalStatus" defaultValue="MISSED" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
            {(Object.keys(CLOSING_STATUS_LABEL) as Array<"MISSED" | "CANCELLED">).map((status) => (
              <option key={status} value={status}>
                {CLOSING_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={closePending}
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          Đóng
        </button>
        {closeError ? <p className="w-full text-sm text-red-600">{closeError}</p> : null}
      </form>
    </div>
  );
}
