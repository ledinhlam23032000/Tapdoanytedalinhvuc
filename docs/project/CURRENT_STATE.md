# Current State

Cập nhật lần cuối: cuối Phần 6 (Finance + Payment + Receivable + Ledger +
Payroll + Commission + Inventory).

## Stack (ADR-006 + Phần 3/4/5/6 bổ sung)

Next.js 16.3.3 (App Router, Turbopack) + React 19.2.8 + TypeScript (strict) +
Tailwind CSS v4 + Prisma 7.9.1 (`@prisma/adapter-pg`, client generate ra
`src/generated/prisma`, cấu hình CLI ở `prisma.config.ts`) + PostgreSQL 16
(Docker, local dev port **5442**) + Vitest 4 (unit + integration 2 lane,
salvage convention ZenithTasks) + `jose` (JWT) + `bcryptjs` (password hash,
cost 12) + `tsx` (chạy script TypeScript như `bootstrap-founder.ts`) + Node
`crypto` (AES-256-GCM cho SĐT, Phần 5). Không đổi gì ở Phần 6 — đúng ADR-006
"không đổi stack đã chứng minh". Điểm mới duy nhất ở tầng kỹ thuật: mọi
domain service tiền/kho giờ dùng pattern `SELECT...FOR UPDATE` bên trong
`db.$transaction` cho check-then-write (Postgres READ COMMITTED không tự
chặn race) — không phải thư viện/dependency mới, chỉ là pattern code.

## Lệnh quan trọng

```bash
docker compose up -d              # khởi động Postgres local (port 5442)
npm install                       # cài dependencies (tự chạy `prisma generate`)
npx prisma migrate dev            # tạo/áp migration mới khi đổi schema
npm run bootstrap:founder         # tạo Ecosystem + Founder đầu tiên (đọc env BOOTSTRAP_*)
npm run test                      # vitest unit (không cần DB) — 64/64
npm run test:integration          # vitest integration (*.itest.ts — CẦN Postgres thật) — 133/133
npx tsc --noEmit                  # typecheck
npx eslint .                      # lint
npx next build                    # build production
```

`.env` (không commit) cần `DATABASE_URL`, `AUTH_SECRET`
(`openssl rand -base64 48`), `PHONE_ENC_KEY` (32 byte base64, Phần 5 — xem
`.env.example`), và `BOOTSTRAP_FOUNDER_EMAIL`/`BOOTSTRAP_FOUNDER_PASSWORD`/
`BOOTSTRAP_ECOSYSTEM_CODE`/`BOOTSTRAP_ECOSYSTEM_NAME` (chỉ cần khi chạy
`bootstrap:founder`). Không có biến env mới ở Phần 6.

## Schema hiện tại (Phần 3 + Phần 4 + Phần 5 + Phần 6)

`prisma/schema.prisma`: Phần 3 — `User`, `Ecosystem`, `EcosystemMembership`,
`Company`, `CompanyMembership`, `AuditEvent`. Phần 4 — `OrganizationUnit`,
`Position`, `Assignment`, `WorkItem`, `Project`, `ProjectMembership`. Phần 5
— `CustomerSource`, `Lead`, `Customer`, `CustomerInteraction`,
`Appointment`, `CatalogItem`, `Sale`, `SaleLine`. Phần 6 (mới) — `Payment`,
`Expense`, `LedgerEntry`, `PayrollProfile`, `PayrollRun`, `PayrollItem`,
`ApprovalRequest`, `CommissionRule`, `CommissionCalculation`,
`InventoryLocation`, `InventoryItem`, `StockMovement`. Migration:
`20260829235717_ecosystem_company_identity_foundation` +
`20260830092334_organization_work_project_foundation` +
`20260830124601_crm_sales_appointment_customer_operations` +
`20260831034101_finance_payroll_commission_inventory` +
`20260831034500_fix_stock_adjustment_direction` +
`20260831035000_approval_request_payload` +
`20260831040000_inventory_item_reorder_level` (7 migration tổng).

## Đã implement thật (Phần 6)

- **Domain service:** `payroll-calc.ts`/`commission-calc.ts`/
  `stock-balance.ts` (3 module tính thuần, DB-free, unit test riêng —
  cùng pattern `sale-totals.ts` Phần 5), `approval-service.ts`
  (`ApprovalRequest` 2-người-duyệt dùng chung), `finance-service.ts`,
  `payroll-service.ts`, `commission-service.ts`, `inventory-service.ts`.
  `scope-guards.ts` mở rộng 7 assert cross-company mới.
- **Server Actions:** `finance-actions.ts`, `payroll-actions.ts`,
  `commission-actions.ts`, `inventory-actions.ts` — thin wrapper, luôn trả
  `{id}` hoặc void (không trả Decimal-bearing object — bài học Phần 5).
- **UI:** `/c/[code]/{finance,payroll,payroll/profiles,
  payroll/commission-rules,inventory,inventory/adjustments}` + trang chi
  tiết — nav cập nhật (3 top-level item mới: Tài chính/Lương/Tồn kho).
  `sales/[saleId]/page.tsx` tích hợp thêm Receivable/Payment + Commission
  section.
- **Docs:** `docs/domain/FINANCE.md`, `PAYROLL.md`, `COMMISSION.md`,
  `INVENTORY.md`; ADR-024 đến ADR-035.

## Đã verify (Phần 6)

- **Unit test:** 64/64 PASS (44 cũ + `payroll-calc.test.ts` +
  `commission-calc.test.ts` + `stock-balance.test.ts`, gồm test hồi quy
  rounding + double-count hoa hồng).
- **Integration test:** 133/133 PASS — 99 cũ (Phần 3+4+5) + 34 mới
  (`tenant-isolation-part6.itest.ts`): cross-company FK injection, vòng đời
  PayrollRun đầy đủ (kể cả live same-actor-denial assertion), Commission
  double-count prevention, Inventory movement + âm kho + duyệt điều chỉnh,
  Suspended-Company chặn ghi, VÀ describe block riêng cho concurrency dùng
  `Promise.allSettled` bắn thật 2 lệnh song song vào cùng Postgres instance.
- **Anti-pattern search:** sạch.
- **Adversarial code review (5 subagent độc lập — tăng từ 3 ở Phần 5 vì
  đây là domain HIGH/VERY HIGH RISK):** `docs/security/RED_TEAM_CODE_REVIEW_PART6.md`.
  Tìm **4 P0 thật** (đều cùng 1 root cause class — thiếu `SELECT...FOR
  UPDATE` cho check-then-write trên tiền/kho): `calculatePayrollRun`
  netAmount hand-roll mất bonus/deduction, `recordPayment` race
  overpayment, `finalizePayrollRun` race double-pay, `issueStock`/
  `transferStock` race âm kho. Cộng nhiều P1/P2 (rounding hoa hồng,
  cross-tenant contributor gap, PII over-fetch lặp lại bug class Phần 5,
  idempotencyKey namespace-collision, adjustment APPROVED biến mất khỏi
  UI). Không còn P0/P1 mở sau khi sửa.
- **2 lớp bug thật phát hiện ngoài review**: (1) qua browser-test —
  `effectiveFrom` PayrollProfile mặc định timestamp chính xác gây same-day
  exclusion; (2) qua re-verify integration test TRƯỚC khi chốt checkpoint —
  bản vá (1) dùng giờ địa phương thay vì UTC để truncate, làm lệch ngày
  effectiveFrom tường minh trên máy chạy timezone lùi sau UTC (đã sửa sang
  `Date.UTC`), kéo theo phát hiện 1 test dùng `findFirst` không filter gặp
  fixture-bleed (đã sửa sang `findMany` + `.find()`). Chi tiết đầy đủ:
  `docs/checkpoints/LATEST.md`.
- **Browser journey thật (3 journey bắt buộc):** Finance/Payment (Sale
  CONFIRMED có sẵn → ghi Payment → Receivable derived đúng); Payroll
  two-person-approval (đầy đủ vòng đời DRAFT→FINALIZED, live-test cùng actor
  bị chặn duyệt lần 2, actor khác duyệt thành công, Expense+LedgerEntry tự
  sinh đúng); Inventory two-person-approval (nhập/xuất/điều chỉnh kho,
  cùng live-test same-actor-denial, thực thi điều chỉnh đã duyệt, số dư
  đúng 75).
- `npx tsc --noEmit`, `npx eslint .`, `npx next build` — sạch (chạy lại
  toàn bộ SAU khi sửa cả 3 bug ở trên, không chỉ trước review).
- **Fresh-install test:** DB trống riêng, `prisma migrate deploy` áp cả 7
  migration sạch, `bootstrap:founder` chạy thành công — xoá DB tạm.

## Known issue / quyết định kỹ thuật đáng chú ý

- **`allowedDevOrigins`** phải thêm vào `next.config.ts` — kế thừa từ Phần
  4, vẫn đúng.
- `npm audit`: 3 lỗi "high" kế thừa từ Prisma CLI 7.x tooling — theo dõi,
  không block.
- `AuditEvent`/`LedgerEntry`/`StockMovement` chưa có DB-level trigger chống
  UPDATE/DELETE trực tiếp — bất biến hiện chỉ ở tầng application (domain
  service là con đường ghi DUY NHẤT).
- **Mọi so sánh/truncate ngày dùng để xác định hiệu lực (effective-dated
  entity, period boundary) PHẢI dùng `getUTC*`/`Date.UTC`, không dùng giờ
  địa phương** — bài học Phần 6 (bug Lớp 2), vì `z.coerce.date()` luôn parse
  date-only string thành UTC midnight.
- **Test integration dùng `beforeAll` (không `beforeEach`) có rủi ro
  fixture-bleed thật giữa các test trong cùng file** — không dùng
  `findFirst` không filter khi entity liên quan có thể có nhiều bản ghi hợp
  lệ cho cùng điều kiện.
- **`phoneHash` (SHA-256, không salt)** trên keyspace SĐT VN nhỏ — chấp
  nhận cho MVP, cần salt/HMAC nếu Phần 7+ mở API/export dùng field này.

## KHÔNG có trong Phần 6 (đúng phạm vi)

Invoice/hoá đơn điện tử, AccountsPayable, đa tiền tệ, kế toán kép, định giá
tồn kho FIFO/LIFO, barcode/serial/lot tracking, Purchase Order/Supplier,
Healthcare, Digital COO/AI proactive, dashboard/reporting engine, Zalo/SMS,
payment integration, email invitation service, role builder UI, break-glass
access, user impersonation, Milestone/Checklist riêng cho Project,
OrganizationUnit move/reparent UI, mọi mục deferred Phần 3/4/5.
