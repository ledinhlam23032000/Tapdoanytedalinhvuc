# Checkpoint — Phần 5 hoàn tất

(Checkpoint Phần 1-4 xem lịch sử git — `git log --oneline` — commit "Part
1: ...", ..., "Part 4: ...". File này chỉ giữ checkpoint MỚI NHẤT.)

## PHASE 5 STATUS

**COMPLETE** — `PART_5_COMPLETE`, `READY_FOR_PART_6`. CRM + Sales +
Appointment + Customer Operations implement thật trên nền authorization
Phần 3 + Work Core Phần 4 (không viết lại 2 nền đó) — schema Prisma migrate
được, domain service + Server Action + UI chạy được end-to-end qua browser
thật với 3 journey bắt buộc (Reception/Sales, Sales transaction, Follow-up
No-show), 99 integration test PASS (53 cũ + 46 mới), adversarial code
review 3 agent độc lập tìm **2 P1 thật** (tính tiền sai, PII over-fetch) +
nhiều P2 (đã sửa hết), và **1 P2 thật thứ 3 phát hiện trong lúc browser-test
sau review** (Decimal object lọt qua Server Action boundary — đã sửa).

TARGET HEAD: xem commit ngay sau checkpoint này (`git log -1`).

## SCHEMA IMPLEMENTED (mới ở Phần 5)

`CustomerSource`, `Lead`, `Customer`, `CustomerInteraction`, `Appointment`,
`CatalogItem`, `Sale`, `SaleLine` (`prisma/schema.prisma`, migration
`20260830124601_crm_sales_appointment_customer_operations`, sau migration
Phần 4 `20260830092334_organization_work_project_foundation`). `WorkItem`
(Phần 4) mở rộng 2 field optional `customerId`/`appointmentId` — KHÔNG tạo
engine việc thứ 2 (ADR-014 vẫn áp dụng nguyên vẹn). Verified qua cả `prisma
migrate dev` (local) và `prisma migrate deploy` (fresh-install test trên DB
trống riêng).

## KIẾN TRÚC QUYẾT ĐỊNH (ADR-017 → ADR-023, `docs/architecture/DECISIONS.md`)

- **ADR-017** — Lead là entity thật tách biệt khỏi Customer (bằng chứng:
  `LEGACY_CAPABILITY_MATRIX.md` dòng L-C04), không gộp chung 1 model với
  status field.
- **ADR-018** — `Customer` optional trên `Appointment`/`Sale` ở mọi tầng
  (schema/domain/UI) — hỗ trợ khách vãng lai ("Khách lẻ") không bắt buộc
  tạo hồ sơ Customer trước.
- **ADR-019** — KHÔNG xây Sales Opportunity/Pipeline riêng (0 evidence
  trong ZenithTasks, Lead→Customer→Sale trực tiếp là đủ cho MVP).
- **ADR-020** — KHÔNG xây Customer Merge (trùng lặp xử lý qua cảnh báo
  duplicate lúc tạo, không xây workflow gộp record).
- **ADR-021** — `SaleLine.discountAmount` là số phẳng caller nhập trực
  tiếp, KHÔNG port rule engine `ZMechanismDefinition`/`ZMechanismVersion`
  của ZenithTasks (xác nhận qua archaeology: DRAFT-only, chưa từng chạy
  production thật).
- **ADR-022** — Customer/Lead/Appointment/Sale visibility là **Company-wide
  cho bất kỳ ai có permission `.view` tương ứng** — KHÁC HẲN WorkItem's
  2-tier SELF/COMPANY của ADR-015 Phần 4. `ownerUserId`/`assignedUserId`
  không tự nó là ranh giới bảo mật, permission mới là ranh giới. (Bản nháp
  đầu tiên của ADR này copy nhầm pattern SELF-scope của WorkItem — tự phát
  hiện và sửa lại theo đúng mục CLVI của Master Prompt TRƯỚC khi viết bất kỳ
  dòng code nào — xem log phiên.)
- **ADR-023** — SĐT mã hoá tại chỗ (AES-256-GCM) + hash tra cứu (SHA-256,
  không salt — rủi ro chấp nhận được ghi rõ), KHÔNG có UI "ẩn mặc định + lộ
  có audit" như ZenithTasks — `customer.view` + Company scope được coi là
  đủ kiểm soát truy cập cho Phần 5 MVP.

Chi tiết implementation + invariant giữ nguyên: `docs/domain/CRM.md`,
`CUSTOMER.md`, `LEAD.md`, `APPOINTMENT.md`, `SALES.md` (đọc trước khi sửa
domain này — đặc biệt phần đối chiếu ADR-022 với ADR-015).

## DOMAIN SERVICE + ACTION + UI

`src/lib/crypto/phone.ts` (mã hoá/giải mã/hash SĐT, unit test riêng),
`src/lib/domain/sale-totals.ts` (tính tiền Sale thuần, DB-free, unit test
riêng — nơi xảy ra P1 tiền, xem dưới), `appointment-conflict.ts` (check
trùng lịch thuần), `customer-service.ts`, `lead-service.ts`,
`appointment-service.ts`, `sales-service.ts` (Catalog + Sale), `scope-guards.ts`
mở rộng 5 assert mới. `work-service.ts` (Phần 4) mở rộng
`getOpenWorkForCustomer`/`hasOpenWorkItemForAppointment` (idempotency check
cho follow-up No-show). Server Actions: `customer-actions.ts`,
`lead-actions.ts`, `appointment-actions.ts`, `sales-actions.ts` — thin
wrapper, cùng pattern `organization-actions.ts` Phần 4 (riêng
`sales-actions.ts` có 1 khác biệt quan trọng — xem P2 Decimal bên dưới).
UI: `/c/[code]/{customers,customers/leads,appointments,sales,sales/catalog}`
+ trang chi tiết từng entity, nav cập nhật ở `company-nav.tsx` (chỉ 3
top-level item mới: Khách hàng/Lịch hẹn/Kinh doanh — đúng navigation budget
mục CXCVII, Lead/Catalog chỉ có link phụ), `today/page.tsx` tích hợp thêm
"Lịch hẹn hôm nay" (`getMyAppointmentsToday` — ngoại lệ cố ý duy nhất của
ADR-022, tự-scope giống WorkItem vì đây là view cá nhân "của tôi hôm nay").

## PERMISSION MỞ RỘNG

`customer.view/create/update/archive/assign/interaction.create`,
`lead.view/create/assign/convert`, `appointment.view/create/update/manage`,
`sales.view/create/update/confirm/cancel`, `catalog.view/manage`
(`src/lib/permissions/registry.ts`+`presets.ts`). Gỡ `"customer."` khỏi
`RESERVED_PERMISSION_PREFIXES` (chỉ còn `finance.`/`payroll.`/
`healthcare.`). `sales.manage` bị loại bỏ sau review — dead permission
(Sale không có `canActOnX`-theo-ownership để override như
Appointment/WorkItem, vì ADR-022 đã bỏ self-scope). `READ_ONLY_PERMISSIONS`
(`company-context.ts`) mở rộng đúng 5 permission `.view` mới — không lặp
lại P1 Suspended-Company của Phần 4.

## STATIC TESTS

`npx tsc --noEmit` 0 lỗi · `npx eslint .` 0 lỗi/cảnh báo · `npx next build`
PASS (19 route, thêm 9 route Phần 5: `/c/[code]/appointments`,
`/c/[code]/appointments/[appointmentId]`, `/c/[code]/customers`,
`/c/[code]/customers/[customerId]`, `/c/[code]/customers/leads`,
`/c/[code]/customers/leads/[leadId]`, `/c/[code]/sales`,
`/c/[code]/sales/[saleId]`, `/c/[code]/sales/catalog`).

## UNIT + INTEGRATION TESTS

`npm run test` — **44/44 PASS** (21 cũ + 9 `phone.test.ts` + 6
`sale-totals.test.ts` + 5 `appointment-conflict.test.ts`, bao gồm 2 test hồi
quy cho P1 tiền — xem dưới). `npm run test:integration` — **99/99 PASS** (53
cũ + 46 mới `tenant-isolation-part5.itest.ts`): cross-company FK injection
trên mọi FK mới (Lead/Customer/Interaction/Appointment/Sale/SaleLine/
organizationUnitId/`WorkItem.customerId`+`appointmentId`), duplicate-detection
Customer, ADR-022 Company-wide visibility (test dương tính rõ ràng: MemberA
thấy được record của ManagerA), Lead conversion dedup/reuse/atomicity,
Appointment conflict detection, No-show idempotent follow-up Work creation,
Sale money/lifecycle integrity, Suspended-Company chặn ghi ở cả 4 domain
mới, phone-encryption-at-rest (ciphertext không chứa plaintext, round-trip
đúng qua `getCustomerDetail`).

## ADVERSARIAL CODE REVIEW (3 agent độc lập)

`docs/security/RED_TEAM_CODE_REVIEW_PART5.md`. Agent 1 (tenant-isolation
attacker, 8 câu hỏi): NONE khai thác được. Agent 2 (simplicity/spec-fidelity,
11 câu hỏi): NONE — toàn bộ 7 ADR đối chiếu đúng code thật, 2 P2 nhỏ. Agent
3 (money/PII integrity — mới, riêng cho Phần 5 vì rủi ro tiền+PII không tồn
tại ở Phần 4, 12 câu hỏi): **tìm 2 P1 thật**.

1. **P1 Money** — `calculateSaleTotals` (cũ) cộng dồn `discountAmount` THÔ
   từng dòng rồi mới clamp 1 lần ở cấp Sale, trong khi `buildLineTotals`
   viết tay clamp riêng từng dòng → khi 1 dòng chiết khấu vượt chính giá
   trị dòng đó, `Sale.totalAmount` lệch với `sum(SaleLine.lineTotal)` (repro
   cụ thể: 60.000đ vs 100.000đ thật). Đã sửa: `calculateSaleTotals` tính lại
   để bất biến `subtotalAmount - discountAmount === totalAmount ===
   sum(lineTotal)` đúng bằng cấu trúc; `buildLineTotals` gọi thẳng
   `calculateLineTotal` đã unit-test thay vì công thức tay (root cause thật).
2. **P1 PII** — `phoneCiphertext`/`phoneHash` bị over-fetch ra khỏi tầng
   service ở mọi list/detail query KHÔNG phải `getCustomerDetail`/
   `getLeadDetail` (6 vị trí). Chưa leak ra browser thật nhưng `phoneHash`
   không salt trên keyspace nhỏ (SĐT VN) = gần tương đương lộ SĐT nếu rò rỉ
   dù 1 lần. Đã sửa bằng Prisma `omit` ở cả top-level và nested `include`.

Không còn P0/P1 mở sau khi sửa. Chi tiết đầy đủ + toàn bộ P2 đã sửa/chấp
nhận: xem file review.

## BUG THẬT THỨ 3 — PHÁT HIỆN QUA BROWSER TEST SAU REVIEW (không phải Phần 5
review tìm ra, review đã PASS trước đó)

Lúc browser-verify Journey 2 (Sales), click "Xác nhận" trên `SaleActions`
(Client Component) không có phản ứng — console log lộ nguyên nhân thật:
`confirmSaleAction`/`cancelSaleAction` (`sales-actions.ts`) trả thẳng object
Prisma Sale (chứa field `Decimal` — class instance, không phải plain
object) qua boundary Server Action → Client Component. Next.js RSC không
serialize được `Decimal`, log lỗi "Only plain objects can be passed..." mỗi
lần gọi — không chặn hẳn action (Sale vẫn confirm/cancel đúng trong DB) vì
chỉ là dev-mode console.error, nhưng đây là hành vi mong manh thật, có thể
vỡ khác đi ở production build. **Đã sửa**: 6 hàm trong `sales-actions.ts`
không còn trả nguyên object Prisma — chỉ trả phần dữ liệu client thực sự
cần (`createSaleAction` trả `{ id }` vì `create-sale-form.tsx` cần redirect;
5 hàm còn lại (`createCatalogItemAction`/`updateCatalogItemAction`/
`updateDraftSaleAction`/`confirmSaleAction`/`cancelSaleAction`) không trả gì
vì không caller nào dùng giá trị trả về — xác nhận bằng grep toàn bộ
`src/app`). Re-verify: tạo/xác nhận/huỷ 1 Sale test mới sau khi sửa, 0
console error. `npx tsc`/`npx eslint`/`npm run test`/`npm run
test:integration`/`npx next build` chạy lại toàn bộ sau sửa, đều PASS.

## BROWSER TESTS (3 journey bắt buộc, Manager persona)

**Journey 1 — Reception/Sales (mục CLXXXVIII):** Tạo Customer "Trần Thị
Mai" (SĐT `0912345678`) → chuyển tới trang chi tiết, SĐT giải mã hiển thị
đúng plaintext (xác nhận round-trip AES-256-GCM thật, không chỉ unit test)
→ "Tạo lịch hẹn" quick-action mang theo `customerId` → tạo Appointment → xuất
hiện đúng trong danh sách Lịch hẹn → xuất hiện đúng trong "Hôm nay" phần
"Lịch hẹn hôm nay" (tích hợp Today/Appointment thật, mục CVII/CLXXXVI).

**Journey 2 — Sales (mục CLXXXIX):** Từ Customer → "Tạo giao dịch" mang
theo `customerId` → thêm dòng hàng tự nhập ("Khám tổng quát", 500.000đ) →
Tạo giao dịch (redirect đúng sang trang chi tiết Sale) → Xác nhận (DRAFT →
CONFIRMED, đúng tiền, đúng timestamp) → quay lại Customer detail, mục "Giao
dịch" hiển thị đúng Sale vừa xác nhận. (Đây là journey phát hiện bug Decimal
ở trên — sửa xong mới coi là hoàn tất, không fake PASS.)

**Journey 3 — Follow-up (mục CXC):** Appointment (Journey 1) → "Không đến"
(No-show) → follow-up WorkItem tự động xuất hiện trong "Việc của tôi hôm
nay" ("Theo dõi khách không đến hẹn: ...", ưu tiên Cao) → Bắt đầu → Hoàn
thành → biến mất khỏi danh sách việc mở (đúng vòng đời WorkItem Phần 4,
xác nhận tích hợp CRM↔Work Core hoạt động thật end-to-end qua UI thật).

## FRESH DB TEST

Tạo database trống riêng → `prisma migrate deploy` áp toàn bộ 3 migration
sạch (Phần 3+4+5) → `bootstrap-founder` chạy thành công → xoá DB tạm. DB dev
chính giữ nguyên dữ liệu browser-test Phần 4+5 (Founder + Company + demo
user + Assignment + Project + Customer/Appointment/Sale mẫu) — hữu ích cho
Phần 6 (Finance cần Sale đã CONFIRMED để test công nợ/thanh toán).

## SECURITY RISKS (còn mở, kế thừa từ Phần 3/4, không phải HARD BLOCK)

1. `AuditEvent` chưa có DB-level trigger chống UPDATE/DELETE trực tiếp.
2. Không có session revocation list/tokenVersion.
3. `phoneHash` (SHA-256, không salt) trên keyspace SĐT VN nhỏ — rủi ro
   dictionary-attack nếu hash bị lộ; chấp nhận cho MVP, cần salt hoặc HMAC
   với secret riêng nếu Phần 6+ mở API/export dùng field này.
4. Composite FK/DB constraint cho Finance/Healthcare chưa áp dụng (domain đó
   chưa tồn tại) — nhắc Phần 6/7 không quên.

## DEFERRED ITEMS

Sales Opportunity/Pipeline (ADR-019) · Customer Merge (ADR-020) · rule
engine chiết khấu (ADR-021) · "ẩn SĐT mặc định + lộ có audit" UI (ADR-023) ·
`updateDraftSale` — domain function tồn tại, CỐ Ý chưa có UI caller ở Phần
5 (ghi rõ trong `SALES.md`, không phải thiếu sót) · Finance/Payroll/
Commission/Inventory/Healthcare (Phần 6+) · Milestone/Checklist riêng cho
Project (ADR-016, Phần 4) · OrganizationUnit move/reparent UI.

## DO NOT REDO (bổ sung Phần 5, kế thừa toàn bộ danh sách Phần 3+4)

- Không tự-scope (self-scope) visibility Customer/Lead/Appointment/Sale
  theo `ownerUserId`/`assignedUserId` — ADR-022 là Company-wide theo
  permission `.view`, CỐ Ý khác WorkItem (ADR-015). Ngoại lệ duy nhất đã
  chốt: `getMyAppointmentsToday` (view cá nhân "của tôi hôm nay", không
  phải authorization boundary).
- Không thêm quan hệ Customer/Lead vào `include`/`select` mà thiếu `omit: {
  phoneCiphertext: true, phoneHash: true }` — CHỈ `getCustomerDetail`/
  `getLeadDetail` được chạm 2 field này (và phải strip khỏi return value
  bằng destructure trước khi trả ra ngoài service layer).
- Không tính `SaleLine.lineTotal`/`Sale.totalAmount` bằng công thức viết tay
  riêng — LUÔN gọi `calculateLineTotal`/`calculateSaleTotals`
  (`sale-totals.ts`) đã unit-test; không clamp discount ở cấp Sale tách rời
  khỏi clamp cấp dòng — đây chính là root cause P1 tiền vừa vá.
- Không để Server Action (đặc biệt trong `src/lib/actions/*.ts`) trả thẳng
  object Prisma chứa field `Decimal` qua boundary Server→Client — chỉ trả
  phần dữ liệu client thực sự dùng (thường chỉ cần `{ id }` hoặc không cần
  trả gì nếu caller chỉ gọi `router.refresh()`).
- Không port rule engine `ZMechanismDefinition`/`ZMechanismVersion` của
  ZenithTasks (ADR-021) — DRAFT-only, chưa từng chạy production thật.
- Không tạo model Customer Merge hoặc Sales Opportunity/Pipeline riêng
  (ADR-019/ADR-020) trừ khi có bằng chứng nghiệp vụ thật mới.
- Không thiết kế lại authorization foundation Phần 3 hay Work Core Phần 4 —
  Phần 5 chỉ mở rộng `WorkItem` bằng 2 field optional, không tạo engine
  việc thứ 2 (ADR-014 vẫn áp dụng).

## NEXT

Phần 6 — Finance + Payroll + Commission + Inventory. Xem
`docs/project/CURRENT_WAVE.md` để biết input đã sẵn sàng.
