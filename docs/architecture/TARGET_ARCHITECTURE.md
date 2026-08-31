# Target Architecture

## Cập nhật Phần 5 (CRM + Sales + Appointment + Customer Operations — IMPLEMENTED)

`Customer`/`Lead`/`CustomerInteraction`/`Appointment`/`CatalogItem`/`Sale`/
`SaleLine` implement thật trên nền Company/Work Core đã có — không mở
boundary tenant mới, không có entity nào thuộc Project. Khác biệt kiến trúc
đáng chú ý so với Work Core (Phần 4): visibility CRM là **Company-wide theo
permission**, không tự-scope theo owner (ADR-022 — ngược với ADR-015 của
WorkItem, xem lý do trong `docs/domain/CRM.md`). Chi tiết:
`docs/domain/CRM.md`, `CUSTOMER.md`, `LEAD.md`, `APPOINTMENT.md`,
`SALES.md`. ADR-017 đến ADR-023 trong `DECISIONS.md`.

## Cập nhật Phần 4 (Organization + Work Core + Project — IMPLEMENTED)

Organization/Work Core/Project (mô tả conceptual bên dưới ở "Org Unit
meaning"/"Project meaning") giờ đã implement thật, không còn chỉ hướng đi:
`prisma/schema.prisma` (section "Phần 4"), `src/lib/domain/
organization-service.ts`/`work-service.ts`/`project-service.ts`,
`src/lib/domain/work-priority.ts`, UI dưới `src/app/c/[code]/{today,work,
organization,projects}/`. Chi tiết + lý do quyết định:
`docs/domain/ORGANIZATION.md`, `docs/domain/WORK_CORE.md`,
`docs/domain/PROJECT.md` (đọc trước khi sửa 3 domain này). ADR-013 đến
ADR-016 trong `DECISIONS.md`.

## Cập nhật Phần 2 (Target Domain Architecture — HOÀN TẤT)

Phần này của tài liệu (bên dưới) là hướng đi chốt ở Phiên 1 — vẫn đúng, giữ
nguyên làm tổng quan. Chi tiết đầy đủ (conceptual schema, ownership matrix,
tenant invariants, security boundaries, legacy→target mapping theo từng
model) đã chốt ở Phần 2, xem các file:

- `docs/architecture/DOMAIN_MODEL.md` — schema conceptual đầy đủ + ERD +
  10 acceptance scenario.
- `docs/architecture/DATA_OWNERSHIP.md` — ma trận ownership từng entity.
- `docs/architecture/TENANT_INVARIANTS.md` — threat model + acceptance test
  bắt buộc cho Phần 3.
- `docs/architecture/SECURITY_BOUNDARIES.md` — ranh giới Identity/Permission/
  AI safety/Audit/Secrets.
- `docs/architecture/LEGACY_TO_TARGET_MAP.md` — mapping theo từng
  model/entity (bổ sung Legacy Capability Matrix theo capability).
- `docs/architecture/RED_TEAM_REVIEW.md` — kết quả review đối kháng trước
  khi chuyển Phần 3.
- ADR-007 đến ADR-011 trong `docs/architecture/DECISIONS.md`.

## Nội dung gốc (Phiên 1 — hướng đi, chưa phải schema chi tiết)

Đây là target architecture direction chốt ở Phiên 1. Tài liệu này chỉ trả
lời các câu hỏi bắt buộc của Phiên 1 — đọc các file Phần 2 ở trên để có chi
tiết đầy đủ.

## Product boundary

Một AI-native multi-company operating system. Ranh giới sản phẩm: từ Founder
quản trị hệ sinh thái, xuống Company vận hành business, xuống Employee làm
việc hàng ngày — tất cả trong một ứng dụng, một domain model thống nhất.
Không phải microservices/nhiều sản phẩm rời rạc.

## Ecosystem boundary

Cấp cao nhất, thuộc về Founder. Một Ecosystem chứa nhiều Company. Ecosystem
là nơi AI Tổng tổng hợp chéo Company theo quyền, và nơi Founder tạo/tạm
dừng/lưu trữ Company. GLOBAL không còn nghĩa "toàn database" — GLOBAL nghĩa
là "trong phạm vi Ecosystem X".

## Company boundary

Tenant cấp một, first-class. Company sở hữu: Customer, Finance, HR, Payroll,
Inventory, Sales, Work, Appointment, Company AI. Company A không mặc định
đọc/ghi Company B — đây là invariant bắt buộc test ở mọi Phần từ Phần 3 trở
đi (cross-company denial test).

## Org Unit meaning

Branch / Department / Team / Function — nơi con người thuộc về bên trong một
Company. Có cấu trúc cây (parent/child). Không phải tenant riêng.

## Project meaning

Một mục tiêu có vòng đời (VD: mở chi nhánh Hà Nội, chiến dịch Tết, triển khai
HIS mới) nằm **bên trong** một Company. Project không tự động sở hữu
Customer/Ledger/Payroll riêng — nó tham chiếu dữ liệu của Company khi cần
(attribution qua `projectId?` optional trên các bản ghi Company-level).

## Core domains

Ecosystem, Company, Membership (Identity ≠ Permission), Organization, Work
(task/work item), Project, AI (Agent/Job/Approval/Verify/Audit) — nhóm "lõi
nhỏ" mà mọi Company luôn có, không bật/tắt được.

## Business modules (bật theo nhu cầu Company)

CRM, Sales, Finance, Payroll, Inventory, Messaging, HR mở rộng — gắn vào
Company, không gắn vào Project.

## Vertical domains

Healthcare/Aesthetics là vertical đầu tiên (kế thừa ZenithTasks Clinic).
Distribution, Service, Retail là vertical tiềm năng về sau — không xây trước
khi có nhu cầu thật (xem Product Constitution — không xây "framework để sau
này có thể...").

## AI position

AI là lớp xuyên suốt (Ecosystem AI, Company AI), không phải một module có thể
tắt. Vị trí kỹ thuật: ngồi trên business domain, gọi qua policy/scope
resolution — không bao giờ là superuser bỏ qua permission.

## Approval position

Approval là cơ chế thực thi cho High-Risk Action Principle (Plan → Preview →
Approve → Execute → Verify → Audit → Report). User-facing hội tụ thành một
khái niệm duy nhất: "Cần quyết định" / Decision, bất kể nguồn backend
(finance approval, payroll approval, AI action approval, config approval) —
unify EXPERIENCE trước, unify PHYSICAL STORAGE sau nếu thật sự cần.

## Audit position

Audit là platform-level capability (không phải business module), áp dụng cho
mọi hành động rủi ro — đặc biệt tài chính, payroll, xóa dữ liệu, quyền, nhân
sự, hồ sơ y tế, thay đổi Company, hành động cross-company. Audit log phải
dùng ngôn ngữ business khi hiển thị cho user thường; raw audit kỹ thuật chỉ
Technical Admin thấy.

## Legacy Clinic đi đâu

Bệnh viện Đa khoa Hồng Phúc trở thành **Company đầu tiên** = Company Core +
Healthcare Vertical. Không xóa, không rewrite big-bang. Nghiệp vụ generic
(Customer, Appointment, Payment, Payroll, Attendance) hướng về Company Core
khi migrate; nghiệp vụ y tế đặc thù (MedicalCase, Consultation, Consent,
Procedure, ClinicalPhoto, MedicalFollowUp) giữ trong Healthcare vertical.

## Parity sẽ đạt được như thế nào

Qua `docs/legacy/LEGACY_CAPABILITY_MATRIX.md`: mọi capability quan trọng của
ZenithTasks được liệt kê với Decision rõ ràng. Không capability nào biến mất
âm thầm. Migration chi tiết (bridge migration, domain facade, strangler
pattern theo wave) là nội dung Phần 2 trở đi — Phiên 1 chỉ chốt hướng, không
thực thi.

## Legacy data sẽ migrate như thế nào (hướng, chưa thực thi)

Nguyên tắc: **data continuity YES, architectural mistake continuity NO**. Dữ
liệu (mọi Customer, Case, payment, financial record, employee, audit,
healthcare data) phải được giữ; naming/abstraction sai (Project=Company,
global Clinic role) không được giữ. Migration ưu tiên additive → backfill →
domain facade → dual read/write khi cần → cutover → verify → deprecate —
không big-bang, không rename database hàng loạt trong một commit.

## Stack

Xem ADR-006 trong `docs/architecture/DECISIONS.md` — giữ nguyên stack đã
chứng minh của ZenithTasks: Next.js + Prisma + PostgreSQL + TypeScript +
Tailwind CSS + Vitest.
