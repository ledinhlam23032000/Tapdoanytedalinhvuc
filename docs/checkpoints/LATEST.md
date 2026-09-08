# Checkpoint — Phần 7 hoàn tất

(Checkpoint Phần 1-6 xem lịch sử git — commit "Part 1: ...", ..., "Part 6:
...". File này chỉ giữ checkpoint MỚI NHẤT.)

## PHASE 7 STATUS

**COMPLETE** — `PART_7_COMPLETE`, `READY_FOR_PART_8`. Healthcare Vertical
(MedicalCase → ClinicalConsultation/Screening → Procedure/vật tư →
ConsentRecord → ClinicalPhoto → MedicalFollowUp) implement thật trên nền
Customer/Appointment (Phần 5) + Inventory/ApprovalRequest (Phần 6) — schema
Prisma migrate được (10 migration tổng, 4 migration mới Phần 7), domain
service + Server Action + UI chạy được end-to-end qua browser thật, 159
integration test PASS (156 cũ + 3 concurrency regression mới), adversarial
code review **4 agent độc lập chạy SAU khi phần lớn code đã viết** (khác
Phần 3-6 review song song từng bước — ghi nhận là bài học cho Phần 8) tìm
**3 P0 race condition thật** + 3 P1 (2 concurrency, 1 rò PHI) + vài P2, đã
sửa hết và re-verify toàn bộ trước khi chốt checkpoint này (đúng tinh thần
"never fake PASS/DONE").

TARGET HEAD: xem commit ngay sau checkpoint này (`git log -1`).

## SCHEMA IMPLEMENTED (Phần 7)

`MedicalCase`, `HealthcareAppointmentContext`, `ClinicalConsultation`,
`ClinicalConsultationAddendum`, `ClinicalScreeningItem`, `Procedure`,
`ProcedureMaterialUsage`, `ConsentTemplate`, `ConsentRecord`, `ClinicalPhoto`,
`MedicalFollowUp`, `CompanyMembershipPack` (12 model, `prisma/schema.prisma`),
4 migration: `20260907103725_healthcare_vertical`,
`20260907104540_healthcare_permission_packs`,
`20260908062738_catalog_item_consultation_only_flag` (thêm
`CatalogItem.isConsultationOnly` — P0 fix chống lách policy qua text tự do,
migration này bị THIẾU khi review bắt đầu, tự phát hiện qua
`prisma migrate status` drift, đã tạo và áp dụng trước checkpoint). Verified
qua cả `prisma migrate dev` (local) và `prisma migrate deploy` (fresh-install
test trên DB trống riêng, xem mục FRESH DB TEST).

## KIẾN TRÚC QUYẾT ĐỊNH (ADR-036 → ADR-052, `docs/architecture/DECISIONS.md`)

- **ADR-036** — Healthcare là vertical phụ thuộc MỘT CHIỀU vào Core
  (`src/lib/domain/healthcare/`), Core không bao giờ import Healthcare.
- **ADR-037** — `Customer` là identity DUY NHẤT của bệnh nhân; không tạo
  `HealthcareProfile` khi chưa có use case thật.
- **ADR-038** — `companyId` NOT NULL trên MỌI entity Healthcare, cấm suy
  Company qua `Customer`.
- **ADR-039** — Bản ghi lâm sàng FINAL bất biến, sửa chỉ qua addendum.
- **ADR-040** — Không cascade delete vào lịch sử lâm sàng; archive thay xoá.
- **ADR-041** — File lâm sàng: metadata DB, binary ngoài DB, server-proxy có
  4 lớp kiểm tra, không signed URL ở Phần 7.
- **ADR-042** — `ConsentRecord` snapshot nội dung + version, có REVOKED.
- **ADR-043** — Vật tư thủ thuật qua `issueStock()` có sẵn, không engine
  kho thứ 2.
- **ADR-044** — Readiness deterministic qua hàm thuần, AI không quyết định.
- **ADR-045** — Không task engine thứ 2; follow-up dùng `WorkItem` có sẵn.
- **ADR-046 → ADR-051** — Vai trò chuyên môn qua `PermissionPack` (không
  phải role preset), module enablement là cổng độc lập, "chưa ghi nhận" ≠
  "ghi nhận là không", `MedicalCase` không có cột tổng tiền, Phần 7 không
  migrate dữ liệu thật.
- **ADR-052 (mới, viết trong review này)** — Dữ liệu lâm sàng KHÔNG dùng
  application-level field encryption riêng (khác `Customer.phoneCiphertext`)
  — bất biến CCXVIII của Master Prompt cấm tự phát minh cơ chế mã hoá riêng,
  yêu cầu dùng best-practice sẵn có của platform/DB/storage. Backlog bắt
  buộc trước `CUTOVER_APPROVAL_REQUIRED` (Phần 10): xác nhận managed
  Postgres/storage provider thật bật encryption-at-rest.

Chi tiết: `docs/domain/HEALTHCARE.md`.

## DOMAIN SERVICE + ACTION + UI

`src/lib/domain/healthcare/{medical-case,consultation,procedure,consent,
clinical-photo,followup,module}-service.ts` + `procedure-readiness.ts` (hàm
thuần). Server Actions: `healthcare-actions.ts` (27 action). UI:
`/c/[code]/healthcare` + `/[medicalCaseId]` (Consultation/Procedure/
Consent/Photo/FollowUp section) + `/settings` (module toggle + permission
pack), tab "Hồ sơ chuyên môn" tích hợp vào trang Customer. File upload ảnh
lâm sàng thật (`api/healthcare/photos/*`, local filesystem `.data/`,
ADR-041).

## PERMISSION MỞ RỘNG

18 permission key `healthcare.*` (78 tổng) + 4 `PermissionPack`
(`HEALTHCARE_RECEPTION/NURSE/DOCTOR/CARE`, ADR-051). `RESERVED_PERMISSION_PREFIXES`
giờ **rỗng** — Phần 7 gỡ nốt `"healthcare."`. Preset generic OWNER/ADMIN/
MANAGER chỉ có `healthcare.case.view`; quyền đọc nội dung lâm sàng
(`.consultation.view`/`.photo.view`/`.consent.view`/`.followup.view`) CHỈ
đến từ pack chuyên môn — đúng bất biến CXXXI (Founder/role Ecosystem-tier
không tự động đọc PHI).

## STATIC TESTS

`npx tsc --noEmit` 0 lỗi · `npx eslint .` 0 lỗi/cảnh báo · `npx next build`
PASS (35 route, thêm 5 route Phần 7).

## UNIT + INTEGRATION TESTS

`npm run test` — **79/79 PASS**. `npm run test:integration` — **159/159
PASS** (156 cũ + 3 mới `tenant-isolation-part7.itest.ts` mục "Concurrency —
race condition regression"): cross-company FK injection trên mọi FK mới,
bất biến FINAL/addendum/no-cascade, PHI permission gating (SOAP + `chiefComplaint`
+ route ảnh 4 lớp), reuse `issueStock`/không tạo approval thứ 2, và 3 test
concurrency bắn THẬT 2 lệnh song song vào cùng Postgres (`updateDraftConsultation`
vs `finalizeConsultation`, 2× `startProcedure`, 2× `recordFollowUpOutcome`).

## ADVERSARIAL CODE REVIEW (4 agent độc lập)

`docs/security/RED_TEAM_CODE_REVIEW_PART7.md`. Agent 1 (tenant-isolation):
0 P0/P1, vài P2 backlog. Agent 2 (PHI/privacy/permission): 1 P1 (rò
`chiefComplaint`) + 2 P2, đã sửa hết. Agent 3 (clinical immutability): SẠCH,
1 P2 backlog. Agent 4 (concurrency + spec-fidelity): **3 P0 xác nhận** + 2
P1 + 1 P2, đã sửa hết; nhiệm vụ reuse hoàn toàn sạch.

**3 P0 thật tìm thấy** (cùng root cause class với 4 P0 của Phần 6— thiếu
`SELECT...FOR UPDATE` cho check-then-write):
1. `consultation-service.ts` — `updateDraftConsultation`/`recordScreeningItem`
   đua với `finalizeConsultation`, có thể ghi đè nội dung bản đã FINAL.
2. `procedure-service.ts` — `startProcedure`/`cancelProcedure` đua với nhau
   và với `completeProcedure`, có thể để lại trạng thái mâu thuẫn.
3. `followup-service.ts` — `recordFollowUpOutcome` đua với chính nó, người
   commit sau ghi đè kết luận lâm sàng của người trước không dấu vết.

**P1/P2 khác đã sửa**: rò `MedicalCase.chiefComplaint` cho actor thiếu
`healthcare.consultation.view` (redact tại domain service); route upload
ảnh ghi file trước khi kiểm quyền (DoS, sửa: gate quyền trước side-effect);
`updateMedicalCase`/`reopenMedicalCase` thiếu lock; `reverseProcedureMaterial`
thiếu lock (Prisma P2002 thô thay vì lỗi thân thiện).

Không còn P0/P1 mở sau khi sửa. Chi tiết đầy đủ: xem file review.

## BUG THẬT PHÁT HIỆN NGOÀI REVIEW-CONTENT — schema/DB drift

`npx prisma migrate status` báo "up to date" nhưng `npm run test:integration`
thất bại thật với lỗi Postgres "column isConsultationOnly ... does not exist"
— `CatalogItem.isConsultationOnly` (P0 fix chống lách policy bằng text tự do
`procedureType`) đã có trong `schema.prisma` và code đã dùng, nhưng CHƯA
từng có migration SQL tương ứng. `migrate status` chỉ so khớp danh sách
migration đã áp dụng, không diff schema thật — không đủ để tin. Sửa:
`npx prisma migrate dev --name catalog_item_consultation_only_flag` tạo +
áp migration còn thiếu. Kéo theo: test suite (`tenant-isolation-part7.itest.ts`)
vẫn dùng cách CŨ (`procedureType: "consult"` match text) để đạt policy lỏng
— cập nhật sang tạo `CatalogItem` fixture với `isConsultationOnly: true` và
dùng `catalogItemId`, đúng hành vi MỚI. **Bài học**: sau khi sửa 1 lỗ hổng
bằng cách đổi cơ chế quyết định (text → cấu hình catalog), luôn chạy lại
FULL test suite trước khi tin "đã xong" — test cũ viết cho cơ chế cũ có thể
che giấu cả lỗ hổng cũ ĐÃ quay lại lẫn migration bị thiếu.

## BROWSER TEST (journey PHI redaction — trọng tâm nhất của review này)

Đăng nhập bác sĩ (`manager-demo`, pack HEALTHCARE_DOCTOR) → mở hồ sơ
"Trần Thị Mai" với Lý do khám "Đau đầu, mất ngủ 3 ngày, tiền sử dị ứng
penicillin" → tạo phiếu khám SOAP đầy đủ → Chốt phiếu (finalize, xác nhận
qua `preview_logs` thấy đúng `ƒ finalizeConsultationAction`) → đăng xuất,
đăng nhập Founder (OWNER, KHÔNG có pack lâm sàng) → mở lại đúng hồ sơ đó:
**"Lý do khám" biến mất hoàn toàn khỏi trang** (fix PHI redaction hoạt động
thật, không chỉ đúng trên code), section "Phiếu khám" hiện đúng "Chưa có
phiếu khám nào." dù case này thực có 1 phiếu FINAL — `getConsultationList`
trả `[]` đúng thiết kế khi thiếu `healthcare.consultation.view`.

## FRESH DB TEST

Tạo database trống riêng (`tapdoan_fresh_test_part7`) → `prisma migrate
deploy` áp toàn bộ 10 migration sạch (Phần 3-7, gồm cả migration
`isConsultationOnly` mới tạo) → `bootstrap-founder` chạy thành công → xoá DB
tạm. DB dev chính giữ nguyên dữ liệu browser-test; dọn rác 3 company test
(`p7-a/b/c-*`) sót lại từ lần chạy integration test trước khi migration
được sửa.

## SECURITY RISKS (còn mở, kế thừa Phần 3-6 + mới Phần 7, không phải HARD BLOCK)

1-5. (kế thừa Phần 6 — AuditEvent/LedgerEntry/StockMovement chưa có DB
   trigger, chưa có session revocation, `phoneHash` không salt.)
6. **Encryption-at-rest cho dữ liệu lâm sàng chưa bật ở môi trường dev/test**
   (ADR-052) — chấp nhận cho local/test, **bắt buộc xác nhận trước cutover
   Phần 10**.
7. File lâm sàng lưu local filesystem (`.data/clinical-photos/`), chưa có
   storage provider ngoài — kế thừa từ thiết kế ADR-041, đã ghi nhận đúng.
8. `HealthcareAppointmentContext` chưa có code path thực thi nào (P2,
   backlog) — khi triển khai phải áp đúng pattern guard 2 lớp.

## DEFERRED ITEMS

`HealthcareProfile`, `HealthcareProfessionalProfile`/chứng chỉ hành nghề,
patient portal, đặt lịch online, đơn thuốc điện tử, xét nghiệm, chẩn đoán
hình ảnh, nhà thuốc, nội trú, quản lý giường, bảo hiểm, EMR certification,
`MedicalFollowUpAddendum` (P2, chưa có use case thật xác nhận), signed URL
cho file lâm sàng (chờ storage provider thật), mọi mục deferred Phần 3-6.

## DO NOT REDO (bổ sung Phần 7, kế thừa toàn bộ danh sách Phần 3-6)

- Không tin `npx prisma migrate status` là bằng chứng schema đã đồng bộ —
  nó chỉ so khớp migration ĐÃ CHẠY, không diff schema thật với DB. Bằng
  chứng thật là chạy full test suite (integration) sau khi đổi schema.
- Không thêm field trên model rồi chỉ sửa code dùng field đó mà quên tạo +
  chạy `prisma migrate dev` — cả hai phải đi cùng một commit.
- Không cho rằng "1 hàm trong file đã có `SELECT...FOR UPDATE` đúng" nghĩa
  là các hàm chị-em khác cùng entity cũng an toàn — mỗi hàm ghi trạng thái
  phải tự được audit lock, không suy diễn từ hàm cạnh nó (root cause của cả
  3 P0 Phần 7: đúng 1 hàm/entity có lock, các hàm còn lại thì không).
- Không cho rằng "record đã qua permission check ở tầng list/detail" nghĩa
  là MỌI field trên record đó an toàn để trả về — field nhạy cảm hơn
  permission `.view` chính của model phải được redact riêng tại domain
  service (bài học `MedicalCase.chiefComplaint`).
- Không chạy adversarial review CHỈ SAU KHI toàn bộ code một Phần đã viết
  xong (như Phần 7 đã làm) — review nên chạy theo từng bước như Phần 3-6,
  để P0 được bắt sớm hơn thay vì dồn lại cuối, và để checkpoint không bị
  lỗi thời so với code thực tế trong lúc review đang diễn ra.
- Không dùng `procedureType`/bất kỳ trường TEXT TỰ DO nào actor tự gõ để
  quyết định policy/bất kỳ nhánh an toàn nào — luôn dùng cấu hình do vai
  trò quản trị đặt sẵn (`CatalogItem.isConsultationOnly`), TEXT tự do không
  bao giờ là input đáng tin cho quyết định an toàn.

## NEXT

Phần 8 — AI Runtime + Digital COO + Ecosystem AI + Company AI + Decision
Inbox + Safe Execution. Đọc đúng đoạn Master Prompt Phần 8 (pandoc + grep)
trước khi bắt đầu, theo đúng chu trình chuẩn.
