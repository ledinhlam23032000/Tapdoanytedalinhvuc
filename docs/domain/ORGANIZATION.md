# Organization (Phần 4 — implemented)

Cơ cấu tổ chức bên trong một Company: `OrganizationUnit` (cây đơn vị) +
`Position` (chức danh) + `Assignment` (ai giữ vị trí nào, ở đơn vị nào, từ
lúc nào). Xem `docs/architecture/DOMAIN_MODEL.md` mục "Organization" cho
thiết kế conceptual gốc (Phần 2) — file này ghi lại implementation thật.

## OrganizationUnit

Cây tự tham chiếu (`parentId`) trong phạm vi 1 `companyId`. `type` là enum
đóng (`BRANCH | DEPARTMENT | TEAM | FUNCTION | BUSINESS_UNIT`) — không tạo
entity riêng cho Branch (Law XXVII: Branch KHÔNG mặc định là Company).
Archive chặn nếu còn đơn vị con ACTIVE hoặc còn Assignment ACTIVE tham chiếu
đơn vị đó — tránh mồ côi dữ liệu con.

## Position — ADR-013: template cấp Company, không gắn Unit

`Position` KHÔNG có field `organizationUnitId`. Một chức danh ("Trưởng
phòng") là định nghĩa tĩnh cấp Company; nơi một người *đang* giữ chức danh
đó nằm ở `Assignment.organizationUnitId`, không ở Position. Lý do: nếu
Position gắn cứng 1 Unit, mỗi chi nhánh cần Position riêng ("Trưởng phòng —
Hà Nội", "Trưởng phòng — Hải Phòng") — trùng lặp không cần thiết khi bản
chất là cùng một chức danh áp dụng nhiều nơi.

## Assignment — nơi kiêm nhiệm/lịch sử tổ chức sống

`Assignment{userId, positionId, organizationUnitId?, status, startAt, endAt}`.
Nhiều dòng ACTIVE đồng thời cho cùng `userId` = kiêm nhiệm. `endAt` set khi
`endAssignment()` gọi = lịch sử chuyển vị trí/chi nhánh có ngày rõ ràng. Bất
biến bắt buộc: **Assignment chỉ tạo được khi `userId` đã có `CompanyMembership`
ACTIVE trên đúng Company đó** (mục XVIII Master Prompt) — Assignment không
tự cấp quyền hệ thống (Position ≠ Permission, Law XX); nó chỉ là organizational
identity. Muốn actor có quyền, vẫn phải qua `CompanyMembership.rolePreset`.

## Tenant isolation

Mọi FK cross-entity (`parentId`, `positionId`, `organizationUnitId` trên
Assignment) được validate tường minh cùng `companyId` trước khi dùng
(`assertSameCompanyUnit`/`assertSameCompanyPosition` trong
`src/lib/domain/organization-service.ts`) — không dựa vào việc ID "trông hợp
lệ". Xem `src/lib/__tests__/tenant-isolation-part4.itest.ts` cho test cụ thể
(gán Position của Company khác, gán unit cha thuộc Company khác, gán người
không phải thành viên Company).

## Quyền

`organization.view` / `organization.manage` (cấu trúc Unit + Position),
`people.view` / `people.assign` (Assignment) — 4 permission key riêng biệt vì
"xem cơ cấu" và "sửa cơ cấu" là hai nhu cầu khác nhau, và MANAGER cần
`people.assign` (gán nhân sự vào vị trí có sẵn) nhưng KHÔNG cần
`organization.manage` (tạo/xoá Unit/Position là quyết định cấp cao hơn) —
xem `src/lib/permissions/presets.ts`.
