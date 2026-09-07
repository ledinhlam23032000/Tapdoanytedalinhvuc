import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { AuthorizationError } from "@/lib/authorization/errors";
import { getMedicalCaseDetail } from "@/lib/domain/healthcare/medical-case-service";
import { getConsultationList } from "@/lib/domain/healthcare/consultation-service";
import { getProcedureList } from "@/lib/domain/healthcare/procedure-service";
import { getConsentRecordList, getConsentTemplateList } from "@/lib/domain/healthcare/consent-service";
import { getClinicalPhotoList } from "@/lib/domain/healthcare/clinical-photo-service";
import { getFollowUpList } from "@/lib/domain/healthcare/followup-service";
import { MEDICAL_CASE_STATUS_LABEL, MEDICAL_CASE_TYPE_LABEL, formatDateTime } from "../../work-labels";
import { ConsultationSection } from "./consultation-section";
import { ProcedureSection } from "./procedure-section";
import { ConsentSection } from "./consent-section";
import { PhotoFollowUpSection } from "./photo-followup-section";
import { CaseLifecycleActions } from "./case-lifecycle-actions";

export const dynamic = "force-dynamic";

// Trang tổng hợp — điểm hội tụ CỐ Ý viết riêng (không giao cho agent song
// song), đúng tiền lệ Phần 5 (sales/[saleId]/page.tsx) và Phần 6
// (payroll/[payrollRunId]/page.tsx): trang lắp ráp nhiều section độc lập
// phải do một người nắm toàn bộ prop contract viết, để tránh 4 agent đoán
// sai shape của nhau.
export default async function MedicalCaseDetailPage({
  params,
}: {
  params: Promise<{ code: string; medicalCaseId: string }>;
}) {
  const { code, medicalCaseId } = await params;
  const ctx = await requireCompanyPageByCode(code, "healthcare.case.view");

  let medicalCase: Awaited<ReturnType<typeof getMedicalCaseDetail>>;
  try {
    medicalCase = await getMedicalCaseDetail(ctx.actor.id, ctx.company.id, medicalCaseId);
  } catch (err) {
    // "Chưa bật phân hệ Y tế" là lỗi nghiệp vụ bình thường (Error thường,
    // không phải AuthorizationError) — hiện thông báo thay vì 404, để chủ sở
    // hữu biết cần làm gì thay vì tưởng đường dẫn sai.
    if (err instanceof Error && /chưa bật phân hệ/i.test(err.message)) {
      return (
        <div className="rounded-md border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500">
          Công ty chưa bật phân hệ Y tế.{" "}
          {ctx.permissions.has("healthcare.module.manage") ? (
            <Link href={`/c/${code}/healthcare/settings`} className="text-zinc-900 underline">
              Bật tại Cài đặt phân hệ Y tế
            </Link>
          ) : (
            "Liên hệ chủ sở hữu công ty."
          )}
        </div>
      );
    }
    // AuthorizationError (không tồn tại/khác Company) là ca bình thường — 404
    // im lặng, chống resource enumeration (cùng nguyên tắc Customer detail
    // Phần 5).
    if (!(err instanceof AuthorizationError)) console.error("healthcare/[medicalCaseId] lỗi không mong đợi:", err);
    notFound();
  }
  if (!medicalCase) notFound();

  const canCreateConsultation = ctx.permissions.has("healthcare.consultation.create");
  const canFinalizeConsultation = ctx.permissions.has("healthcare.consultation.finalize");
  const canPlanProcedure = ctx.permissions.has("healthcare.procedure.plan");
  const canPerformProcedure = ctx.permissions.has("healthcare.procedure.perform");
  const canManageConsent = ctx.permissions.has("healthcare.consent.manage");
  const canManagePhoto = ctx.permissions.has("healthcare.photo.manage");
  const canManageFollowUp = ctx.permissions.has("healthcare.followup.manage");
  const canClose = ctx.permissions.has("healthcare.case.close");

  const [consultations, procedures, consentRecords, consentTemplates, photos, followUps] = await Promise.all([
    ctx.permissions.has("healthcare.consultation.view")
      ? getConsultationList(ctx.actor.id, ctx.company.id, medicalCaseId)
      : Promise.resolve([]),
    ctx.permissions.has("healthcare.procedure.view")
      ? getProcedureList(ctx.actor.id, ctx.company.id, medicalCaseId)
      : Promise.resolve([]),
    ctx.permissions.has("healthcare.consent.view")
      ? getConsentRecordList(ctx.actor.id, ctx.company.id, { medicalCaseId })
      : Promise.resolve([]),
    ctx.permissions.has("healthcare.consent.view")
      ? getConsentTemplateList(ctx.actor.id, ctx.company.id)
      : Promise.resolve([]),
    ctx.permissions.has("healthcare.photo.view")
      ? getClinicalPhotoList(ctx.actor.id, { companyId: ctx.company.id, medicalCaseId })
      : Promise.resolve([]),
    ctx.permissions.has("healthcare.followup.view")
      ? getFollowUpList(ctx.actor.id, { companyId: ctx.company.id, medicalCaseId, includeClosed: true })
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">{medicalCase.customer.name}</h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              {MEDICAL_CASE_STATUS_LABEL[medicalCase.status] ?? medicalCase.status}
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              {MEDICAL_CASE_TYPE_LABEL[medicalCase.caseType] ?? medicalCase.caseType}
            </span>
          </div>
          {medicalCase.code ? <p className="text-sm text-zinc-500">Mã hồ sơ: {medicalCase.code}</p> : null}
          {medicalCase.chiefComplaint ? (
            <p className="text-sm text-zinc-700">Lý do khám: {medicalCase.chiefComplaint}</p>
          ) : null}
          <p className="text-xs text-zinc-500">
            Mở lúc {formatDateTime(medicalCase.openedAt.toISOString())} · Bác sĩ phụ trách:{" "}
            {medicalCase.primaryClinician?.displayName ?? "Chưa phân công"}
          </p>
          {medicalCase.closedAt ? (
            <p className="text-xs text-zinc-500">
              Đã kết thúc lúc {formatDateTime(medicalCase.closedAt.toISOString())}
              {medicalCase.closeReason ? ` — ${medicalCase.closeReason}` : ""}
            </p>
          ) : null}
        </div>
        <Link href={`/c/${code}/healthcare`} className="text-sm text-zinc-500 hover:underline">
          ← Danh sách hồ sơ
        </Link>
      </div>

      {canClose ? (
        <CaseLifecycleActions
          companyId={ctx.company.id}
          medicalCaseId={medicalCase.id}
          status={medicalCase.status}
        />
      ) : null}

      <ConsultationSection
        companyId={ctx.company.id}
        medicalCaseId={medicalCase.id}
        canCreate={canCreateConsultation}
        canFinalize={canFinalizeConsultation}
        consultations={consultations.map((c) => ({
          id: c.id,
          status: c.status,
          subjective: c.subjective,
          objective: c.objective,
          assessment: c.assessment,
          plan: c.plan,
          clinician: { id: c.clinician.id, displayName: c.clinician.displayName, email: c.clinician.email },
          finalizedAt: c.finalizedAt,
          createdAt: c.createdAt,
          addenda: c.addenda.map((a) => ({
            id: a.id,
            content: a.content,
            reason: a.reason,
            createdAt: a.createdAt,
            author: { id: a.author.id, displayName: a.author.displayName, email: a.author.email },
          })),
          screeningItems: c.screeningItems.map((s) => ({
            id: s.id,
            itemKey: s.itemKey,
            question: s.question,
            answer: s.answer,
            note: s.note,
            recordedAt: s.recordedAt,
          })),
        }))}
      />

      <ProcedureSection
        companyId={ctx.company.id}
        medicalCaseId={medicalCase.id}
        canPlan={canPlanProcedure}
        canPerform={canPerformProcedure}
        procedures={procedures.map((p) => ({
          id: p.id,
          procedureType: p.procedureType,
          status: p.status,
          primaryClinician: p.primaryClinician
            ? { id: p.primaryClinician.id, displayName: p.primaryClinician.displayName }
            : null,
          catalogItem: p.catalogItem ? { id: p.catalogItem.id, name: p.catalogItem.name } : null,
          scheduledAt: p.scheduledAt,
          performedAt: p.performedAt,
          // Decimal -> number QUA BOUNDARY: RSC không serialize Decimal (bug
          // thật đã trả giá ở Phần 5) — Number() ở đây, KHÔNG ở client.
          materialUsages: p.materialUsages.map((m) => ({
            id: m.id,
            inventoryItemId: m.inventoryItemId,
            inventoryLocationId: m.inventoryLocationId,
            quantity: Number(m.quantity),
            status: m.status,
            inventoryItem: { id: m.inventoryItem.id, name: m.inventoryItem.name, unit: m.inventoryItem.unit },
            inventoryLocation: { id: m.inventoryLocation.id, name: m.inventoryLocation.name },
          })),
        }))}
      />

      <ConsentSection
        companyId={ctx.company.id}
        medicalCaseId={medicalCase.id}
        canManage={canManageConsent}
        consentTemplates={consentTemplates}
        consentRecords={consentRecords}
      />

      <PhotoFollowUpSection
        companyId={ctx.company.id}
        medicalCaseId={medicalCase.id}
        canManagePhoto={canManagePhoto}
        canManageFollowUp={canManageFollowUp}
        procedures={procedures.map((p) => ({ id: p.id, procedureType: p.procedureType }))}
        photos={photos}
        followUps={followUps}
      />
    </div>
  );
}
