# Current State

Cập nhật lần cuối: cuối Phần 7 (Healthcare Vertical — MedicalCase +
Consultation + Procedure + Consent + ClinicalPhoto + MedicalFollowUp).

## Stack (ADR-006 + Phần 3-7, không đổi)

Next.js 16.3.3 (App Router, Turbopack) + React 19.2.8 + TypeScript (strict) +
Tailwind CSS v4 + Prisma 7.9.1 (`@prisma/adapter-pg`, client generate ra
`src/generated/prisma`, cấu hình CLI ở `prisma.config.ts`) + PostgreSQL 16
(Docker, local dev port **5442**) + Vitest 4 (unit + integration 2 lane,
salvage convention ZenithTasks) + `jose` (JWT) + `bcryptjs` (password hash,
cost 12) + `tsx` (chạy script TypeScript như `bootstrap-founder.ts`) + Node
`crypto` (AES-256-GCM cho SĐT, Phần 5; **KHÔNG** dùng field-level cho dữ liệu
lâm sàng Phần 7 — xem ADR-052) + Node `fs/promises` (lưu file ảnh lâm sàng
local, `.data/clinical-photos/`, ADR-041 — chưa có storage provider ngoài).
Không đổi gì ở tầng dependency Phần 7 — đúng ADR-006.

## Lệnh quan trọng

```bash
docker compose up -d              # khởi động Postgres local (port 5442)
npm install                       # cài dependencies (tự chạy `prisma generate`)
npx prisma migrate dev            # tạo/áp migration mới khi đổi schema
npx prisma migrate status         # CHỈ báo migration đã chạy — KHÔNG đủ để tin schema/DB đồng bộ (bài học Phần 7)
npm run bootstrap:founder         # tạo Ecosystem + Founder đầu tiên (đọc env BOOTSTRAP_*)
npm run test                      # vitest unit (không cần DB) — 79/79
npm run test:integration          # vitest integration (*.itest.ts — CẦN Postgres thật) — 159/159
npx tsc --noEmit                  # typecheck
npx eslint .                      # lint
npx next build                    # build production (cũng sinh lại .next/types nếu bị xoá — cần thiết cho typed-route LayoutProps)
```

`.env` (không commit) cần `DATABASE_URL`, `AUTH_SECRET`
(`openssl rand -base64 48`), `PHONE_ENC_KEY` (32 byte base64, Phần 5), và
`BOOTSTRAP_FOUNDER_EMAIL`/`BOOTSTRAP_FOUNDER_PASSWORD`/
`BOOTSTRAP_ECOSYSTEM_CODE`/`BOOTSTRAP_ECOSYSTEM_NAME` (chỉ cần khi chạy
`bootstrap:founder`). Không có biến env mới ở Phần 7.

## Schema hiện tại (Phần 3-7, 10 migration tổng)

Phần 3 — `User`, `Ecosystem`, `EcosystemMembership`, `Company`,
`CompanyMembership`, `AuditEvent`. Phần 4 — `OrganizationUnit`, `Position`,
`Assignment`, `WorkItem`, `Project`, `ProjectMembership`. Phần 5 —
`CustomerSource`, `Lead`, `Customer`, `CustomerInteraction`, `Appointment`,
`CatalogItem`, `Sale`, `SaleLine`. Phần 6 — `Payment`, `Expense`,
`LedgerEntry`, `PayrollProfile`, `PayrollRun`, `PayrollItem`,
`ApprovalRequest`, `CommissionRule`, `CommissionCalculation`,
`InventoryLocation`, `InventoryItem`, `StockMovement`. Phần 7 (mới) —
`MedicalCase`, `HealthcareAppointmentContext`, `ClinicalConsultation`,
`ClinicalConsultationAddendum`, `ClinicalScreeningItem`, `Procedure`,
`ProcedureMaterialUsage`, `ConsentTemplate`, `ConsentRecord`, `ClinicalPhoto`,
`MedicalFollowUp`, `CompanyMembershipPack`. Migration Phần 7:
`20260907103725_healthcare_vertical`, `20260907104540_healthcare_permission_packs`,
`20260908062738_catalog_item_consultation_only_flag` (thêm
`CatalogItem.isConsultationOnly` — tạo muộn, sau khi phát hiện schema drift
khi review, xem CURRENT_WAVE/LATEST checkpoint).

## Đã implement thật (Phần 7)

- **Domain service:** `src/lib/domain/healthcare/{medical-case,consultation,
  procedure,consent,clinical-photo,followup,module}-service.ts` +
  `procedure-readiness.ts` (hàm thuần, DB-free). Mọi hàm ghi trạng thái đã có
  `SELECT...FOR UPDATE` + đọc lại trong transaction trước khi ghi (bài học
  Phần 6, áp dụng lại và review lại ở Phần 7 — xem mục Concurrency,
  `docs/domain/HEALTHCARE.md`).
- **Server Actions:** `healthcare-actions.ts` (27 action, thin wrapper).
- **UI:** `/c/[code]/healthcare` + `/[medicalCaseId]` (5 section: Consultation/
  Procedure/Consent/Photo/FollowUp) + `/settings` (module toggle + permission
  pack), tab "Hồ sơ chuyên môn" trên trang Customer, upload ảnh thật qua
  `api/healthcare/photos/*`.
- **Permission:** 18 key `healthcare.*` (78 tổng) + 4 `PermissionPack`.
  `RESERVED_PERMISSION_PREFIXES` giờ rỗng.
- **Docs:** `docs/domain/HEALTHCARE.md`; ADR-036 đến ADR-052.

## Đã verify (Phần 7)

- **Unit test:** 79/79 PASS.
- **Integration test:** 159/159 PASS (156 + 3 test concurrency mới
  `tenant-isolation-part7.itest.ts` mục "Concurrency — race condition
  regression"): cross-company FK injection, bất biến FINAL/addendum/
  no-cascade, PHI permission gating, 3 test bắn thật 2 lệnh song song vào
  cùng Postgres.
- **Anti-pattern search:** sạch.
- **Adversarial code review (4 agent độc lập, chạy SAU khi phần lớn code đã
  viết — khác Phần 3-6):** `docs/security/RED_TEAM_CODE_REVIEW_PART7.md`.
  **3 P0 thật** (cùng root cause Phần 6 — thiếu `SELECT...FOR UPDATE`):
  `updateDraftConsultation`/`recordScreeningItem` đua với `finalizeConsultation`;
  `startProcedure`/`cancelProcedure` đua với `completeProcedure`;
  `recordFollowUpOutcome` đua với chính nó. Cộng 2 P1 concurrency
  (`updateMedicalCase`, `closeMedicalFollowUp`/`updateFollowUpStatus`), 1 P1
  rò PHI (`MedicalCase.chiefComplaint` lộ cho actor thiếu
  `healthcare.consultation.view`), vài P2 (upload route ghi file trước khi
  kiểm quyền, Prisma P2002 thô). Không còn P0/P1 mở sau khi sửa.
- **Schema/DB drift phát hiện qua re-verify** (không phải review nội dung):
  `CatalogItem.isConsultationOnly` có trong `schema.prisma` + code dùng
  nhưng CHƯA có migration — `prisma migrate status` báo "up to date" một
  cách sai lệch. Đã tạo migration còn thiếu + cập nhật test suite đang dùng
  cách CŨ (text-matching `procedureType`) sang cách MỚI (`CatalogItem.isConsultationOnly`).
- **Browser journey thật (trọng tâm: PHI redaction):** bác sĩ tạo + chốt
  phiếu khám với "Lý do khám" nhạy cảm → Founder (không có pack lâm sàng) mở
  lại đúng hồ sơ: "Lý do khám" biến mất, "Phiếu khám" hiện đúng rỗng dù có
  1 phiếu FINAL thật.
- `npx tsc --noEmit`, `npx eslint .`, `npx next build` — sạch.
- **Fresh-install test:** DB trống riêng, `prisma migrate deploy` áp cả 10
  migration sạch, `bootstrap:founder` chạy thành công.

## Known issue / quyết định kỹ thuật đáng chú ý

- (kế thừa Phần 6 — `allowedDevOrigins`, `npm audit` 3 high từ Prisma CLI
  tooling, chưa DB trigger cho AuditEvent/LedgerEntry/StockMovement, mọi so
  sánh ngày dùng `getUTC*`, `beforeAll` fixture-bleed risk, `phoneHash`
  không salt.)
- **`npx prisma migrate status` "up to date" KHÔNG đủ bằng chứng schema/DB
  đồng bộ** — nó chỉ so migration đã chạy, không diff field thật. Luôn chạy
  lại full test suite sau khi đổi schema (bài học Phần 7).
- **Dữ liệu lâm sàng KHÔNG có field-level encryption riêng** (ADR-052,
  khác `Customer.phoneCiphertext`) — dựa vào platform/DB encryption-at-rest,
  bắt buộc xác nhận đã bật trước cutover Phần 10.
- **Field có thể nhạy cảm hơn permission `.view` của model cha** — luôn audit
  riêng từng field khi thêm entity mới, không suy an toàn từ việc record đã
  qua permission check (bài học `chiefComplaint`).
- **Mỗi hàm ghi trạng thái trên 1 entity phải tự có lock, không suy từ hàm
  cạnh nó** — cả 3 P0 Phần 7 đều là "1 hàm có `FOR UPDATE` đúng, hàm chị-em
  cùng entity thì không".

## KHÔNG có trong Phần 7 (đúng phạm vi)

`HealthcareProfile`, chứng chỉ hành nghề riêng, patient portal, đặt lịch
online, đơn thuốc điện tử, xét nghiệm, chẩn đoán hình ảnh, nhà thuốc, nội
trú, quản lý giường, bảo hiểm, EMR certification, signed URL cho file lâm
sàng (chờ storage provider thật), `MedicalFollowUpAddendum` (chưa có use
case thật), migrate dữ liệu lâm sàng thật (ADR-049, thuộc Phần 10), mọi mục
deferred Phần 3-6.
