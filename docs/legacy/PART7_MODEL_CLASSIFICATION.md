# Phần 7 — Phân loại model legacy (mục VI: "Không classification → không migrate")

Nguồn: `C:\Users\PC\ZenithTasks` @ `e420e380` (khớp `legacySourceHead` trong
`PROJECT_STATE.json` — nguồn chưa đổi kể từ Phần 1). Schema:
`web/prisma/schema.prisma`, **72 model**.

7 nhóm bắt buộc (mục VI): `GENERIC CORE` · `HEALTHCARE VERTICAL` ·
`AESTHETICS SPECIALIZATION` · `LEGACY DUPLICATE` · `TECHNICAL INFRA` ·
`UNKNOWN` · `RETIRE`.

Cột **Trạng thái** = đã xác minh bằng cách đọc định nghĩa model thật chưa.
`CHƯA` nghĩa là phân loại dưới đây mới là *giả thuyết từ tên model* — phải
đọc `web/prisma/schema.prisma:<dòng>` trước khi dùng làm căn cứ cho ADR.
Nguyên tắc Phần 3-6 vẫn áp dụng: **mọi ADR phải neo vào bằng chứng đã grep
trực tiếp, không suy đoán từ tên.**

## Ứng viên HEALTHCARE VERTICAL (trọng tâm Phần 7)

| Model | Dòng | Ánh xạ dự kiến | Trạng thái |
|---|---|---|---|
| `CaseRecord` | 597 | `MedicalCase` (core vertical entity, mục XIV) | CHƯA |
| `ConsultationRecord` | 1154 | `Consultation` (mục XXVII) | CHƯA |
| `CaseService` | 646 | tách đôi: phần bán → `Sale`/`SaleLine` (đã làm Phần 5) + phần lâm sàng → `Procedure` (mục XXXV-XXXVI: SALE ≠ PROCEDURE) | CHƯA |
| `CaseConsent` | 940 | `Consent` (mục XLII-XLIII) | CHƯA |
| `ConsentTemplate` | 928 | `ConsentTemplate` + version (mục XLIV-XLV) | CHƯA |
| `Photo` | 704 | `ClinicalPhoto` (mục XLVIII-LI, có before/after pairing) | CHƯA |
| `MaterialUsage` | 687 | Healthcare Material Usage — **phải trừ kho qua `issueStock()` Phần 6**, không tạo engine kho thứ 2 | CHƯA |
| `FollowUp` | 719 | Clinical Follow-up — lưu ý Phần 5 đã merge `FollowUp` vào `Appointment` lifecycle; cần xác định phần lâm sàng còn lại | CHƯA |
| `CaseDocument` | 978 | hồ sơ đính kèm ca — có thể gộp `ClinicalPhoto` hoặc tách | CHƯA |

## Ứng viên GENERIC CORE (đã làm Phần 3-6 — KHÔNG làm lại)

`User`(247) · `Customer`(402) · `Lead`(464) · `Appointment`(489) ·
`Material`(538) · `StockMovement`(579) · `Payment`(674) ·
`CashTransaction`(902) · `PayrollEntry`(373) · `AuditLog`(864) ·
`Plan`(1247)/`PlanTask`(1265) · `Service`(525) → `CatalogItem`.
Mục X-XI đặc biệt: **Healthcare KHÔNG tạo Customer mới; Customer ≠ Patient
Record** — tái dùng `Customer` Phần 5, hồ sơ y tế là entity riêng gắn vào.

## Ứng viên LEGACY DUPLICATE (họ `Z*` — V2 song song)

`ZWorkspaceCustomer`(1728) · `ZWorkspaceAppointment`(1757) ·
`ZWorkspaceSale`(1780) · `ZWorkspaceLedgerEntry`(1805) ·
`ZWorkspacePayrollRun`(1856)/`Line`(1893) · `ZWorkspaceTask`(1916) · v.v.
Đã có Decision từ Phần 2-6 trong `LEGACY_TO_TARGET_MAP.md` — không quyết
định lại.

## Cần xác minh sớm (rủi ro cao nhất)

1. `CaseRecord`(597) — quan hệ với `Customer`/`Appointment`, có `caseNumber`
   không (mục XIX), status/type enum thật là gì (mục XVII-XVIII).
2. `ConsultationRecord`(1154) — có cơ chế bất biến/addendum chưa (mục
   XXIX-XXX), DRAFT vs FINAL (mục XXXI).
3. `CaseConsent`(940) + `ConsentTemplate`(928) — versioning + chữ ký số
   thật đang lưu thế nào (mục XLIV/XLVI/XLVII).
4. `Photo`(704) — lưu binary hay metadata + storage provider? (Phần 2 đã
   ghi nhận legacy làm ĐÚNG: metadata + provider, không nhét binary vào DB).
5. `CaseRevenueAllocation`(1031) — có trùng `CommissionCalculation` Phần 6
   không; nếu trùng thì là LEGACY DUPLICATE, không phải vertical.

## Quyết định lớn còn mở (cần ADR riêng, chưa được đoán)

- **Mã hoá tại rest cho dữ liệu lâm sàng** — `CURRENT_WAVE.md` đã ghi:
  KHÔNG mặc định "giống SĐT khách (ADR-023) là đủ". Dữ liệu y tế nhạy cảm
  hơn hẳn PII SĐT.
- **`ClinicalPhoto` lưu ở đâu** — binary không vào DB; cần quyết định
  storage provider + kiểm soát truy cập.
- **Bất biến hồ sơ lâm sàng** — mục XXIX yêu cầu immutable + addendum;
  giống `LedgerEntry` Phần 6 (ADR-027), cân nhắc tái dùng đúng pattern.
