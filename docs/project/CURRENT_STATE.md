# Current State

Cập nhật lần cuối: cuối Phần 5 (CRM + Sales + Appointment + Customer
Operations).

## Stack (ADR-006 + Phần 3/4/5 bổ sung)

Next.js 16.3.3 (App Router, Turbopack) + React 19.2.8 + TypeScript (strict) +
Tailwind CSS v4 + Prisma 7.9.1 (`@prisma/adapter-pg`, client generate ra
`src/generated/prisma`, cấu hình CLI ở `prisma.config.ts`) + PostgreSQL 16
(Docker, local dev port **5442**) + Vitest 4 (unit + integration 2 lane,
salvage convention ZenithTasks) + `jose` (JWT) + `bcryptjs` (password hash,
cost 12) + `tsx` (chạy script TypeScript như `bootstrap-founder.ts`) +
Node `crypto` (AES-256-GCM cho SĐT, mới ở Phần 5). Không đổi gì ở Phần 5 —
đúng ADR-006 "không đổi stack đã chứng minh".

## Lệnh quan trọng

```bash
docker compose up -d              # khởi động Postgres local (port 5442)
npm install                       # cài dependencies (tự chạy `prisma generate`)
npx prisma migrate dev            # tạo/áp migration mới khi đổi schema
npm run bootstrap:founder         # tạo Ecosystem + Founder đầu tiên (đọc env BOOTSTRAP_*)
npm run test                      # vitest unit (không cần DB) — 44/44
npm run test:integration          # vitest integration (*.itest.ts — CẦN Postgres thật) — 99/99
npx tsc --noEmit                  # typecheck
npx eslint .                      # lint
npx next build                    # build production
```

`.env` (không commit) cần `DATABASE_URL`, `AUTH_SECRET`
(`openssl rand -base64 48`), `PHONE_ENC_KEY` (32 byte base64, mới ở Phần 5 —
xem `.env.example`), và `BOOTSTRAP_FOUNDER_EMAIL`/`BOOTSTRAP_FOUNDER_PASSWORD`/
`BOOTSTRAP_ECOSYSTEM_CODE`/`BOOTSTRAP_ECOSYSTEM_NAME` (chỉ cần khi chạy
`bootstrap:founder`).

## Schema hiện tại (Phần 3 + Phần 4 + Phần 5)

`prisma/schema.prisma`: Phần 3 — `User`, `Ecosystem`, `EcosystemMembership`,
`Company`, `CompanyMembership`, `AuditEvent`. Phần 4 — `OrganizationUnit`,
`Position`, `Assignment`, `WorkItem`, `Project`, `ProjectMembership`. Phần 5
(mới) — `CustomerSource`, `Lead`, `Customer`, `CustomerInteraction`,
`Appointment`, `CatalogItem`, `Sale`, `SaleLine`; `WorkItem` mở rộng 2 field
optional `customerId`/`appointmentId`. Migration:
`20260829235717_ecosystem_company_identity_foundation` +
`20260830092334_organization_work_project_foundation` +
`20260830124601_crm_sales_appointment_customer_operations`.

## Đã implement thật (Phần 5)

- **Domain service:** `src/lib/crypto/phone.ts` (mã hoá/hash SĐT),
  `src/lib/domain/sale-totals.ts` (tính tiền Sale thuần, DB-free),
  `appointment-conflict.ts` (check trùng lịch thuần), `customer-service.ts`,
  `lead-service.ts`, `appointment-service.ts`, `sales-service.ts` (Catalog +
  Sale). `scope-guards.ts` mở rộng 5 assert cross-company mới.
  `work-service.ts` (Phần 4) mở rộng `getOpenWorkForCustomer`/
  `hasOpenWorkItemForAppointment`.
- **Server Actions:** `customer-actions.ts`, `lead-actions.ts`,
  `appointment-actions.ts`, `sales-actions.ts` — thin wrapper, cùng pattern
  `organization-actions.ts` Phần 4 (lưu ý: `sales-actions.ts` KHÔNG trả
  nguyên object Prisma vì `Sale`/`SaleLine` có field `Decimal` không
  serialize được qua Server Action boundary — xem mục Known issue).
- **UI:** `/c/[code]/{customers,customers/leads,appointments,sales,
  sales/catalog}` + trang chi tiết từng entity — nav cập nhật ở
  `company-nav.tsx` (3 top-level item mới: Khách hàng/Lịch hẹn/Kinh doanh).
  `today/page.tsx` tích hợp thêm "Lịch hẹn hôm nay".
- **Docs:** `docs/domain/CRM.md`, `CUSTOMER.md`, `LEAD.md`,
  `APPOINTMENT.md`, `SALES.md` (đọc trước khi sửa domain này); ADR-017 đến
  ADR-023.

## Đã verify (Phần 5)

- **Unit test:** 44/44 PASS (21 cũ + `phone.test.ts` + `sale-totals.test.ts`
  + `appointment-conflict.test.ts`, gồm 2 test hồi quy cho P1 tiền).
- **Integration test:** 99/99 PASS — 53 cũ (Phần 3+4) + 46 mới
  (`tenant-isolation-part5.itest.ts`): cross-company FK injection trên toàn
  bộ FK mới, duplicate-detection Customer, ADR-022 Company-wide visibility
  (test dương tính: MemberA thấy record ManagerA), Lead conversion
  dedup/reuse/atomicity, Appointment conflict, No-show idempotent follow-up
  Work, Sale money/lifecycle integrity, Suspended-Company chặn ghi cả 4
  domain mới, phone-encryption-at-rest.
- **Anti-pattern search:** sạch.
- **Adversarial code review (3 subagent độc lập — tenant-isolation +
  simplicity + money/PII integrity, agent thứ 3 mới ở Phần 5):**
  `docs/security/RED_TEAM_CODE_REVIEW_PART5.md`. Tìm **2 P1 thật**: (1)
  `calculateSaleTotals` tính sai `discountAmount` khi 1 dòng chiết khấu vượt
  giá trị dòng đó → `Sale.totalAmount` lệch `sum(lineTotal)` — đã sửa để
  bất biến đúng bằng cấu trúc; (2) `phoneCiphertext`/`phoneHash` over-fetch
  ở 6 vị trí list/detail ngoài 2 hàm detail được phép — đã sửa bằng Prisma
  `omit`. Không còn P0/P1 mở.
- **Bug thật thứ 3** phát hiện qua browser-test SAU review (không phải
  review tìm ra): `confirmSaleAction`/`cancelSaleAction`/4 action khác trong
  `sales-actions.ts` trả thẳng object Prisma Sale chứa `Decimal` qua Server
  Action → Client Component boundary — Next.js RSC không serialize được,
  log lỗi console mỗi lần gọi (không chặn hẳn action nhưng là hành vi mong
  manh). Đã sửa: chỉ trả `{ id }` (khi caller cần redirect) hoặc không trả
  gì (khi caller chỉ `router.refresh()`).
- **Browser journey thật (Manager persona, 3 journey bắt buộc):** Reception/
  Sales (tạo Customer → SĐT giải mã đúng → tạo Appointment từ quick-action →
  xuất hiện đúng ở Hôm nay); Sales transaction (Customer → tạo Sale → thêm
  dòng hàng → Xác nhận → xuất hiện đúng trong lịch sử giao dịch Customer —
  đây là journey phát hiện bug Decimal); Follow-up (Appointment → Không đến
  → follow-up WorkItem tự động → Hôm nay → Bắt đầu → Hoàn thành).
- `npx tsc --noEmit`, `npx eslint .`, `npx next build` — sạch (chạy lại
  toàn bộ sau khi sửa bug Decimal, không chỉ trước review).
- **Fresh-install test:** DB trống riêng, `prisma migrate deploy` áp cả 3
  migration sạch, `bootstrap:founder` chạy thành công — xoá DB tạm.

## Known issue / quyết định kỹ thuật đáng chú ý

- **`allowedDevOrigins`** phải thêm vào `next.config.ts` — kế thừa từ Phần
  4, vẫn đúng.
- `npm audit`: 3 lỗi "high" kế thừa từ Prisma CLI 7.x tooling — theo dõi,
  không block.
- `AuditEvent` chưa có DB-level trigger chống UPDATE/DELETE trực tiếp.
- **`useFormAction` pattern chưa extract** — vẫn chưa đủ trùng lặp để đáng
  extract, kế thừa từ Phần 4.
- **Prisma `Decimal` không serialize được qua React Server Action boundary**
  — mọi Server Action mới cần Decimal (tiền, số thập phân chính xác cao)
  PHẢI convert sang `number`/string hoặc chỉ trả field client thực sự cần,
  KHÔNG trả nguyên object Prisma. Đây là bài học Phần 5, áp dụng cho Phần 6
  (Finance/Payroll có rất nhiều field Decimal).
- **`phoneHash` (SHA-256, không salt)** trên keyspace SĐT VN nhỏ — chấp
  nhận cho MVP, cần salt/HMAC nếu Phần 6+ mở API/export dùng field này.

## KHÔNG có trong Phần 5 (đúng phạm vi)

Sales Opportunity/Pipeline, Customer Merge, rule engine chiết khấu, "ẩn SĐT
mặc định + lộ có audit" UI, `updateDraftSale` UI caller (domain function có
sẵn, cố ý chưa dùng), Finance, Payroll, Commission, Inventory, Healthcare,
Digital COO/AI proactive, dashboard/reporting engine, Zalo/SMS, payment
integration, email invitation service, role builder UI, break-glass access,
user impersonation, Milestone/Checklist riêng cho Project, OrganizationUnit
move/reparent UI.
