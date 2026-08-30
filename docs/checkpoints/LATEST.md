# Checkpoint — Phần 4 hoàn tất

(Checkpoint Phần 1/2/3 xem lịch sử git — `git log --oneline` — commit "Part
1: ...", "Part 2: ...", "Part 3: ...". File này chỉ giữ checkpoint MỚI
NHẤT.)

## PHASE 4 STATUS

**COMPLETE** — `PART_4_COMPLETE`, `READY_FOR_PART_5`. Organization + Work
Core + Project implement thật trên nền authorization Phần 3 (không viết lại
authorization) — schema Prisma migrate được, domain service + Server Action
+ UI chạy được end-to-end qua browser thật với 3 persona (Employee/Manager/
Project Owner), 53 integration test PASS (24 cũ + 29 mới), adversarial code
review 2 agent độc lập tìm 1 P1 thật + 3 P2 (đã sửa hết).

TARGET HEAD: xem commit ngay sau checkpoint này (`git log -1`).

## SCHEMA IMPLEMENTED (mới ở Phần 4)

`OrganizationUnit`, `Position`, `Assignment`, `WorkItem`, `Project`,
`ProjectMembership` (`prisma/schema.prisma`, migration
`20260830092334_organization_work_project_foundation`, sau migration Phần 3
`20260829235717_ecosystem_company_identity_foundation`). Verified qua cả
`prisma migrate dev` (local) và `prisma migrate deploy` (fresh-install test
trên DB trống riêng).

## KIẾN TRÚC QUYẾT ĐỊNH (ADR-013 → ADR-016, `docs/architecture/DECISIONS.md`)

- **ADR-013** — Position là template cấp Company, KHÔNG gắn
  `organizationUnitId` (tránh trùng lặp Position theo từng chi nhánh). Nơi
  một người giữ vị trí nằm ở `Assignment.organizationUnitId`.
- **ADR-014** — MỘT `WorkItem` duy nhất cho mọi loại việc (Company/Project/
  Organization) — trực tiếp sửa lỗi "2 engine song song" (`Plan`/`PlanTask`
  vs `ZWorkspaceTask`) của ZenithTasks.
- **ADR-015** — Work visibility 2-tier: SELF (MEMBER/VIEWER không có
  `work.assign` chỉ thấy việc mình tạo/được giao) vs COMPANY (MANAGER+ có
  `work.assign` thấy toàn bộ) — cố tình đơn giản, không xây ACL per-row.
- **ADR-016** — Không có Milestone/Checklist model riêng cho Project ở Phần
  4 (defer tới khi có bằng chứng cần thật).

Chi tiết implementation + invariant giữ nguyên: `docs/domain/
ORGANIZATION.md`, `WORK_CORE.md`, `PROJECT.md` (đọc trước khi sửa 3 domain
này).

## DOMAIN SERVICE + ACTION + UI

`src/lib/domain/organization-service.ts` (OrganizationUnit + Position +
Assignment CRUD/lifecycle), `work-service.ts` (WorkItem create/assign/start/
complete/cancel + `getMyTodayWork`/`getCompanyWork` theo ADR-015),
`work-priority.ts` (xếp hạng "Hôm nay" thuần, timezone-aware qua
`Intl.DateTimeFormat`, không phải lịch UTC server), `project-service.ts`
(Project + ProjectMembership, bootstrap tự động `ProjectMembership OWNER`
khi tạo), `scope-guards.ts` (assert cross-company FK dùng chung — hợp nhất
sau simplicity review, trước đó 3 service tự viết lại logic giống hệt
nhau). Server Actions: `organization-actions.ts`/`work-actions.ts`/
`project-actions.ts` — thin wrapper, cùng pattern `company-actions.ts` Phần
3. UI: `/c/[code]/{today,work,organization,projects,projects/[projectId]}`,
nav cập nhật ở `company-nav.tsx`.

## PERMISSION MỞ RỘNG

`organization.view`/`organization.manage`, `people.view`/`people.assign`,
`work.view`/`work.create`/`work.update`/`work.assign`/`work.complete`/
`work.manage`, `project.view`/`project.create`/`project.manage`/
`project.archive` (`src/lib/permissions/registry.ts`+`presets.ts`). MANAGER
có `people.assign`/`work.assign`/`project.create` nhưng KHÔNG có
`organization.manage`/`work.manage`/`project.manage`/`project.archive` —
"xem/vận hành" và "quản trị cấu trúc" là 2 trục quyền khác nhau (đúng
nguyên tắc Phần 3 "không hard-code Manager = Owner").

## STATIC TESTS

`npx tsc --noEmit` 0 lỗi · `npx eslint .` 0 lỗi/cảnh báo · `npx next build`
PASS (10 route: `/`, `/_not-found`, `/api/health`, `/c/[code]`,
`/c/[code]/members`, `/c/[code]/organization`, `/c/[code]/projects`,
`/c/[code]/projects/[projectId]`, `/c/[code]/today`, `/c/[code]/work`,
`/login`).

## UNIT + INTEGRATION TESTS

`npm run test` — **21/21 PASS** (10 cũ + 11 mới `work-priority.test.ts`:
tier khẩn cấp, timezone-aware "hôm nay", tie-break theo hạn). `npm run
test:integration` — **53/53 PASS** (24 cũ Phần 3 + 29 mới
`tenant-isolation-part4.itest.ts`): cross-company FK injection trên mọi FK
mới (parentId Unit, positionId, organizationUnitId, projectId,
assigneeUserId, owningUnitId), Assignment cho non-member/cross-company,
work self-serve (tự giao việc cho mình không cần `work.assign`) vs giao cho
người khác (cần), quyền hành động 1-1 trên WorkItem (`work.manage` HOẶC
assignee HOẶC creator), ADR-015 visibility SELF vs COMPANY, Project
cross-company member deny, Project OWNER-membership KHÔNG tự có
`project.archive`/`work.assign` cấp Company, Suspended Company chặn ghi ở
cả 3 domain (kể cả sau khi vá P1 — xem dưới).

## ADVERSARIAL CODE REVIEW (2 agent độc lập)

`docs/security/RED_TEAM_CODE_REVIEW_PART4.md`. Agent 1 (tenant-isolation
attacker) tìm **1 P1 thật**: `updateProject`/`addProjectMember`/
`completeProject` gate bằng `"project.view"` (để giữ nhánh Project
OWNER-membership fallback hoạt động) — nhưng `"project.view"` nằm trong
`READ_ONLY_PERMISSIONS` nên Company SUSPENDED/ARCHIVED không chặn được 3
hàm này. **Đã sửa**: thêm `assertCompanyWritable()` gọi tường minh, độc lập
với cờ `isWriteAction()`. Agent 2 (simplicity/architecture-drift) tìm 3 P2:
duplicate assert helper (→ hợp nhất `scope-guards.ts`), `Project.startAt/
dueAt/budgetAmount` xây xong domain mà không có UI (→ thêm
`EditProjectForm`), UI `mayAct` thiếu nhánh creator so với
`canActOnWorkItem()` thật (→ sửa khớp). Không còn P0/P1 mở sau khi sửa.

## BROWSER TESTS (3 persona thật)

Founder tạo 2 user demo (Manager, Employee) qua script tạm rồi thêm vào
Company qua chính UI Thành viên (exercising `addCompanyMemberAction` thật).
**Employee**: đăng nhập → Hôm nay chỉ thấy đúng 1 việc của mình → Bắt đầu →
Hoàn thành → biến mất khỏi Hôm nay. **Manager**: đăng nhập → Cơ cấu tổ chức
(chỉ xem, không có form tạo Unit/Position vì thiếu `organization.manage`) →
gán Assignment cho Employee (có `people.assign`) → Công việc (thấy toàn
Company, đúng ADR-015) → tạo task giao cho Employee. **Project Owner**:
Manager tạo Project → tự động thành `ProjectMembership OWNER` → sửa thông
tin dự án qua `EditProjectForm` (đơn vị chủ quản/ngày/ngân sách) → thêm
Employee làm thành viên dự án → tạo task trong dự án giao cho Employee →
Hoàn thành task → Hoàn thành dự án (nút biến mất đúng sau khi COMPLETED).

Phát hiện và sửa 1 bug thật trong lúc test (không phải Phần 4 viết ra, phát
hiện qua test thật): `src/app/c/[code]/members/add-member-form.tsx` (Phần
3) gọi `e.currentTarget.reset()` sau `await` — SyntheticEvent's
`currentTarget` đã null lúc đó, gây lỗi client dù `addCompanyMemberAction`
backend đã thành công (member vẫn được thêm đúng, chỉ UI báo lỗi giả).
Sửa: capture `const form = e.currentTarget` trước closure async — đúng
pattern mọi form Phần 4 đã tự dùng sẵn từ đầu.

## FRESH DB TEST

Tạo database trống riêng (`tapdoanytedalinhvuc_fresh_test`, không đụng DB
dev đang có dữ liệu thật) → `prisma migrate deploy` áp cả 2 migration sạch
→ `bootstrap-founder` chạy thành công → xoá DB tạm. Không dùng `docker
compose down -v` lần này vì DB dev hiện đang giữ dữ liệu browser-test hữu
ích cho Phần 5 (Founder + Company + 2 demo user + Assignment + Project mẫu)
— khác cách làm "xoá volume" của checkpoint Phần 3 vì lúc đó DB dev chỉ có
dữ liệu bootstrap tạm, không đáng giữ.

## SECURITY RISKS (còn mở, kế thừa từ Phần 3, không phải HARD BLOCK)

1. `AuditEvent` chưa có DB-level trigger chống UPDATE/DELETE trực tiếp.
2. Không có session revocation list/tokenVersion.
3. Composite FK/DB constraint cho Finance/Healthcare chưa áp dụng (domain
   đó chưa tồn tại) — nhắc Phần 6/7 không quên.

## DEFERRED ITEMS

Customer/Appointment/Sale/Finance/Payroll/Inventory/Healthcare (Phần 5+) ·
Milestone/Checklist model riêng cho Project (ADR-016, thêm khi có bằng
chứng cần) · OrganizationUnit move/reparent UI (chỉ tạo/archive, chưa sửa
cây) · `useFormAction` shared hook (mọi form vẫn viết inline, nhất quán
nhưng chưa DRY — xem Salvage Ledger) · role builder UI · email invitation
service.

## DO NOT REDO (bổ sung Phần 4, kế thừa toàn bộ danh sách Phần 3)

- Không thêm `organizationUnitId` vào `Position` (ADR-013).
- Không tạo engine việc thứ 2 cho bất kỳ domain nào (ADR-014) — mọi "task
  giống nhau" đều là `WorkItem`.
- Không để Project OWNER-membership (per-project) tự mở rộng thành quyền
  cấp Company (`project.archive`, `work.assign`, v.v.) — 2 đường quyền này
  cố tình tách biệt, xem `docs/domain/PROJECT.md`.
- Không gate một hàm ghi dữ liệu (mutation) bằng permission nằm trong
  `READ_ONLY_PERMISSIONS` (`company-context.ts`) mà không tự thêm check
  `company.status === "ACTIVE"` tường minh — đây chính là root cause của P1
  vừa vá ở Phần 4.
- Không truy cập `e.currentTarget` bên trong closure async SAU một `await`
  trong `onSubmit` handler — luôn capture biến thường (`const form =
  e.currentTarget`) trước khi vào `startTransition(async () => {...})`.
- Không thiết kế lại authorization foundation Phần 3 — vẫn đúng nguyên vẹn,
  Phần 4 chỉ build domain mới TRÊN nền đó.

## NEXT

Phần 5 — CRM + Sales + Generic Operations. Xem `docs/project/CURRENT_WAVE.md`
để biết input đã sẵn sàng.
