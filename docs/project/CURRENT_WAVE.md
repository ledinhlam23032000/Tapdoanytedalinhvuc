# Current Wave

**Phần 3 — Ecosystem + Company + Identity + Membership + Permission +
Tenant Security Foundation: HOÀN TẤT.** Implementation thật (không chỉ
docs): Prisma schema, auth, permission resolver, Company lifecycle, minimal
UI, 24 integration test PASS, adversarial code review PASS (0 P0/P1, 2 P2
đã sửa) — xem `docs/checkpoints/LATEST.md`.

**Tiếp theo: Phần 4 — Work + Organization + Project Foundation.**

Trước khi bắt đầu Phần 4, đọc đúng đoạn tương ứng trong
`MASTER PROMPT — TAPDOANYTEDALINHVUC.docx` (bắt đầu từ dòng ~12364, "PART 4
--- WORK + ORGANIZATION + PROJECT FOUNDATION", tới trước "PHẦN 5" khoảng
dòng ~16745). Nếu file convert `master_prompt.md` trong scratchpad không
còn, convert lại bằng
`pandoc -t markdown "MASTER PROMPT — TAPDOANYTEDALINHVUC.docx" -o master_prompt.md`
rồi `grep -n "PART 4\|PHẦN 5"` để định vị lại range.

## Input đã sẵn sàng cho Phần 4

- `docs/architecture/DOMAIN_MODEL.md` mục Organization/Project/Work Core —
  schema conceptual đã có sẵn (`OrganizationUnit`, `Position`, `Assignment`,
  `Project`, `ProjectMembership`, `WorkItem`).
- `src/lib/authorization/company-context.ts` — `AuthorizedCompanyContext`
  đã có sẵn, Phần 4 build domain mới TRÊN nền này, không viết lại
  authorization.
- `src/lib/permissions/registry.ts` — reserved prefix `work.` sẵn sàng mở
  permission thật khi Work Core tồn tại (mục CCXXVI Master Prompt: chỉ
  implement check khi domain đã có).
- `docs/architecture/LEGACY_TO_TARGET_MAP.md` mục Legacy Role Map — đã
  phân loại DOCTOR/NURSE/TELESALE/... là PROFESSIONAL ROLE → `Position`,
  input trực tiếp cho thiết kế `Position`/`Assignment` thật ở Phần 4.

## Việc CHƯA làm ở Phần 3 (đúng phạm vi, không phải thiếu sót)

Position/Assignment/OrganizationUnit/Project/WorkItem — mới có ở
DOMAIN_MODEL.md conceptual, CHƯA có trong `prisma/schema.prisma` (mục
CCXXIII-CCXXV Master Prompt Phần 3: cố tình không tạo trước — "Do not
create Task/Project/Organization foundation in Part 3. Part 4."). Sinh viên
kế tiếp không cần lo đây là bug.
