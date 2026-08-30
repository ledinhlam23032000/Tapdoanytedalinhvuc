# Current State

Cập nhật lần cuối: cuối Phần 4 (Organization + Work Core + Project
Foundation).

## Stack (ADR-006 + Phần 3/4 bổ sung)

Next.js 16.3.3 (App Router, Turbopack) + React 19.2.8 + TypeScript (strict) +
Tailwind CSS v4 + Prisma 7.9.1 (`@prisma/adapter-pg`, client generate ra
`src/generated/prisma`, cấu hình CLI ở `prisma.config.ts`) + PostgreSQL 16
(Docker, local dev port **5442**) + Vitest 4 (unit + integration 2 lane,
salvage convention ZenithTasks) + `jose` (JWT) + `bcryptjs` (password hash,
cost 12) + `tsx` (chạy script TypeScript như `bootstrap-founder.ts`). Không
đổi gì ở Phần 4 — đúng ADR-006 "không đổi stack đã chứng minh".

## Lệnh quan trọng

```bash
docker compose up -d              # khởi động Postgres local (port 5442)
npm install                       # cài dependencies (tự chạy `prisma generate`)
npx prisma migrate dev            # tạo/áp migration mới khi đổi schema
npm run bootstrap:founder         # tạo Ecosystem + Founder đầu tiên (đọc env BOOTSTRAP_*)
npm run test                      # vitest unit (không cần DB) — 21/21
npm run test:integration          # vitest integration (*.itest.ts — CẦN Postgres thật) — 53/53
npx tsc --noEmit                  # typecheck
npx eslint .                      # lint
npx next build                    # build production
```

`.env` (không commit) cần `DATABASE_URL`, `AUTH_SECRET`
(`openssl rand -base64 48`), và `BOOTSTRAP_FOUNDER_EMAIL`/
`BOOTSTRAP_FOUNDER_PASSWORD`/`BOOTSTRAP_ECOSYSTEM_CODE`/
`BOOTSTRAP_ECOSYSTEM_NAME` (chỉ cần khi chạy `bootstrap:founder`) — xem
`.env.example`.

## Schema hiện tại (Phần 3 + Phần 4)

`prisma/schema.prisma`: Phần 3 — `User`, `Ecosystem`, `EcosystemMembership`,
`Company`, `CompanyMembership`, `AuditEvent`. Phần 4 (mới) —
`OrganizationUnit`, `Position`, `Assignment`, `WorkItem`, `Project`,
`ProjectMembership`. Migration:
`20260829235717_ecosystem_company_identity_foundation` +
`20260830092334_organization_work_project_foundation`.

## Đã implement thật (Phần 4)

- **Domain service:** `src/lib/domain/organization-service.ts`,
  `work-service.ts`, `project-service.ts`, `work-priority.ts` (xếp hạng
  "Hôm nay" thuần, unit test riêng), `scope-guards.ts` (assert cross-company
  FK dùng chung cho cả 3 domain).
- **Server Actions:** `src/lib/actions/organization-actions.ts`,
  `work-actions.ts`, `project-actions.ts` — thin wrapper, cùng pattern
  `company-actions.ts` Phần 3.
- **UI:** `/c/[code]/today`, `/c/[code]/work`, `/c/[code]/organization`,
  `/c/[code]/projects`, `/c/[code]/projects/[projectId]` — nav cập nhật ở
  `company-nav.tsx`.
- **Docs:** `docs/domain/ORGANIZATION.md`, `WORK_CORE.md`, `PROJECT.md`
  (đọc trước khi sửa 3 domain này); ADR-013 đến ADR-016.

## Đã verify (Phần 4)

- **Unit test:** 21/21 PASS (thêm `work-priority.test.ts` — xếp hạng
  urgency theo tier + timezone Company, không phải lịch UTC server).
- **Integration test:** 53/53 PASS — 24 cũ (Phần 3) + 29 mới
  (`tenant-isolation-part4.itest.ts`): cross-company FK injection (parentId,
  positionId, organizationUnitId, projectId, assigneeUserId, owningUnitId),
  Assignment cho non-member/cross-company, work self-serve vs work.assign,
  quyền hành động 1-1 trên WorkItem (assignee/creator/work.manage), ADR-015
  visibility SELF vs COMPANY, Project cross-company member, Project
  OWNER-membership vs company-wide project.manage/project.archive, Suspended
  Company chặn ghi ở cả 3 domain (kể cả sau khi vá P1 — xem dưới).
- **Anti-pattern search:** sạch — không `role === "ADMIN"` bypass,
  `bypass`, `ZProject*` leak, "workspace tenant"/"clinic root product".
- **Adversarial code review (2 subagent độc lập — red-team + simplicity):**
  `docs/security/RED_TEAM_CODE_REVIEW_PART4.md`. Tìm 1 P1 thật (Suspended/
  Archived Company không chặn `updateProject`/`addProjectMember`/
  `completeProject` vì 3 hàm này gate bằng `"project.view"` — đã sửa bằng
  `assertCompanyWritable()`) + 3 P2 (duplicate assert helper → hợp nhất
  `scope-guards.ts`; `Project.startAt/dueAt/budgetAmount` xây xong domain mà
  chưa có UI → thêm `EditProjectForm`; UI `mayAct` thiếu nhánh creator → sửa
  khớp `canActOnWorkItem()`). Không còn P0/P1 mở.
- **Browser journey thật** (3 persona, Founder tạo Manager/Employee demo
  users trước): Employee (login → Hôm nay → thấy đúng 1 việc của mình → Bắt
  đầu → Hoàn thành → biến mất khỏi Hôm nay); Manager (login → Cơ cấu tổ
  chức xem cây đơn vị/vị trí Founder đã tạo → gán Assignment cho Employee →
  Công việc → tạo task giao cho Employee); Project Owner (Manager tạo
  Project → tự động thành `ProjectMembership OWNER` → sửa thông tin dự án
  qua `EditProjectForm` → thêm Employee làm thành viên → tạo task trong dự
  án giao cho Employee → Hoàn thành task → Hoàn thành dự án). Phát hiện và
  sửa 1 bug thật trong lúc test: `add-member-form.tsx` (Phần 3) gọi
  `e.currentTarget.reset()` sau `await` — currentTarget đã null lúc đó, gây
  lỗi client dù action backend đã thành công. Sửa bằng cách capture
  `const form = e.currentTarget` trước closure async (đúng pattern các form
  Phần 4 đã dùng sẵn).
- `npx tsc --noEmit`, `npx eslint .`, `npx next build` — sạch.
- **Fresh-install test:** tạo DB trống riêng (`tapdoanytedalinhvuc_fresh_test`),
  `prisma migrate deploy` áp cả 2 migration sạch, `bootstrap:founder` chạy
  thành công — sau đó xoá DB tạm.

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
- **`useFormAction` pattern chưa extract** — mọi form Phần 3/4 tự viết
  `useState`+`useTransition`+`router.refresh()` inline, nhất quán nhưng
  chưa dùng chung 1 hook như Salvage Ledger từng đề xuất. Chưa đủ trùng lặp
  để đáng extract — xem `docs/legacy/SALVAGE_LEDGER.md` mục Cập nhật Phần 4.

## KHÔNG có trong Phần 4 (đúng phạm vi)

CRM/Customer, Finance, Payroll, Inventory, Healthcare, Digital COO/AI
proactive, dashboard/reporting engine, Zalo/SMS, payment integration, email
invitation service, role builder UI, break-glass access, user
impersonation, cross-Company Project, Milestone/Checklist model riêng (Work
Core là đủ), OrganizationUnit move/reparent UI (chỉ tạo/archive).
