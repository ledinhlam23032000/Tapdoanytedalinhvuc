# Work Core (Phần 4 — implemented)

**Một engine `WorkItem` duy nhất cho mọi loại việc** — việc công ty, việc
phòng ban, việc dự án — không có `ProjectTask`/`ClinicTask`/`AiTask` riêng
(ADR-014). Đây trực tiếp sửa lỗi kiến trúc thật đã xảy ra ở ZenithTasks: hai
engine song song `Plan`/`PlanTask` (AI draft, có hierarchy/reorder) và
`ZWorkspaceTask` (mỏng hơn) không bao giờ hội tụ. `WorkItem` hợp nhất cả hai
thành một bảng, một service, một UI.

## Model

`WorkItem{companyId, organizationUnitId?, projectId?, title, description?,
status, priority, assigneeUserId?, createdByUserId, dueAt?, startedAt?,
completedAt?}`. `organizationUnitId`/`projectId` là attribution optional —
một WorkItem luôn thuộc đúng 1 Company, có thể (không bắt buộc) gắn thêm vào
1 đơn vị tổ chức và/hoặc 1 Project.

## Vòng đời

`TODO → IN_PROGRESS → DONE`, hoặc `→ CANCELLED` từ TODO/IN_PROGRESS. Không
có bước "REOPEN" ở Phần 4 (chưa có nhu cầu thật cụ thể — thêm khi có, không
pre-bake).

## Quyền tạo/giao việc (mục XXVI-XXXIV)

- `work.create` — tạo WorkItem. Nếu không set `assigneeUserId`, hoặc set
  đúng bằng chính actor, KHÔNG cần thêm quyền gì — tự-giao-việc-cho-mình là
  hành vi tối thiểu mọi Company Member cần có.
- `work.assign` — bắt buộc CHỈ khi giao việc cho MỘT NGƯỜI KHÁC (lúc tạo
  hoặc qua `assignWorkItem`). Người được giao phải có `CompanyMembership`
  ACTIVE trên đúng Company đó (không giao được người Company khác).
- Sửa/bắt đầu/hoàn thành 1 WorkItem cụ thể: cho phép nếu actor có
  `work.manage` (quản trị toàn Company), HOẶC actor chính là
  `assigneeUserId`/`createdByUserId` của WorkItem đó
  (`canActOnWorkItem()` trong `work-service.ts`). Một Viewer/Member khác
  không liên quan tới WorkItem đó — kể cả cùng Company — không sửa được.

## ADR-015 — Visibility: SELF vs COMPANY, không phải per-task ACL

`getCompanyWork()` chia đúng 2 tầng: actor có `work.assign` (MANAGER trở
lên) → thấy toàn bộ WorkItem của Company; actor không có (MEMBER/VIEWER) →
chỉ thấy WorkItem mình tạo hoặc được giao. Cố tình đơn giản — không xây ACL
theo từng dòng WorkItem (share với người X, ẩn khỏi người Y) vì Master
Prompt Phần 4 không có ví dụ thật cần độ chi tiết đó; nếu sau này có, thêm
bảng chia sẻ riêng khi có ca cụ thể, không mở rộng `getCompanyWork()` thành
generic ACL engine trước.

## "Hôm nay" — xếp hạng quyết định (mục XLIX/CXLII)

`src/lib/domain/work-priority.ts` — hàm thuần, không DB, unit test đầy đủ ở
`src/lib/domain/__tests__/work-priority.test.ts`. Thứ tự tier (0 = khẩn cấp
nhất): quá hạn+khẩn cấp → quá hạn → hôm nay+khẩn cấp → hôm nay → sắp
tới+ưu tiên cao/khẩn cấp → bình thường. "Hôm nay" tính theo múi giờ
`Company.timezone`, không phải lịch UTC của server (mục CLXXXVII) —
`dateKeyInTimezone()` dùng `Intl.DateTimeFormat` để so ngày theo đúng múi
giờ đó. Đây là logic quyết định (deterministic), không phải AI suggestion —
AI (Phần 8) chỉ được giải thích/gợi ý thêm sau này, không thay thế nó (mục
L).

## Tenant isolation

`organizationUnitId`/`projectId`/`assigneeUserId` trên WorkItem đều được
validate cùng `companyId` trước khi ghi (`assertSameCompanyOrganizationUnit`/
`assertSameCompanyProject`/`assertActiveCompanyMember` trong
`work-service.ts`). Thao tác trực tiếp lên `WorkItem.id` biết trước từ
Company khác vẫn bị chặn ở `assertSameCompanyWorkItem` (404-shape qua
`AuthorizationError`, không lộ có tồn tại hay không).
