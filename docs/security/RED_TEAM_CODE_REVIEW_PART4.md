# Red-team Code Review — Phần 4 (Organization + Work Core + Project)

Theo cùng khuôn mẫu Phần 3 (`RED_TEAM_CODE_REVIEW.md`): 2 subagent độc lập,
mỗi agent tự đọc toàn bộ source code liên quan (không đọc lại session này),
không biết kết luận của agent kia. Agent 1 = tenant-isolation attacker
(cố vượt Company boundary). Agent 2 = simplicity/architecture-drift reviewer
(cố tìm dấu hiệu lặp lại sai lầm ZenithTasks: 2 engine việc song song,
Project mọc thành Company thứ hai, over-engineering).

**Kết quả sau khi sửa: PASS** (0 P0, 0 P1 còn mở). Trước khi sửa: agent 1 tìm
được đúng 1 P1 thật (không phải P0 — không có đường vượt Company A↔B nào).

## Agent 1 — Tenant isolation attack (7 câu hỏi)

| # | Câu hỏi | Kết luận |
|---|---|---|
| 1 | Cross-company ID injection trên mọi FK (Assignment.positionId/organizationUnitId, WorkItem.organizationUnitId/projectId/assigneeUserId, Project.owningUnitId, ProjectMembership.userId)? | NONE — mỗi FK đều có `assertSameCompany*`/`assertActiveCompanyMember` tường minh trước khi dùng |
| 2 | Privilege escalation (MEMBER/VIEWER chạm path bị cấm; Project OWNER-membership leak thành quyền cấp Company)? | NONE — preset khớp đúng comment; `archiveProject` cố ý gate bằng `project.archive` (không qua `requireProjectManageAccess`) nên Project OWNER-membership không tự archive được |
| 3 | `work.assign` self-serve carve-out (tự giao việc cho mình không cần `work.assign`) có bị lợi dụng giao cho người khác qua đường khác? | NONE — `assignWorkItem` luôn tự đòi `work.assign` độc lập |
| 4 | Suspended/Archived Company có chặn đủ mọi write path Phần 4? | **P1 — tìm thấy thật**: `updateProject`/`addProjectMember`/`completeProject` gate bằng `"project.view"` (permission cần thiết để còn dùng được nhánh Project-OWNER-membership fallback) — nhưng `"project.view"` nằm trong `READ_ONLY_PERMISSIONS` nên `isWriteAction()` coi 3 hàm này là "chỉ đọc", bỏ qua check `company.status === "ACTIVE"`. Company bị SUSPENDED/ARCHIVED vẫn cho sửa/thêm-thành-viên/hoàn-thành Project. |
| 5 | Server Action wrapper (`organization-actions.ts`/`work-actions.ts`/`project-actions.ts`) có luôn lấy actor từ `requireCurrentActor()` (cookie), không tin actorId client gửi? | NONE — mọi action chỉ dùng `actor.id` từ session; các id khác trong input (target userId, assigneeUserId) là target hợp lệ, được domain service tự re-check |
| 6 | `ecosystem.company.view_all` có bị dùng gián tiếp để có quyền organization./work./project.\* mà không có CompanyMembership thật? | NONE — nhánh đó trong `company-context.ts` hard-code trả về đúng `Set(["company.view"])`, không có organization/work/project nào |
| 7 | Đường nào khác cho Company A đọc/ghi dữ liệu Company B? | NONE |

**Verdict gốc của agent: FAIL (1 P1)** — đã sửa (xem bên dưới), không còn mở.

## Agent 2 — Simplicity / architecture-drift (7 câu hỏi)

| # | Câu hỏi | Kết luận |
|---|---|---|
| 1 | Đúng 1 Work engine (ADR-014), không có `ProjectTask`/`ClinicTask`/`Milestone` lén tạo? | NONE — chỉ 1 `WorkItem`; trang Project tái dùng thẳng `WorkTable` từ trang Work, không tự vẽ bảng riêng |
| 2 | Position không nhân bản theo Unit (ADR-013)? | NONE — `Position` không có `organizationUnitId`; UI chỉ hỏi đơn vị ở AssignmentForm |
| 3 | ADR-015 (2-tier SELF/COMPANY) không phình thành ACL per-row? | NONE cho visibility; có 1 sắc thái đáng ghi chú (P2, xem bên dưới) |
| 4 | Project không mọc Customer/Ledger/Payroll/identity riêng, không thay Company shell? | NONE trên cả 3 nhánh |
| 5 | Over-engineering / duplication / coupling sai? | **P2 — tìm thấy thật**: `assertSameCompanyOrganizationUnit`/`assertSameCompanyProject`/`assertActiveCompanyMember` bị viết lặp lại độc lập ở cả `organization-service.ts`/`work-service.ts`/`project-service.ts` |
| 6 | Dead code / half-finished path? | **P2 — tìm thấy thật**: `Project.startAt/dueAt/budgetAmount/owningUnitId` + `updateProject`/`updateProjectAction` nối đủ domain+action nhưng KHÔNG có UI nào gọi tới — vi phạm "chưa end-to-end thì chưa DONE" |
| 7 | UI tiếng Việt nhất quán, không rò enum? | Phần lớn NONE; 1 nitpick không cần sửa gấp (label `ProjectRolePreset` lặp 2 nơi thay vì dùng chung 1 map) |

Thêm 1 P2 agent tự phát hiện ngoài 7 câu hỏi: `work-table.tsx` (UI) thiếu
nhánh "người tạo" khi tính `mayAct` — domain `canActOnWorkItem()` cho phép
actor thao tác nếu là `work.manage` HOẶC assignee HOẶC **creator**, nhưng UI
chỉ check `canManage || assigneeUserId === currentUserId`, thiếu nhánh
creator (và không truyền `createdByUserId` xuống client).

**Verdict gốc của agent**: không có P1, nhưng khuyến nghị dọn 2 P2 (dead
UI path + UI/domain lệch nhau) trước khi khép Phần 4.

## Đã sửa sau review

1. **P1 (Suspended/Archived Company không chặn `updateProject`/
   `addProjectMember`/`completeProject`)** — thêm `assertCompanyWritable()`
   trong `src/lib/domain/project-service.ts`, gọi tường minh ngay sau
   `requireCompanyContextForActor()` ở cả 3 hàm, độc lập với cờ
   `isWriteAction()` (vốn không áp dụng được vì 3 hàm này bắt buộc gate bằng
   `"project.view"` để giữ nhánh Project-OWNER-membership fallback hoạt
   động). Test hồi quy: `tenant-isolation-part4.itest.ts` — "Company A
   suspended → updateProject/addProjectMember/completeProject trên project
   có sẵn cũng DENY".
2. **P2 (duplicate assert helpers)** — hợp nhất vào
   `src/lib/domain/scope-guards.ts` (`assertSameCompanyOrganizationUnit`,
   `assertSameCompanyProject`, `assertActiveCompanyMember`), cả 3 domain
   service import dùng chung thay vì tự viết lại.
3. **P2 (Project edit fields dead-end)** — thêm `EditProjectForm`
   (`src/app/c/[code]/projects/[projectId]/edit-project-form.tsx`) gọi
   `updateProjectAction`, hiển thị/sửa được tên, mô tả, đơn vị chủ quản,
   ngày bắt đầu/hạn, ngân sách — không còn field/mutation nào xây xong mà
   không có UI.
4. **P2 (UI `mayAct` thiếu nhánh creator)** — thêm `createdByUserId` vào
   `WorkRow` (`work-table.tsx`) và cả 2 nơi tạo dữ liệu cho nó
   (`work/page.tsx`, `projects/[projectId]/page.tsx`), sửa `mayAct` khớp
   đúng `canActOnWorkItem()`.

## Không sửa (chấp nhận, ghi lại lý do)

- **P2 "work.manage tạo tầng thứ 3 chưa ghi ADR"** (MANAGER thấy toàn
  Company qua `work.assign` nhưng không tự sửa/hoàn-thành việc người khác vì
  thiếu `work.manage`) — đây là chủ đích thiết kế (Xem/Quản-trị là 2 trục
  khác nhau), đã có comment giải thích tại chỗ trong `work-service.ts`
  (`canActOnWorkItem`); không sửa preset, chỉ cần biết đây không phải bug.
- **Nitpick label `ProjectRolePreset` lặp 2 nơi** — quá nhỏ, không đáng thêm
  1 file constant mới cho 3 dòng ternary.
