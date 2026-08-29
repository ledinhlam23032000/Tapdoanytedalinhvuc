# Current Wave

**Phần 2 — Target Domain Architecture + Data Ownership + Tenant Boundaries +
Migration Contracts: HOÀN TẤT** (đã qua red-team + simplicity review đối
kháng, tất cả P1/P2 tìm được đã sửa — xem `docs/architecture/RED_TEAM_REVIEW.md`).

**Tiếp theo: Phần 3 — Ecosystem + Company + Identity + Membership +
Permission + Tenant Security Foundation.** Đây là phase bắt đầu implement
thật (Prisma schema thật, auth, enforcement code) — không còn chỉ là docs.

Trước khi bắt đầu Phần 3, đọc đúng đoạn tương ứng trong
`MASTER PROMPT — TAPDOANYTEDALINHVUC.docx` (bắt đầu từ dòng ~7794, "PART 3
--- ECOSYSTEM + COMPANY + IDENTITY + PERMISSION FOUNDATION"). Nếu file convert
`master_prompt.md` trong scratchpad không còn, convert lại bằng
`pandoc -t markdown "MASTER PROMPT — TAPDOANYTEDALINHVUC.docx" -o master_prompt.md`
rồi `grep -n "PART 3\|PART 4"` để định vị lại range.

## Input đã sẵn sàng cho Phần 3 (không cần thiết kế lại từ đầu)

- `docs/architecture/DOMAIN_MODEL.md` — schema conceptual đầy đủ, đã qua
  red-team review, đã sửa xong mọi gap tìm được.
- `docs/architecture/TENANT_INVARIANTS.md` — acceptance test bắt buộc phải
  có code thật tương ứng ở Phần 3. **Đặc biệt chú ý 2 điểm mới chốt sau
  review**: (1) `ECOSYSTEM_ADMIN`/`FOUNDER` không tự động ghi được vào một
  Company cụ thể nếu không có `CompanyMembership` tường minh trên Company đó
  — kể cả khi ghi qua AI; (2) composite FK/DB constraint là **bắt buộc**
  (không tuỳ chọn) cho quan hệ cross-entity trong Finance và Healthcare.
- `docs/architecture/SECURITY_BOUNDARIES.md`, `docs/architecture/DATA_OWNERSHIP.md`.
- `docs/architecture/LEGACY_TO_TARGET_MAP.md` — mapping model-by-model, biết
  ngay ZenithTasks nào KEEP/REMAP/RETIRE/MERGE.
- ADR-001 đến ADR-011 trong `docs/architecture/DECISIONS.md`.

## Việc CHƯA làm ở Phần 2 (đúng phạm vi, không phải thiếu sót)

Không có Prisma schema thật nào ngoài `HealthCheck` bootstrap của Phần 1 —
Phần 2 chỉ là conceptual design (đúng theo mục CXXIV Master Prompt: "KHÔNG
IMPLEMENT FULL DATABASE"). Phần 3 mới bắt đầu viết schema Ecosystem/Company/
Membership thật + auth + enforcement.
