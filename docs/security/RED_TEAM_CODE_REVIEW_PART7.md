# Red Team Code Review — Phần 7 (Healthcare Vertical)

4 agent độc lập, mỗi agent một góc nhìn (Healthcare là domain nhạy cảm nhất
hệ thống — dữ liệu y tế + pháp lý, cùng mức rủi ro với Phần 6 tiền/kho).

## Agent 1 — Tenant isolation (cross-company FK injection)

**Không P0/P1.** Toàn bộ FK actor-truyền (`medicalCaseId`, `consultationId`,
`procedureId`, `consentTemplateId`, `consentRecordId`, `clinicalPhotoId`,
`followUpId`, `primaryClinicianUserId`, `inventoryItemId/LocationId`,
`saleLineId`, `workItemId`, `signedByCustomerId`) đều qua đúng
`assertSameCompanyX`, đọc `companyId` thẳng từ entity (ADR-038).

P2 (backlog, không phải lỗ hổng):
- `HealthcareAppointmentContext` chưa có domain service/action nào đọc/ghi
  bảng này — vô hại vì không ai gọi tới, nhưng khi triển khai phải áp đúng
  pattern 2 lớp (`assertSameCompanyAppointment` + `assertSameCompanyMedicalCase`
  + verify `appointment.companyId === medicalCase.companyId`).
- Thiếu regression test cho 2 P0/P1 cross-company đã tự phát hiện và sửa
  TRƯỚC review này (`primaryClinicianUserId` injection ở `planProcedure`/
  `createMedicalCase`/`updateMedicalCase`; tự gán `PermissionPack` cho chính
  mình ở `grantPermissionPack`) — fix đúng trong code, nhưng không có test
  nào bắt regression nếu ai đó vô tình xoá guard sau này.
- Zero test coverage cho `clinical-photo-service.ts` và `followup-service.ts`
  ở khía cạnh cross-company (guard đúng, chỉ thiếu test).
- Guard logic trùng lặp rải rác thay vì factor vào `scope-guards.ts`
  (`assertSameCompanyWorkItem` viết riêng trong `followup-service.ts`; 2 hàm
  gần trùng `assertActiveCompanyMember`/`assertActiveMemberOfCompany`).

## Agent 2 — PHI / Privacy / Permission gating

**1 P1 tìm thấy và đã sửa:** `MedicalCase.chiefComplaint` lộ cho actor chỉ có
`healthcare.case.view` (preset generic OWNER/ADMIN/MANAGER, pack RECEPTION)
dù họ cố tình không có `healthcare.consultation.view`. Sửa: redact tại nguồn
trong `medical-case-service.ts` (xem `docs/domain/HEALTHCARE.md` mục "PHI
redaction"). **Verify lại bằng browser thật** (actor Founder/OWNER không có
pack lâm sàng): case list/detail không còn hiện "Lý do khám", section "Phiếu
khám" hiện đúng "Chưa có phiếu khám nào." dù case đó thực có 1 phiếu FINAL.

2 P2 đã sửa:
- Route upload ảnh (`api/healthcare/photos/route.ts`) ghi file xuống đĩa
  TRƯỚC KHI kiểm quyền — vector DoS/tốn đĩa. Sửa: tách
  `authorizeClinicalPhotoUpload` (permission + module + case-scope, không
  ghi gì) gọi TRƯỚC `writeFile`.
- Thiếu test integration cho nhánh Ecosystem-tier (FOUNDER/ECOSYSTEM_ADMIN
  không membership) — code đúng (`company-context.ts` không bao giờ trả
  `healthcare.*` cho "Đường 2"), chỉ thiếu test xác nhận trực tiếp.

Đã kiểm và SẠCH (không bịa finding): SOAP content gate đúng 2 lớp (domain +
page assembly không fetch trước khi ẩn); route ảnh đủ 4 lớp check mỗi
request, không signed URL, không đường tắt; PHI không lọt `console.log`/audit
log kỹ thuật (`answered: boolean` thay vì `answer` thật, `outcomeLength` thay
vì nội dung); không cache nào gộp PHI giữa actor/Company.

## Agent 3 — Clinical record immutability (ADR-039/040/042)

**SẠCH — không P0/P1.** `updateDraftConsultation`/`recordScreeningItem` chặn
đúng khi FINAL; không có code path hard-delete nào cho `ClinicalConsultation`;
`clinicianUserId` không bị ghi đè ở update (khác bug legacy
`ho-so/actions.ts:178-189`). `grep onDelete` trên `schema.prisma`: 0
`Cascade` thật trong toàn bộ khối Healthcare. `ConsentRecord` snapshot đúng
tại thời điểm tạo, sửa template sau không đổi ngược bản đã ký.

1 P2 (backlog): `MedicalFollowUp.clinicalOutcome` không có đường
addendum/đính chính khi ghi sai (khác `ClinicalConsultation` có addendum) —
không vi phạm câu chữ ADR-039 (chỉ nêu đích danh Consultation) nhưng lệch
triết lý chung. Đề xuất: `MedicalFollowUpAddendum` hoặc `amendFollowUpOutcome`
nếu có nhu cầu nghiệp vụ thật xác nhận.

## Agent 4 — Concurrency + spec-fidelity/reuse

**3 cụm P0 thật tìm thấy và đã sửa** (cùng root cause class với 4 P0 của
Phần 6 — thiếu `SELECT...FOR UPDATE` cho check-then-write):

1. `consultation-service.ts` — `updateDraftConsultation`/`recordScreeningItem`
   đua với `finalizeConsultation`, có thể ghi đè nội dung một bản ghi vừa
   FINAL. Sửa: lock + re-check `status` trong transaction, cùng khuôn
   `finalizeConsultation`.
2. `procedure-service.ts` — `startProcedure`/`cancelProcedure` đua với nhau
   và với `completeProcedure`, có thể để lại trạng thái mâu thuẫn (CANCELLED
   sau khi đã trừ kho, hoặc "hồi sinh" một thủ thuật vừa huỷ mà không
   re-check readiness). Sửa cùng khuôn.
3. `followup-service.ts` — `recordFollowUpOutcome` đua với chính nó (2
   clinician cùng ghi kết luận, người sau ghi đè người trước không dấu vết).
   Sửa cùng khuôn; mở rộng thêm cho `closeMedicalFollowUp`/
   `updateFollowUpStatus` (P1, file này hoàn toàn chưa có lock nào).

2 P1 khác đã sửa: `medical-case-service.ts` — `updateMedicalCase` đua với
`closeMedicalCase` (có thể sửa case đã đóng hoặc "mở lại" case ngầm bỏ qua
`reopenMedicalCase`); `reopenMedicalCase` thiếu lock (tác động thấp, sửa cho
nhất quán).

1 P2 đã sửa: `reverseProcedureMaterial` — hai request hoàn trả đồng thời cho
cùng usage được `@@unique([companyId, idempotencyKey])` chặn double-credit
thật, nhưng người thua nhận lỗi Prisma P2002 thô. Sửa: lock + re-check
`status` trước khi gọi `reverseStockIssueTx`.

Regression test: `tenant-isolation-part7.itest.ts` mục "Concurrency — race
condition regression (P0 fix, Phần 7)" — bắn THẬT 2 lệnh song song vào cùng
Postgres instance cho cả 3 cụm P0 chính, `Promise.allSettled` xác nhận đúng 1
trong 2 thành công.

Nhiệm vụ 2 (spec-fidelity/reuse) — **hoàn toàn sạch**: `ProcedureMaterialUsage`
dùng `issueStockTx`/`reverseStockIssueTx` có sẵn, không tự chế `StockMovement`;
không có model duyệt-2-người thứ hai (Healthcare không có tình huống nào
trong spec cần 2-người-duyệt — dùng addendum/archive/revoke thay, đúng ADR-039/
040, không phải bị bỏ sót); không model nào định nghĩa lại capability Core
(ADR-036 giữ nguyên, không import ngược).

## Tổng kết

3 P0 + 3 P1 + 1 P1(PHI) + vài P2 — tất cả đã sửa và re-verify bằng
`npx tsc --noEmit` / `npx eslint .` / `npm run test` / `npm run test:integration`
/ `npx next build` sạch, cộng browser journey thật xác nhận PHI redaction, và
fresh-install test trên DB trống (10 migration, `bootstrap-founder` thành
công). Không còn P0/P1 mở.

Ghi nhận quy trình: review này chạy SAU khi phần lớn code Phần 7 đã viết
(không phải song song từng bước như Phần 3-6) — bài học cho Phần 8: adversarial
review phải là một checkpoint bắt buộc trước khi coi bất kỳ domain nào "xong",
không phải bước tuỳ nghi cuối cùng.
