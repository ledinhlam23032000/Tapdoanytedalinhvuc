# Glossary — Canonical Terminology

Terminology ở đây khóa cứng. Code, docs, UX mới đều phải dùng cột **Canonical**.
Cột **Legacy** chỉ còn ý nghĩa lịch sử/tương thích khi salvage từ ZenithTasks.

| Canonical | Nghĩa | Legacy (ZenithTasks) — KHÔNG dùng cho khái niệm mới |
|---|---|---|
| Ecosystem | Ranh giới cấp cao nhất của Founder; chứa nhiều Company | "Global" (thường bị hiểu nhầm = toàn database) |
| Company | Tenant cấp một — nơi dữ liệu business sống | `ZProject` khi được dùng để đại diện công ty/chi nhánh/tenant |
| Branch | Chi nhánh — mặc định thuộc về một Company, không phải Company riêng | — |
| Department / Team / Function | Đơn vị tổ chức bên trong Company | `ZOrganizationUnit` (giữ concept, đổi scope sang companyId) |
| Project | Nơi một mục tiêu có vòng đời diễn ra, nằm **bên trong** Company | `ZProject` khi dùng đúng nghĩa dự án |
| Module | Năng lực (CRM, Sales, Finance, Payroll, Inventory, Healthcare) mà Company có | "Lego Modules" (không phải thuật ngữ user-facing chính) |
| Ecosystem AI / AI Tổng | AI scope = ECOSYSTEM, thuộc Founder, aggregate xuyên Company theo quyền | "AI GLOBAL" / "Global Agent" |
| Company AI | AI scope = COMPANY, vận hành một Company | "AI CHILD" / "Child Agent" |
| Specialist AI | AI scope hẹp hơn Company (đơn vị/dự án) nếu cần về sau | — |
| Membership | Quan hệ User ↔ (Ecosystem hoặc Company) kèm role/permissions | `ZProjectMember` (giữ concept, đổi thành CompanyMembership khi migrate) |
| Decision / Cần quyết định | Việc cần con người phê duyệt, bất kể nguồn backend là gì | "Approval" (vẫn dùng nội bộ, nhưng user-facing ưu tiên "Cần quyết định") |
| Approval | Cơ chế kỹ thuật cho một Decision cần duyệt | — |

## Bổ sung sau Phần 2 (Target Domain Architecture)

Chi tiết đầy đủ ở `docs/architecture/DOMAIN_MODEL.md`. Chốt thêm terminology:

| Canonical | Nghĩa | Legacy (ZenithTasks) |
|---|---|---|
| OrganizationUnit | Branch/Department/Team/Function/Business Unit — cây tổ chức trong Company | `ZOrganizationUnit` |
| Position | Chức danh tổ chức (VD "Bác sĩ Tim mạch"), KHÔNG phải quyền hệ thống | `ZProjectPosition` |
| Assignment | Gán User giữ một Position trong Company | `ZProjectAssignment` (dead code ở legacy) |
| Project | Mục tiêu có vòng đời, luôn thuộc một Company, không sở hữu Customer/Payroll/Ledger riêng | `ZProject` (một phần), Plan cũ không tương đương |
| WorkItem | Một engine việc duy nhất cho Task công ty/phòng ban/dự án | `Plan`/`PlanTask` (legacy) + `ZWorkspaceTask` (V2) — hội tụ thành một |
| Agent | AI có `scopeType` (ECOSYSTEM/COMPANY/ORG_UNIT/PROJECT) và `class` (ORCHESTRATOR/OPERATOR/SPECIALIST/WATCHER) — hai chiều độc lập | `ZAiAgent` (GLOBAL/CHILD — một chiều, gộp nhầm 2 khái niệm) |
| Decision Inbox | Nơi user thấy mọi "Cần quyết định" hội tụ, bất kể nguồn lưu trữ vật lý nào | `PaymentRequest` (pattern gần nhất, salvage) |
| rolePreset | Named permission package gắn với `EcosystemMembership`/`CompanyMembership` | `Role` enum global (Clinic) |

## Nguyên tắc dùng Glossary

- Không để terminology trôi qua từng phiên — mỗi khi có khái niệm mới, thêm
  vào bảng này trước khi dùng rộng rãi trong code/docs.
- Tên bảng/field vật lý trong Prisma của ZenithTasks (`ZProject`, `projectId`,
  ...) được PHÉP tồn tại tạm thời ở tầng migration/compatibility khi salvage,
  nhưng phải có comment/ghi chú rõ: "legacy physical model representing X
  during migration" — không dùng làm domain model đích cho code mới trong
  Tapdoanytedalinhvuc.
- "Công ty" trong hội thoại với chủ dự án = **Company**. "Dự án"/"chi
  nhánh"/"phòng ban" không bao giờ là Company.
