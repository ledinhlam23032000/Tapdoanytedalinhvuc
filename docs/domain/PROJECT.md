# Project không phải Company

Đây là sai lầm kiến trúc lớn nhất của ZenithTasks (`ZProject` vừa đóng vai
Company, vừa Branch, vừa Project thật — xem ADR-003 trong
`docs/architecture/DECISIONS.md`) — Phần 4 tồn tại một phần để chứng minh nó
không lặp lại. Mọi thay đổi vào `Project`/`ProjectMembership` trong tương lai
phải giữ đúng ranh giới dưới đây.

## Project là gì

Một cấu trúc **có thời hạn** bên trong đúng 1 Company — một mục tiêu có
vòng đời (`PLANNED → ACTIVE → ON_HOLD → COMPLETED/CANCELLED → ARCHIVED`),
không phải một tenant, không phải một Company con.

## Project KHÔNG được phép có (kiểm tra lại mỗi khi thêm field/model mới)

- Không sở hữu `Customer`/`Ledger`/`Payroll`/`Sale` riêng — mọi dữ liệu
  business đó vẫn thuộc `Company`, Project chỉ *tham chiếu* qua attribution
  field optional khi các module đó tồn tại (Phần 5+).
- Không có identity/authorization riêng. `ProjectMembership.userId` **bắt
  buộc** đã có `CompanyMembership` ACTIVE trên đúng Company chứa Project đó
  (`assertActiveCompanyMember()` trong `project-service.ts`, mục LXIII Master
  Prompt) — không thể mời "người ngoài Company" vào một Project.
- Không thay thế/ẩn Company sidebar. UI Project (`src/app/c/[code]/projects/`)
  nằm bên trong layout Company hiện có (`CompanyNav`), không tự tạo shell
  điều hướng riêng (mục CLV).
- Không có engine việc riêng. Việc trong Project vẫn là `WorkItem` với
  `projectId` gắn thêm — xem `docs/domain/WORK_CORE.md`.

## Quyền quản lý: 2 đường, không trộn lẫn

1. **`project.manage`** (chỉ OWNER/COMPANY_ADMIN cấp Company) — quản lý MỌI
   Project trong Company, không cần là thành viên Project đó.
2. **Project OWNER-membership** — một actor không có `project.manage` cấp
   Company vẫn sửa được/thêm-thành-viên cho ĐÚNG Project họ là
   `ProjectMembership.rolePreset = OWNER` (`requireProjectManageAccess()`).
   Đây KHÔNG mở rộng thành quyền cấp Company: Project OWNER-membership
   không tự có `project.archive` (chỉ OWNER/COMPANY_ADMIN cấp Company mới
   lưu trữ được — xem test "ManagerA (Project OWNER-membership) KHÔNG archive
   được project" trong `tenant-isolation-part4.itest.ts`) và không có
   `work.assign` cấp Company chỉ vì sở hữu 1 Project.

Khi tạo Project, actor tạo (hoặc `ownerUserId` chỉ định) tự động nhận
`ProjectMembership{rolePreset: OWNER}` — để mọi truy vấn "dự án của tôi"
nhất quán qua `ProjectMembership`, không qua `Project.ownerUserId` (field đó
chỉ còn ý nghĩa hiển thị "ai là chủ dự án chính").

## Cross-company

`Project.companyId` bắt buộc, không nullable. Không có Project chia sẻ giữa
2 Company ở Phần 4 (hợp tác liên-Company là capability tương lai riêng, xem
`docs/architecture/DOMAIN_MODEL.md` mục Project).
