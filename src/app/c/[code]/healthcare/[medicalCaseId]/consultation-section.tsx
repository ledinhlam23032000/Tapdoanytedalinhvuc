"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createConsultationAction,
  updateDraftConsultationAction,
  finalizeConsultationAction,
  addConsultationAddendumAction,
  recordScreeningItemAction,
} from "@/lib/actions/healthcare-actions";
import { CLINICAL_RECORD_STATUS_LABEL, screeningAnswerLabel, formatDateTime } from "../../work-labels";

// Phần 7 — Healthcare Vertical: khu vực "Phiếu khám" (ClinicalConsultation)
// trong trang chi tiết MedicalCase.
//
// Toàn bộ file là "use client" (giống payroll-run-actions.tsx) vì đây là một
// cụm nhiều component tương tác (danh sách + nhiều form con) chỉ được phép
// nằm trong MỘT file theo yêu cầu nhiệm vụ. Dữ liệu `consultations` được
// page.tsx cha fetch sẵn và truyền vào qua props — component này KHÔNG tự
// gọi getConsultationList/getConsultationDetail để tránh N+1 query.
//
// ADR-039: bản ghi FINAL bất biến — form sửa chỉ hiện khi DRAFT, phiếu FINAL
// chỉ có đường bổ sung (addendum). ADR-048: "chưa ghi nhận" (answer=null)
// PHẢI là một lựa chọn tường minh trên radio, không phải trạng thái ẩn ngầm
// khi không chọn gì.

type ConsultationClinician = {
  id: string;
  displayName: string;
  email: string;
};

type ConsultationAddendum = {
  id: string;
  content: string;
  reason: string;
  createdAt: Date | string;
  author: ConsultationClinician;
};

type ConsultationScreeningItem = {
  id: string;
  itemKey: string;
  question: string;
  answer: "YES" | "NO" | null;
  note: string | null;
  recordedAt: Date | string | null;
};

/** Field trả về từ getConsultationDetail/getConsultationList của
 * "@/lib/domain/healthcare/consultation-service" — tự định nghĩa vì không
 * biết chu kỳ chính xác của page.tsx cha. */
export type ConsultationListItem = {
  id: string;
  status: "DRAFT" | "FINAL";
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  clinician: ConsultationClinician;
  finalizedAt: Date | string | null;
  createdAt: Date | string;
  addenda: ConsultationAddendum[];
  screeningItems: ConsultationScreeningItem[];
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function ConsultationSection({
  companyId,
  medicalCaseId,
  canCreate,
  canFinalize,
  consultations,
}: {
  companyId: string;
  medicalCaseId: string;
  canCreate: boolean;
  canFinalize: boolean;
  consultations: ConsultationListItem[];
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">Phiếu khám</h3>
        <p className="text-sm text-zinc-500">Phiếu khám SOAP theo từng lần khám của hồ sơ.</p>
      </div>

      {canCreate ? (
        <div className="max-w-xl">
          <CreateConsultationForm companyId={companyId} medicalCaseId={medicalCaseId} />
        </div>
      ) : null}

      {consultations.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
          Chưa có phiếu khám nào.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {consultations.map((consultation) => (
            <ConsultationCard
              key={consultation.id}
              companyId={companyId}
              consultation={consultation}
              canCreate={canCreate}
              canFinalize={canFinalize}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default ConsultationSection;

function SoapFields({
  defaultValues,
}: {
  defaultValues?: {
    subjective?: string | null;
    objective?: string | null;
    assessment?: string | null;
    plan?: string | null;
  };
}) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Subjective (lời kể bệnh nhân)</label>
        <textarea
          name="subjective"
          rows={2}
          defaultValue={defaultValues?.subjective ?? ""}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Objective (khám thực thể)</label>
        <textarea
          name="objective"
          rows={2}
          defaultValue={defaultValues?.objective ?? ""}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Assessment (đánh giá)</label>
        <textarea
          name="assessment"
          rows={2}
          defaultValue={defaultValues?.assessment ?? ""}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Plan (kế hoạch)</label>
        <textarea
          name="plan"
          rows={2}
          defaultValue={defaultValues?.plan ?? ""}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
    </>
  );
}

function CreateConsultationForm({ companyId, medicalCaseId }: { companyId: string; medicalCaseId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; // BẮT BUỘC capture TRƯỚC async closure
        const formData = new FormData(form);
        const subjective = String(formData.get("subjective") ?? "").trim();
        const objective = String(formData.get("objective") ?? "").trim();
        const assessment = String(formData.get("assessment") ?? "").trim();
        const plan = String(formData.get("plan") ?? "").trim();
        setError(null);
        startTransition(async () => {
          try {
            await createConsultationAction({
              companyId,
              medicalCaseId,
              subjective: subjective || undefined,
              objective: objective || undefined,
              assessment: assessment || undefined,
              plan: plan || undefined,
            });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tạo phiếu khám.");
          }
        });
      }}
    >
      <h4 className="text-sm font-semibold text-zinc-900">Tạo phiếu khám mới</h4>
      <SoapFields />
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Tạo
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

function SoapPreview({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="line-clamp-2 text-zinc-700">{value && value.trim() ? value : "—"}</dd>
    </div>
  );
}

function ConsultationCard({
  companyId,
  consultation,
  canCreate,
  canFinalize,
}: {
  companyId: string;
  consultation: ConsultationListItem;
  canCreate: boolean;
  canFinalize: boolean;
}) {
  const isDraft = consultation.status === "DRAFT";
  const statusLabel = CLINICAL_RECORD_STATUS_LABEL[consultation.status] ?? consultation.status;

  return (
    <article className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              isDraft ? "bg-zinc-100 text-zinc-700" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {statusLabel}
          </span>
          <span className="text-sm text-zinc-700">{consultation.clinician.displayName}</span>
        </div>
        <span className="text-sm text-zinc-500">{formatDateTime(toIso(consultation.createdAt))}</span>
      </div>

      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <SoapPreview label="Subjective" value={consultation.subjective} />
        <SoapPreview label="Objective" value={consultation.objective} />
        <SoapPreview label="Assessment" value={consultation.assessment} />
        <SoapPreview label="Plan" value={consultation.plan} />
      </dl>

      {isDraft ? (
        <div className="flex flex-col gap-3">
          {canCreate ? (
            <EditDraftConsultationForm
              companyId={companyId}
              consultationId={consultation.id}
              defaultValues={consultation}
            />
          ) : null}
          {canFinalize ? (
            <FinalizeConsultationButton companyId={companyId} consultationId={consultation.id} />
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-zinc-500">
            Đã chốt lúc {formatDateTime(toIso(consultation.finalizedAt)) ?? "—"}
          </p>
          <AddendaList addenda={consultation.addenda} />
          {canCreate ? <AddAddendumForm companyId={companyId} consultationId={consultation.id} /> : null}
        </div>
      )}

      <ScreeningItemsBlock
        companyId={companyId}
        consultationId={consultation.id}
        items={consultation.screeningItems}
        canRecord={isDraft && canCreate}
      />
    </article>
  );
}

function EditDraftConsultationForm({
  companyId,
  consultationId,
  defaultValues,
}: {
  companyId: string;
  consultationId: string;
  defaultValues: {
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
  };
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-dashed border-zinc-300 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        const subjective = String(formData.get("subjective") ?? "").trim();
        const objective = String(formData.get("objective") ?? "").trim();
        const assessment = String(formData.get("assessment") ?? "").trim();
        const plan = String(formData.get("plan") ?? "").trim();
        setError(null);
        startTransition(async () => {
          try {
            await updateDraftConsultationAction({
              companyId,
              consultationId,
              subjective: subjective || undefined,
              objective: objective || undefined,
              assessment: assessment || undefined,
              plan: plan || undefined,
            });
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể lưu phiếu khám.");
          }
        });
      }}
    >
      <h5 className="text-sm font-medium text-zinc-700">Sửa nội dung (còn nháp)</h5>
      <SoapFields defaultValues={defaultValues} />
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Lưu
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

function FinalizeConsultationButton({
  companyId,
  consultationId,
}: {
  companyId: string;
  consultationId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleFinalize() {
    if (
      !window.confirm(
        "Chốt phiếu khám này? Sau khi chốt sẽ không sửa được nội dung gốc nữa, chỉ có thể bổ sung (addendum).",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await finalizeConsultationAction({ companyId, consultationId });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể chốt phiếu khám.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleFinalize}
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        Chốt phiếu
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function AddendaList({ addenda }: { addenda: ConsultationAddendum[] }) {
  if (addenda.length === 0) {
    return <p className="text-sm text-zinc-500">Chưa có bổ sung nào.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {addenda.map((addendum) => (
        <li key={addendum.id} className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
          <p className="text-zinc-800">{addendum.content}</p>
          <p className="mt-1 text-xs text-zinc-500">
            Lý do: {addendum.reason} · {addendum.author.displayName} ·{" "}
            {formatDateTime(toIso(addendum.createdAt))}
          </p>
        </li>
      ))}
    </ul>
  );
}

function AddAddendumForm({ companyId, consultationId }: { companyId: string; consultationId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        const content = String(formData.get("content") ?? "").trim();
        const reason = String(formData.get("reason") ?? "").trim();
        setError(null);
        startTransition(async () => {
          try {
            await addConsultationAddendumAction({ companyId, consultationId, content, reason });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể thêm bổ sung.");
          }
        });
      }}
    >
      <h5 className="text-sm font-medium text-zinc-700">Thêm bổ sung (addendum)</h5>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Nội dung bổ sung</label>
        <textarea
          name="content"
          required
          rows={2}
          maxLength={5000}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Lý do</label>
        <textarea
          name="reason"
          required
          rows={2}
          maxLength={2000}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Thêm
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

function ScreeningItemsBlock({
  companyId,
  consultationId,
  items,
  canRecord,
}: {
  companyId: string;
  consultationId: string;
  items: ConsultationScreeningItem[];
  canRecord: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-zinc-100 pt-3">
      <h5 className="text-sm font-medium text-zinc-700">Sàng lọc</h5>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">Chưa có mục sàng lọc nào.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="text-zinc-700">
                {item.question}
                {item.note ? <span className="text-zinc-400"> — {item.note}</span> : null}
              </span>
              <span
                className={`font-medium ${
                  item.answer === "YES"
                    ? "text-red-600"
                    : item.answer === "NO"
                      ? "text-zinc-700"
                      : "text-zinc-400"
                }`}
              >
                {screeningAnswerLabel(item.answer)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canRecord ? (
        <RecordScreeningItemForm companyId={companyId} consultationId={consultationId} />
      ) : null}
    </div>
  );
}

function RecordScreeningItemForm({
  companyId,
  consultationId,
}: {
  companyId: string;
  consultationId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-2 rounded-md border border-dashed border-zinc-300 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        const itemKey = String(formData.get("itemKey") ?? "").trim();
        const question = String(formData.get("question") ?? "").trim();
        const answerRaw = String(formData.get("answer") ?? "UNSET");
        // ADR-048: "UNSET" là lựa chọn tường minh trên radio -> answer=null,
        // KHÔNG suy null từ việc "không có radio nào được chọn".
        const answer = answerRaw === "YES" ? "YES" : answerRaw === "NO" ? "NO" : null;
        const note = String(formData.get("note") ?? "").trim();
        setError(null);
        startTransition(async () => {
          try {
            await recordScreeningItemAction({
              companyId,
              consultationId,
              itemKey,
              question,
              answer,
              note: note || undefined,
            });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể ghi nhận sàng lọc.");
          }
        });
      }}
    >
      <h6 className="text-sm font-medium text-zinc-700">Ghi nhận mục sàng lọc</h6>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Mã mục (itemKey)</label>
        <input name="itemKey" required maxLength={100} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Câu hỏi</label>
        <input name="question" required maxLength={500} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-1 text-sm text-zinc-700">
          <input type="radio" name="answer" value="UNSET" defaultChecked /> Chưa ghi nhận
        </label>
        <label className="flex items-center gap-1 text-sm text-zinc-700">
          <input type="radio" name="answer" value="YES" /> Có
        </label>
        <label className="flex items-center gap-1 text-sm text-zinc-700">
          <input type="radio" name="answer" value="NO" /> Không
        </label>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Ghi chú</label>
        <input name="note" maxLength={2000} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Ghi nhận
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
