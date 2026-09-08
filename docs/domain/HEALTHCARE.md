# Healthcare Vertical (Phần 7 — tổng quan)

Phần 7 đưa nghiệp vụ phòng khám của ZenithTasks trở lại, nhưng **là một
vertical có biên giới rõ ràng chạy TRÊN core Phần 3-6**, không phải cả ứng
dụng. Chuỗi domain: `Customer` (Phần 5) → `MedicalCase` → `ClinicalConsultation`
(+ screening) → `Procedure` (+ vật tư) → `ConsentRecord` → `ClinicalPhoto` →
`MedicalFollowUp` → `WorkItem` (Phần 4).

Nguyên tắc gốc của Phần 7 (mục V Master Prompt): **functional parity YES,
architectural parity NO** — giữ nguyên giá trị nghiệp vụ, không giữ lại kiến
trúc.

## Chiều phụ thuộc — một chiều, không vòng (ADR-036)

```
Core (Phần 3-6)  ←  Healthcare (Phần 7)
```

Healthcare được import Core. **Core tuyệt đối không import Healthcare.** Code
nằm trong `src/lib/domain/healthcare/`. Không tồn tại `ClinicCustomer`,
`MedicalAppointment`, `ClinicPayment`, `ClinicPayroll`, `ClinicInventory`,
`ClinicTask` — mọi capability đó đã có ở core và Healthcare chỉ tham chiếu.

Điểm thiết kế đáng chú ý: `HealthcareAppointmentContext` treo **bên cạnh**
`Appointment` (Appointment không có FK trỏ sang Healthcare) — nhờ vậy vẫn đạt
quan hệ Case 1-N Appointment mà không phá chiều phụ thuộc.

## Ownership

Mọi entity Phần 7 thuộc `Company`, `companyId` NOT NULL, scoping đọc **thẳng
từ chính entity đó**. Cấm suy Company qua `customerId → Customer.companyId`
(ADR-038). `MedicalCase` không bao giờ scope theo `Project`.

Bối cảnh khảo cổ: **không một model legacy nào có tenant scoping** — cả 4
agent khảo cổ độc lập đều xác nhận. Toàn bộ phân quyền phòng khám cũ nằm ở
tầng ứng dụng (`requireCap`, `hasCaseAccess`), DB không ràng buộc gì.

## Hai cổng độc lập cho mọi thao tác

1. **Permission** — `healthcare.*` (ADR-046), đến từ `rolePreset` **cộng**
   permission pack gắn theo membership (ADR-051).
2. **Module enablement** — `assertHealthcareModuleEnabled(companyId)`
   (ADR-047). Company chưa bật phân hệ thì bị từ chối kể cả khi có quyền, và
   bị chặn ở cả navigation lẫn direct route.

Có quyền mà chưa bật module → từ chối. Bật module mà không có quyền → từ
chối. Hai cổng không thay thế nhau.

## Bất biến xuyên suốt

| Bất biến | Ở đâu |
|---|---|
| Bản ghi lâm sàng FINAL là bất biến, sửa chỉ qua addendum | ADR-039, `consultation-service.ts` |
| Không cascade delete vào lịch sử lâm sàng (0 `ON DELETE CASCADE`) | ADR-040, đã verify trong migration SQL |
| "Chưa ghi nhận" ≠ "ghi nhận là không" | ADR-048, `ScreeningAnswer?` nullable |
| Consent có snapshot + version + REVOKED | ADR-042, `consent-service.ts` |
| Vật tư đi qua `issueStock()`, idempotent | ADR-043, `procedure-service.ts` |
| Readiness deterministic, AI không quyết định | ADR-044, `procedure-readiness.ts` |
| Follow-up không phải task engine thứ hai | ADR-045 |
| Case không có cột tổng tiền | ADR-050 |
| Dữ liệu lâm sàng KHÔNG mã hoá field-level riêng, dựa platform/DB encryption-at-rest | ADR-052 |

## Customer ≠ Patient record (ADR-037)

`Customer` là identity **duy nhất** của bệnh nhân. Không có bảng identity thứ
hai, không có danh bạ bệnh nhân riêng. Tạo `Customer` **không** tự sinh
`MedicalCase`.

Bằng chứng vì sao điều này quan trọng: legacy làm đúng điều bị cấm —
`tiep-nhan/actions.ts:108-119` tự tạo một `CaseRecord` nháp cho **mọi** khách
vừa tiếp nhận, khiến số hồ sơ không phản ánh số ca điều trị thật. Khi migrate
(Phần 10), tiêu chí lọc phải dựa trên "có `CaseService`/`Payment` thật".

`HealthcareProfile` **chưa được tạo ở Phần 7** — chưa có use case chứng minh
cần dữ liệu y tế ổn định xuyên suốt mọi Case tách khỏi `Customer`.

## Không có trong Phần 7 (đã kiểm tra, không phải bỏ sót)

- Dữ liệu lâm sàng thật **không được migrate** ở Phần 7 (ADR-049) — chỉ
  fixture synthetic. Migration thật thuộc Phần 10.
- `HealthcareProfessionalProfile` / lưu số chứng chỉ hành nghề — defer, chưa
  có yêu cầu nghiệp vụ đã xác minh (ADR-046).
- Patient portal, đặt lịch online, đơn thuốc điện tử, xét nghiệm, chẩn đoán
  hình ảnh, nhà thuốc, nội trú, quản lý giường, bảo hiểm, chứng nhận EMR —
  spec đánh dấu defer tường minh.
- Event sourcing / Kafka / form builder động — spec cấm tường minh.

## Concurrency — cùng bài học Phần 6, áp dụng lại (và review lại) ở Phần 7

Mọi hàm "đọc trạng thái rồi ghi" trên entity Healthcare khoá dòng bằng
`SELECT...FOR UPDATE` + đọc lại `fresh` bên trong `db.$transaction` trước khi
ghi. Adversarial review sau checkpoint Phần 6 (không phải lúc code lần đầu)
tìm ra **3 cụm P0 thật** nơi mẫu này bị thiếu ở các hàm chị-em cùng entity với
hàm đã có lock đúng — `finalizeConsultation` có lock nhưng
`updateDraftConsultation`/`recordScreeningItem` thì không (có thể ghi đè nội
dung một bản ghi vừa FINAL); `completeProcedure` có lock nhưng
`startProcedure`/`cancelProcedure` thì không; `recordFollowUpOutcome`/
`closeMedicalFollowUp`/`updateFollowUpStatus` hoàn toàn không có lock. Đã sửa
cả 3 cụm + `updateMedicalCase`/`reopenMedicalCase`/`reverseProcedureMaterial`
(P1/P2 cùng root cause). Regression test bắn THẬT 2 lệnh song song vào cùng
Postgres: `tenant-isolation-part7.itest.ts` mục "Concurrency — race condition
regression". **Bài học rút ra**: "áp dụng pattern ở 1 hàm" không tự động lan
sang các hàm khác cùng entity — mỗi hàm ghi phải tự kiểm tra, không suy diễn
từ hàm cạnh nó.

## PHI redaction — field liền kề cũng phải gate, không chỉ bảng chính

`MedicalCase.chiefComplaint` là nội dung lâm sàng thật (lý do khám), cùng
nhóm nhạy cảm với SOAP của `ClinicalConsultation` (ADR-052) — nhưng nằm trên
model mà preset generic OWNER/ADMIN/MANAGER và pack RECEPTION đều có quyền
`healthcare.case.view`. Review tìm ra field này lộ nguyên vẹn qua
`getMedicalCaseList`/`getMedicalCaseDetail` cho các actor đó dù họ cố tình
không được cấp `healthcare.consultation.view`. Đã sửa: `redactChiefComplaint`
trong `medical-case-service.ts` set về `null` khi actor thiếu quyền đọc nội
dung lâm sàng — sửa tại nguồn (domain service), không phải ở từng nơi gọi.

## Audit

Danh sách đóng, 29 action mới: `COMPANY_MODULE_ENABLED/DISABLED`,
`PERMISSION_PACK_GRANTED/REVOKED`, `MEDICAL_CASE_*`, `CONSULTATION_*`,
`SCREENING_RECORDED`, `PROCEDURE_*`, `CONSENT_*`, `CLINICAL_PHOTO_*`,
`MEDICAL_FOLLOWUP_*`. Mọi thao tác ghi lâm sàng đều sinh audit trong **cùng
transaction** với thao tác đó (bất biến #72/#126).
