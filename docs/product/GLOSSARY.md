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
