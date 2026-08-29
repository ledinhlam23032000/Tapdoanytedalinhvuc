# Checkpoint — Phần 2 hoàn tất

(Checkpoint Phần 1 vẫn xem được ở lịch sử git — `git log --oneline` — commit
"Part 1: product genesis...". File này chỉ giữ checkpoint MỚI NHẤT theo đúng
Source of Truth Hierarchy.)

PHASE 2 STATUS: **COMPLETE** — `PART_2_COMPLETE`, `READY_FOR_PART_3`

TARGET HEAD: xem commit ngay sau checkpoint này (`git log -1`).

LEGACY HEAD OBSERVED: `e420e3809b788f4f130db082dd798fe5e9e71b3a` (không đổi
so với Phần 1 — không có hoạt động mới nào trên ZenithTasks).

## COMPLETED

1. Đọc toàn bộ Master Prompt Phần 2 (dòng ~3615–7793/54203 của
   `master_prompt.md` convert từ docx).
2. Thiết kế Domain Model đầy đủ: Ecosystem, EcosystemMembership, Company,
   CompanyMembership, OrganizationUnit, Position, Assignment, Project,
   ProjectMembership, WorkItem, generic business domains (Customer/
   Appointment/Sale/LedgerEntry/PayrollRun/Inventory), Healthcare vertical
   boundary, Agent (AI scope), Approval/Audit cross-cutting — có ERD Mermaid
   + trả lời đủ 10 acceptance scenario + 12 câu hỏi entity relationship bắt
   buộc (mục CI).
3. Data Ownership Matrix đầy đủ theo Master Prompt mục CIII.
4. Tenant Invariants: threat model 10 vector (mục CIV) + acceptance test
   hình thức cho từng invariant.
5. Security Boundaries: Identity/Permission, AI safety, Audit, Secrets,
   Platform Operator.
6. Legacy → Target Map theo từng model/entity (bổ sung Legacy Capability
   Matrix theo capability của Phần 1).
7. 5 ADR mới (ADR-007 đến ADR-011): Ecosystem boundary, Project trong
   Company không nullable, Identity tách Membership/Role, Organization
   trong Company, Migration greenfield qua import/cutover.
8. **Red-team + Simplicity adversarial review** (workflow 2 agent độc lập,
   mỗi agent tự đọc toàn bộ 7-8 doc + Legacy Capability Matrix, có trích dẫn
   nguyên văn cho mọi kết luận) — xem `docs/architecture/RED_TEAM_REVIEW.md`.
9. Sửa toàn bộ 3 vấn đề P1 + 5 vấn đề P2 mà review tìm được (0 P0).

## PRODUCT INVARIANTS CONFIRMED

Company ≠ Project (ADR-003/008) · Company ≠ Branch (ADR-010) · Ecosystem ≠
toàn database (ADR-007) · User ≠ Role (ADR-009) · Position ≠ Permission ·
Project ≠ chủ sổ Ledger · Healthcare ≠ Product Core (ADR-004) · AI Scope ≠
Client input — cả 8 ranh giới này đã được red-team cố tình tấn công và xác
nhận vững (4/8 không tìm được gap; 4/8 tìm được gap nhỏ, **đã sửa hết**).

## DOMAIN MODEL

Xem `docs/architecture/DOMAIN_MODEL.md`. Điểm mấu chốt sau khi sửa theo
review: `Agent.scopeType` chỉ còn `ECOSYSTEM | COMPANY` (không phải 4 giá
trị); `Company.type` chỉ còn `GENERAL | HEALTHCARE | OTHER`; `Company.status`
có `DRAFT` dứt điểm; `Customer` không có cột `projectId` trực tiếp (chỉ qua
`ProjectCustomer` tương lai); `Assignment` giữ lại với lý do cụ thể (kiêm
nhiệm + lịch sử chuyển vị trí, không phải vì domain law trừu tượng).

## DATA OWNERSHIP DECISIONS

Xem `docs/architecture/DATA_OWNERSHIP.md`. Không có UNKNOWN ở core entity —
chỉ còn UNKNOWN ở mức phân loại record `ZProject` cụ thể (việc của migration
tooling Phần 10, không phải thiếu sót thiết kế).

## TENANT SECURITY DECISIONS

Xem `docs/architecture/TENANT_INVARIANTS.md` + `SECURITY_BOUNDARIES.md`.
Hai quyết định mới quan trọng nhất sau review: (1) Composite FK/DB
constraint **bắt buộc** (không phải "cân nhắc") cho Finance + Healthcare;
(2) `FOUNDER`/`ECOSYSTEM_ADMIN` không tự động ghi được vào một Company cụ
thể (kể cả qua AI) nếu không có `CompanyMembership` tường minh trên đúng
Company đó — đây là ranh giới trực tiếp ngăn lặp lại lỗ hổng ADMIN-bypass
thật đã tìm thấy ở ZenithTasks (Legacy Capability Matrix mục L-V01), dưới
mọi hình dạng có thể tái xuất hiện (role trùng tên, AI ghi thay).

## LEGACY MAPPING SUMMARY

`docs/architecture/LEGACY_TO_TARGET_MAP.md` — cover đủ domain chính theo
Master Prompt mục CXXXIII: Clinic, Multi-company V2, AI, Finance, Payroll,
CRM, Work, Organization, Permissions, Approval, Audit.

## ADRs CREATED

ADR-007 (Ecosystem boundary) · ADR-008 (Project trong Company, không
nullable) · ADR-009 (Identity tách Membership/Role) · ADR-010 (Organization
trong Company, Branch ≠ tenant) · ADR-011 (Migration qua import/cutover).

## OPEN ARCHITECTURE RISKS

1. Composite FK cho Finance/Healthcare mới là quyết định nguyên tắc — thiết
   kế schema Prisma cụ thể (kiểu constraint nào, có khả thi 100% với Prisma
   hay cần raw SQL/trigger) chưa verify kỹ thuật, để Phần 3 làm spike nếu
   cần (mục CXXV Architecture Spikes).
2. Đánh giá PostgreSQL Row-Level Security (RLS) làm lớp phòng thủ thứ hai —
   chưa quyết định dùng hay không, chỉ ghi nhận nên đánh giá ở Phần 3.
3. Mâu thuẫn tài liệu về trạng thái migrate V2 production của ZenithTasks
   (ghi từ Phần 1, chưa giải quyết, không ảnh hưởng Phần 2/3 vì
   Tapdoanytedalinhvuc không đọc DB ZenithTasks ở giai đoạn này).

## DECISIONS DEFERRED

`Agent.scopeType` ORG_UNIT/PROJECT (chờ use case cụ thể + ADR riêng) ·
`Company.type` AESTHETICS/DISTRIBUTION/SERVICE/RETAIL (chờ Company thật
thuộc loại đó) · Cross-company Project collaboration (Lead Company +
Participant Companies) · `ProjectCustomer` join table · Feature
configuration primitives (xoá khỏi Platform list, thêm lại khi có driver cụ
thể) · Assignment có thể defer nếu tới đầu Phần 3 vẫn chưa có workflow kiêm
nhiệm/chuyển vị trí thật cần dùng.

## TESTS — RESULTS

Phần 2 không có test code (docs-only theo đúng phạm vi mục CXXIV). "Test"
của Phần 2 là review đối kháng: 2/2 reviewer hoàn thành, 0 P0, 3 P1 + 5 P2
tìm được và đã sửa hết — xem `docs/architecture/RED_TEAM_REVIEW.md` để có
bảng đầy đủ câu hỏi/kết luận/mức độ.

## NEXT

Phần 3 — Ecosystem + Company + Identity + Membership + Permission + Tenant
Security Foundation. Đây là phase implement thật đầu tiên (Prisma schema,
auth, enforcement code, negative test thật). Xem
`docs/project/CURRENT_WAVE.md` để biết input đã sẵn sàng.

## DO NOT REDO

- Không thiết kế lại Domain Model từ đầu — đã có, đã qua red-team.
- Không thêm `Agent.scopeType` ORG_UNIT/PROJECT hay `Company.type` mới nếu
  chưa có use case cụ thể + ADR (xem PROJECT_STATE.json mục doNotRedo).
- Không để bất kỳ role nào (`FOUNDER`, `ECOSYSTEM_ADMIN`, hay tên tương lai
  nào có vẻ "admin") tự động bypass `CompanyMembership` check khi ghi vào
  một Company cụ thể — kể cả qua AI. Đây là bài học đắt giá nhất rút ra từ
  toàn bộ Phần 1+2, đừng lặp lại dưới bất kỳ tên gọi mới nào ở Phần 3.
