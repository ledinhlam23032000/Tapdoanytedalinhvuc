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
| Bản ghi lâm sàng FINAL là bất biến, sửa chỉ qua addendum | ADR-039, `CONSULTATION.md` |
| Không cascade delete vào lịch sử lâm sàng (0 `ON DELETE CASCADE`) | ADR-040, đã verify trong migration SQL |
| "Chưa ghi nhận" ≠ "ghi nhận là không" | ADR-048, `ScreeningAnswer?` nullable |
| Consent có snapshot + version + REVOKED | ADR-042, `CONSENT.md` |
| Vật tư đi qua `issueStock()`, idempotent | ADR-043, `PROCEDURE.md` |
| Readiness deterministic, AI không quyết định | ADR-044, `procedure-readiness.ts` |
| Follow-up không phải task engine thứ hai | ADR-045 |
| Case không có cột tổng tiền | ADR-050 |

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

## Audit

Danh sách đóng, 29 action mới: `COMPANY_MODULE_ENABLED/DISABLED`,
`PERMISSION_PACK_GRANTED/REVOKED`, `MEDICAL_CASE_*`, `CONSULTATION_*`,
`SCREENING_RECORDED`, `PROCEDURE_*`, `CONSENT_*`, `CLINICAL_PHOTO_*`,
`MEDICAL_FOLLOWUP_*`. Mọi thao tác ghi lâm sàng đều sinh audit trong **cùng
transaction** với thao tác đó (bất biến #72/#126).
