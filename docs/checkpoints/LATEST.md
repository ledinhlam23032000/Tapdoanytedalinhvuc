# Checkpoint — Phần 3 hoàn tất

(Checkpoint Phần 1/Phần 2 xem lịch sử git — `git log --oneline` — commit
"Part 1: ..." và "Part 2: ...". File này chỉ giữ checkpoint MỚI NHẤT.)

## PHASE 3 STATUS

**COMPLETE** — `PART_3_COMPLETE`, `READY_FOR_PART_4`. Đây là phase
implement THẬT đầu tiên (không còn chỉ docs) — schema Prisma migrate được,
app chạy được, đăng nhập/tạo Company/quản lý thành viên hoạt động end-to-end
qua browser thật, 24 integration test tenant-isolation PASS, adversarial
code review PASS.

TARGET HEAD: xem commit ngay sau checkpoint này (`git log -1`).

## SCHEMA IMPLEMENTED

`User`, `Ecosystem`, `EcosystemMembership`, `Company`, `CompanyMembership`,
`AuditEvent` (`prisma/schema.prisma`, migration
`20260829235717_ecosystem_company_identity_foundation`). Verified qua cả
`prisma migrate dev` (local) và `prisma migrate deploy` (production-style,
fresh-install test).

## AUTH STRATEGY

JWT (`jose`, HS256) trong cookie httpOnly, session chỉ chứa
`{userId, displayName}` — không nhồi permission. `bcryptjs` cost 12 cho
password. Salvage đúng pattern đã chứng minh tốt ở ZenithTasks, viết code
mới (không copy file). Chi tiết: `docs/security/AUTHORIZATION_MODEL.md`.

## ECOSYSTEM MODEL / COMPANY MODEL / MEMBERSHIP MODEL / PERMISSION MODEL

Xem `docs/security/AUTHORIZATION_MODEL.md` — mô tả đầy đủ implementation
thật, đặc biệt quyết định quan trọng nhất: **không role Ecosystem-tier nào
(FOUNDER, ECOSYSTEM_ADMIN) tự động ghi được vào một Company cụ thể** — luôn
cần `CompanyMembership` tường minh, trừ đúng 3 hành động lifecycle
(create/suspend/resume/archive) là Ecosystem-tier có chủ đích.

## COMPANY CONTEXT

`src/lib/authorization/company-context.ts` — `resolveCompanyContextForActor`
là điểm authorization duy nhất mọi domain code (kể cả Phần 4 trở đi) phải
gọi qua. Có bản request-scoped (cookie-based, cho page/action) và bản
actorId-based (cho integration test) — refactor có chủ đích để test được mà
không giả lập HTTP request.

## LIFECYCLE

Company: `DRAFT → ACTIVE → SUSPENDED → ARCHIVED`. Suspend/Resume/Archive
implement đủ, có audit, có guard chặn ghi khi không `ACTIVE`. Last-owner
protection + chống self-role-change + chỉ Owner cấp được Owner — cả 3 đều
có integration test xác nhận.

## AUDIT

`AuditEvent`, ghi trong cùng `$transaction` với mọi state change quan
trọng (Company lifecycle, membership add/change/remove, login). Risk còn
mở: chưa có DB-level trigger chống UPDATE/DELETE trực tiếp (khác
`AuditLog` cũ của ZenithTasks) — ghi trong Salvage Ledger.

## TEST PERSONAS

Founder, EcosystemAdmin, OwnerA, AdminA, MemberA, ViewerA, OwnerB, MemberB,
Outsider trên Ecosystem E1 (Company A, B) + Ecosystem E2 (Company C) — đúng
theo mục CXXXIV Master Prompt. Fixture tự sinh/tự dọn trong
`tenant-isolation.itest.ts`, xác nhận DB sạch sau mỗi lần chạy (đã verify
thủ công: về đúng 1 user thật sau test).

## STATIC TESTS

`npx tsc --noEmit` 0 lỗi · `npx eslint .` 0 lỗi/cảnh báo · `npx next build`
PASS (6 route: `/`, `/_not-found`, `/api/health`, `/c/[code]`,
`/c/[code]/members`, `/login`).

## INTEGRATION TESTS

`npm run test:integration` — **24/24 PASS**. Cover: cross-company read/write
deny (LXVII-LXXI), outsider deny (LXXIII), cross-ecosystem isolation
(LXXIV-LXXV, CLXXII), Founder/Ecosystem-tier không tự ghi Company cụ thể
(sửa sau red-team Phần 2), privilege escalation × 3 dạng (CLXX-CLXXI),
last-owner protection (LI/LXXX), suspended company blocks write (LXXVI),
archived company idempotent (LXXVII), revoked membership hiệu lực ngay
(LXXVIII), role preset đúng khai báo (LXXXI), default deny (LXXXIII).

## TENANT SECURITY TESTS

Đã tích hợp trong integration test suite ở trên (không tách file riêng —
đúng tinh thần "một suite đủ, không nhân bản không cần thiết"). Bổ sung
adversarial code review độc lập (subagent đọc source thật, KHÔNG đọc test
suite trước khi kết luận) — verdict **PASS**, xem
`docs/security/RED_TEAM_CODE_REVIEW.md`.

## BROWSER TESTS

Đã tự mở trình duyệt thật (Browser tool): đăng nhập Founder → Ecosystem
Home hiện đúng → tạo Company "Bệnh viện Đa khoa Hồng Phúc" → tự động chuyển
sang Company Home, vai trò hiển thị đúng "OWNER" → tab "Thành viên" hoạt
động, form thêm thành viên hiện đúng. Phát hiện và tự sửa 1 bug thật trong
lúc test: Next.js 16 dev server chặn cross-origin request từ browser-test
tool (403), phải thêm `allowedDevOrigins` vào `next.config.ts` (chỉ ảnh
hưởng `next dev`, không ảnh hưởng production build). Nút suspend/archive
dùng `window.confirm()` — tool test không click qua được dialog gốc trình
duyệt, các action này verify qua integration test thay thế (rigor cao hơn
click UI đơn thuần).

## FRESH DB TEST

Đã chạy lại từ đầu: `docker compose down -v` (xoá sạch volume) →
`docker compose up -d` → `prisma migrate deploy` (production-style, không
phải `migrate dev`) → `bootstrap-founder` → `next build` → unit test →
integration test — **tất cả PASS từ database rỗng hoàn toàn**.

## LEGACY SALVAGE USED

Auth pattern (JWT/bcrypt) từ ZenithTasks (viết mới, không copy file); ý
tưởng test cross-tenant trên DB thật từ `v2-write-denial.itest.ts`; nguyên
tắc "escape hatch có tài liệu, scoped rõ" từ `bypassTenantFilter`. Chi tiết
đối chiếu: `docs/legacy/SALVAGE_LEDGER.md` mục "Security comparison".

## SECURITY RISKS (còn mở, không phải HARD BLOCK)

1. `AuditEvent` chưa có DB-level trigger chống UPDATE/DELETE trực tiếp.
2. Không có session revocation list/tokenVersion — JWT bị lộ trước khi đổi
   mật khẩu vẫn còn hiệu lực tới hết hạn 30 ngày (trừ khi user bị suspend).
   Không liên quan tenant isolation; ghi nhận cho Phần tương lai nếu threat
   model cần.
3. Composite FK/DB constraint cho Finance/Healthcare (đã cam kết ở
   TENANT_INVARIANTS.md) chưa áp dụng vì các domain đó chưa tồn tại — nhắc
   lại để Phần 5/6/7 không quên.

## DEFERRED ITEMS

Position/Assignment/OrganizationUnit/Project/WorkItem (Phần 4) · role
builder UI · email invitation service (hiện chỉ hỗ trợ thêm User đã có sẵn
qua email) · break-glass access · user impersonation · hard delete Company
có dữ liệu · transfer-ownership UI riêng (hiện đổi Owner qua
update-role, do một Owner khác thực hiện) · multi-ecosystem UX đầy đủ (data
model đã hỗ trợ, UI chưa cần).

## DO NOT REDO

- Không thiết kế lại authorization foundation — đã xong, đã test, đã
  red-team.
- Không thêm bất kỳ code nào dạng `if (role === "ADMIN"/"FOUNDER") return
  true` để cấp quyền một Company cụ thể — đây là bài học đắt giá nhất của
  toàn dự án, đã chặn ở nhiều lớp (permission registry, resolver,
  company-context, test, code review).
- Không tạo domain model Work/Organization/Project trong `schema.prisma`
  trước khi thật sự bắt đầu Phần 4.

## NEXT

Phần 4 — Work + Organization + Project Foundation. Xem
`docs/project/CURRENT_WAVE.md` để biết input đã sẵn sàng.
