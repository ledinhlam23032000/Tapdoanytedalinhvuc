# Checkpoint — Phần 1 hoàn tất

DATE/TIME: 2026-08-30 (giờ máy: khoảng 02:xx, xem git commit timestamp để
chính xác)

PHASE 1 STATUS: **COMPLETE** (15/15 bước theo Master Prompt mục LXXVI)

TARGET HEAD: xem commit ngay sau checkpoint này (`git log -1`) — sẽ là commit
đầu tiên chứa toàn bộ Phần 1.

LEGACY HEAD OBSERVED: `e420e3809b788f4f130db082dd798fe5e9e71b3a`
(2026-08-29 22:34:39 +0700, branch `master`)

## COMPLETED

1. Recon môi trường: Node v24.18.0, npm 11.16, Docker 29.7.2 có sẵn, không
   có `psql` local (dùng Docker Postgres thay thế), `git` có, `gh` CLI có
   nhưng **chưa đăng nhập** (xem BLOCKERS).
2. Xác minh target repo (`Tapdoanytedalinhvuc`, GitHub public, trước đó chỉ
   có README.md + 1 commit) và legacy repo (`ZenithTasks`, GitHub public,
   dự án thật đang chạy production cho 1 phòng khám thẩm mỹ).
3. Đọc toàn bộ `MASTER PROMPT — TAPDOANYTEDALINHVUC.docx` phần Phiên 1
   (dòng 1–~3615/54203 dòng — phần còn lại là Phần 2–10, chưa cần đọc).
4. Đọc ~94% `tổng nhận xét dự án của chúng ta.docx` (audit 4 phiên: chẩn
   đoán → kiến trúc → UX → kế hoạch cứu — phần cuối là MASTER PROMPT cũ dành
   cho sửa ZenithTasks tại chỗ, đã bị override, không cần đọc hết).
5. Khảo cổ ZenithTasks bằng workflow 5 agent song song (Core/Data Model,
   Business Domains, AI Runtime, UX/Navigation, QA/Security/Docs) — mỗi agent
   đọc trực tiếp source/schema/test/CHANGELOG thật, có evidence file:line.
   Kết quả đầy đủ: `docs/legacy/LEGACY_CAPABILITY_MATRIX.md` +
   `docs/legacy/SALVAGE_LEDGER.md`.
6. Tạo toàn bộ Project Memory: `CLAUDE.md`, `docs/product/*`,
   `docs/architecture/*`, `docs/legacy/*`, `docs/project/*`,
   `docs/checkpoints/LATEST.md`, `PROJECT_STATE.json`.
7. Bootstrap kỹ thuật tối thiểu: Next.js 16.3.3 + React 19.2.8 + TypeScript +
   Tailwind v4 + Prisma 7.9.1 (`@prisma/adapter-pg`) + PostgreSQL 16 (Docker,
   port 5442, cô lập khỏi ZenithTasks) + Vitest 4.
8. Test: `npm run test` PASS, `npx tsc --noEmit` sạch, `npx eslint .` sạch,
   `npx next build` PASS, xác nhận bằng browser thật (`/api/health` và `/`).

## PRODUCT DECISIONS

- Xây `Tapdoanytedalinhvuc` greenfield, `ZenithTasks` read-only legacy
  source. Không copy nguyên file, không rewrite mù quáng — salvage có chọn
  lọc (xem Salvage Ledger).
- Company ≠ Project là invariant trung tâm (ADR-003) — sai lầm lớn nhất của
  ZenithTasks phải sửa ngay từ domain model, không vá tiếp.
- Healthcare/Clinic là vertical đầu tiên, không phải toàn sản phẩm (ADR-004).

## ARCHITECTURE DECISIONS

ADR-001 (Greenfield repo) → ADR-006 (giữ stack Next.js/Prisma/Postgres) —
đầy đủ trong `docs/architecture/DECISIONS.md`.

## SALVAGE FINDINGS (tóm tắt — chi tiết trong Legacy Capability Matrix)

- AI Job engine V2 (`ZAiAgent`/`ZAiJob`, idempotency/approval/verify/audit,
  worker thật) là tài sản kỹ thuật tốt nhất nhưng **xác nhận hiện tại (không
  phải audit cũ)**: chưa có UI nào gọi được qua browser — chỉ chạy qua
  integration test. Nguồn: ledger nội bộ MC-24 (BLOCKED) + VERSION.md bản
  29/08 (mới nhất).
- Phát hiện lỗ hổng thật, có trích dẫn code: `v2-access.ts`/
  `v2-global-console-policy.ts` cho phép MỌI user có `Role.ADMIN` (role toàn
  cục của hệ Clinic) bypass hoàn toàn kiểm tra `ZProjectMember` trên MỌI
  "company" mô phỏng — đúng anti-pattern mà ADR-003 phải chặn.
- **Mâu thuẫn tài liệu chưa giải quyết được dứt điểm**: `BAN-GIAO.md` nói V2
  migration "chưa apply production"; `CHANGELOG.md` (cùng ngày 24/08, cập
  nhật sát code hơn) nói đã bật `ENABLE_ZENITH_V2=true` và apply 56 migration
  lên clinic. Ghi rõ trong Legacy Capability Matrix, **cần xác minh trực
  tiếp lại** ở Phần 2/3, không tự ý chọn một phía.
- 5 bug/gap cụ thể mới phát hiện (không có trong audit cũ, xác nhận hiện tại
  30/08): 2 Command Palette đè Ctrl+K nhau, route `/phe-duyet` gãy (regression
  từ commit 28/08, không phải nợ cũ), rò rỉ branding "ZenithTasks" ra UI,
  double-revenue-count bug khi 1 người vừa consultant vừa doctor, và pattern
  lỗi lặp lại "toolAllowlist khai báo nhưng dispatcher không xử lý" (đã xảy
  ra ≥3 lần cùng 1 lớp lỗi).

## TESTS — RESULTS

`npm run test` 1/1 PASS · `npx tsc --noEmit` 0 lỗi · `npx eslint .` 0
lỗi/cảnh báo · `npx next build` PASS (3 route) · browser check `/api/health`
+ `/` PASS (xem `docs/project/CURRENT_STATE.md`).

## OPEN RISKS

1. Mâu thuẫn tài liệu về trạng thái migrate V2 production của ZenithTasks
   (xem trên) — chưa verify trực tiếp qua DB/`prisma migrate status` thật.
2. `npm audit`: 3 lỗi high (dependency bắc cầu `deepmerge-ts` qua
   `@prisma/config`, thuộc Prisma CLI 7.x) — theo dõi, không block.
3. Double-revenue-count bug ở ZenithTasks (consultant=doctor cùng người)
   đang dở dang fix — đừng salvage số liệu hoa hồng hiện tại làm ground
   truth cho Phần 6.

## BLOCKERS

Không có HARD BLOCK theo định nghĩa Master Prompt (thiếu credential production,
cần hành động irreversible, chi phí lớn, ambiguity dữ liệu tài chính/y tế
nguy hiểm, quyết định pháp lý...). `git push` lên `origin/main` đã thực hiện
thành công (credential Git sẵn có trên máy dù `gh auth status` báo chưa đăng
nhập — 2 hệ thống xác thực khác nhau) — không có blocker về repository.

## NEXT

Phần 2 — Target Domain Architecture. Xem hướng dẫn resume chi tiết trong
`docs/project/CURRENT_WAVE.md`.

## DO NOT REDO

Xem `PROJECT_STATE.json` mục `doNotRedo` — quan trọng nhất: đừng đọc lại
toàn bộ 2 file DOCX gốc, đừng chạy lại workflow khảo cổ 5-agent trừ khi cần
xác minh 1 claim cụ thể mới, đừng copy nguyên file ZenithTasks, đừng động
vào ZenithTasks hoặc dữ liệu production của nó.
