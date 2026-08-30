# Current State

Cập nhật lần cuối: cuối Phần 3 (Ecosystem + Company + Identity + Membership
+ Permission + Tenant Security Foundation).

## Stack (ADR-006 + Phần 3 bổ sung)

Next.js 16.3.3 (App Router, Turbopack) + React 19.2.8 + TypeScript (strict) +
Tailwind CSS v4 + Prisma 7.9.1 (`@prisma/adapter-pg`, client generate ra
`src/generated/prisma`, cấu hình CLI ở `prisma.config.ts`) + PostgreSQL 16
(Docker, local dev port **5442**) + Vitest 4 (unit + integration 2 lane,
salvage convention ZenithTasks) + `jose` (JWT) + `bcryptjs` (password hash,
cost 12) + `tsx` (chạy script TypeScript như `bootstrap-founder.ts`).

## Lệnh quan trọng

```bash
docker compose up -d              # khởi động Postgres local (port 5442)
npm install                       # cài dependencies (tự chạy `prisma generate`)
npx prisma migrate dev            # tạo/áp migration mới khi đổi schema
npm run bootstrap:founder         # tạo Ecosystem + Founder đầu tiên (đọc env BOOTSTRAP_*)
npm run test                      # vitest unit (không cần DB)
npm run test:integration          # vitest integration (*.itest.ts — CẦN Postgres thật)
npm run qa:tenant-isolation       # chỉ chạy bộ test tenant isolation (24 test)
npx tsc --noEmit                  # typecheck
npx eslint .                      # lint
npx next build                    # build production
npx next dev -p 3521              # dev server (allowedDevOrigins đã cấu hình cho 127.0.0.1/localhost)
```

`.env` (không commit) cần `DATABASE_URL`, `AUTH_SECRET`
(`openssl rand -base64 48`), và `BOOTSTRAP_FOUNDER_EMAIL`/
`BOOTSTRAP_FOUNDER_PASSWORD`/`BOOTSTRAP_ECOSYSTEM_CODE`/
`BOOTSTRAP_ECOSYSTEM_NAME` (chỉ cần khi chạy `bootstrap:founder`) — xem
`.env.example`.

## Schema hiện tại (Phần 3)

`prisma/schema.prisma`: `User`, `Ecosystem`, `EcosystemMembership`,
`Company`, `CompanyMembership`, `AuditEvent`. Migration:
`20260829235717_ecosystem_company_identity_foundation` (thay thế migration
`HealthCheck` của Phần 1 — đã reset local dev DB vì chỉ có dữ liệu bootstrap
tạm, không phải production).

## Đã verify (Phần 3)

- **Unit test:** `npm run test` — 10/10 PASS (password hashing, permission
  preset "no god mode" check).
- **Integration test:** `npm run test:integration` — **24/24 PASS**, cover
  đủ ma trận Master Prompt mục LXVI-LXXXI + CLXVIII-CLXXV: cross-company
  read/write deny, outsider deny, cross-ecosystem isolation, Founder/
  Ecosystem-tier KHÔNG tự ghi được Company cụ thể nếu thiếu
  CompanyMembership, privilege escalation (self-role-change, non-Owner cấp
  Owner, Company-tier action không chạm được EcosystemMembership),
  last-owner protection, suspended/archived Company guard, revoked
  membership có hiệu lực ngay, role preset đúng như khai báo, default deny.
- **Anti-pattern search** (mục CCXLVI-CCXLVII): không tìm thấy
  `role === "ADMIN"` bypass, `getAllCompanies` không lọc, hay thuật ngữ drift
  ("workspace tenant", "clinic root product"...) trong code thật (chỉ có
  trong comment giải thích cái KHÔNG được làm).
- **Adversarial code review** (subagent đọc source thật, không phải docs):
  xem `docs/checkpoints/LATEST.md` mục kết quả.
- **Browser journey thật** (Browser tool, không chỉ đọc code): đăng nhập
  Founder → tạo Company "Bệnh viện Đa khoa Hồng Phúc" → tự động thành OWNER
  → xem trang Thành viên → nav hoạt động đúng. (Nút suspend/archive dùng
  `window.confirm()` — công cụ browser test không click qua được dialog gốc
  của trình duyệt; các action này được verify đầy đủ qua integration test
  thay vì qua tool này.)
- `npx tsc --noEmit`, `npx eslint .`, `npx next build` — sạch.

## Known issue / quyết định kỹ thuật đáng chú ý

- **`allowedDevOrigins`** phải thêm vào `next.config.ts` (`127.0.0.1`,
  `localhost`) — Next.js 16 dev server mặc định chặn cross-origin request
  tới dev resource, browser test tool proxy qua origin khác nên bị 403 nếu
  thiếu config này. Chỉ ảnh hưởng `next dev`, không ảnh hưởng production
  build.
- `npm audit`: 3 lỗi "high" kế thừa từ Prisma CLI 7.x tooling
  (`deepmerge-ts`) — theo dõi, không block (đã ghi từ Phần 1, vẫn còn).
- `AuditEvent` chưa có DB-level trigger chống UPDATE/DELETE trực tiếp (khác
  với `AuditLog` của ZenithTasks có trigger) — xem Salvage Ledger mục "Risk
  còn mở".

## KHÔNG có trong Phần 3 (đúng phạm vi, xem mục IV Master Prompt Phần 3)

CRM/Customer, Finance, Payroll, Inventory, Healthcare, Digital COO/AI
proactive, Work Core, Project, Organization/Position/Assignment (Phần 4),
advanced dashboard, reporting engine, Zalo/SMS, payment integration, company
template phức tạp, email invitation service, role builder UI, break-glass
access, user impersonation.
