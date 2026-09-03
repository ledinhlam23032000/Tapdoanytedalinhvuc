# Authorization Model (Phần 3 — implementation thật)

Giải thích cách Identity/Ecosystem Membership/Company Membership/role
presets/permission resolution/inheritance/lifecycle restrictions/server-side
context thực sự hoạt động trong code (Master Prompt mục CXLIII). Xem
`docs/architecture/DOMAIN_MODEL.md` cho lý do thiết kế; file này mô tả
implementation thật đã chạy được.

## Identity

`User` (`prisma/schema.prisma`) chỉ chứa platform identity — không có field
role business. File: `src/lib/auth/current-actor.ts`.
`getCurrentActor()` đọc session cookie → verify JWT → **đọc lại
`User.status` từ DB mỗi lần gọi** (không tin session cache) → trả `null` nếu
user không tồn tại hoặc không `ACTIVE`. Đây là fail-closed thật (mục
LXXXIV): session JWT còn hạn không có nghĩa còn được phép hành động nếu tài
khoản đã bị suspend sau khi đăng nhập.

## Session

`src/lib/auth/session.ts` — JWT (jose, HS256) trong cookie httpOnly
`tdytdlv_session`, 30 ngày, `SameSite=lax`, `Secure` khi production. Payload
**chỉ** `{userId, displayName}` — không nhồi permission/company scope (mục
XI-XII). Mọi authorization resolve lại từ canonical Membership store mỗi
request qua `src/lib/permissions/resolver.ts`.

## Ecosystem Membership → Company Membership

Hai bảng độc lập (`EcosystemMembership`, `CompanyMembership`), KHÔNG có
bảng nào kế thừa quyền của bảng kia một cách ngầm định
(`src/lib/permissions/resolver.ts`):

```
resolveEcosystemPermissions(userId, ecosystemId) → Set<EcosystemPermission>
resolveCompanyPermissions(userId, companyId)     → Set<CompanyPermission>
```

Không có membership ACTIVE → tập rỗng → mọi permission check trả `false`
(default deny, mục LXXXIII).

## Role preset → Permission (static mapping)

`src/lib/permissions/presets.ts` — mapping tĩnh, versioned qua code (mục
XVI/XXV/XXXIV), có unit test canh giữ (`presets.test.ts`) đảm bảo không
preset nào là "god mode" ngầm định:

| Ecosystem role | Permissions |
|---|---|
| FOUNDER | view, manage, membership.manage, company.create, company.lifecycle, company.view_all |
| ECOSYSTEM_ADMIN | view, manage, company.create, company.lifecycle, company.view_all (**không** membership.manage) |
| AUDITOR | view, company.view_all (chỉ đọc) |
| VIEWER | view (chỉ đọc) |

| Company role | Permissions |
|---|---|
| OWNER | view, manage, members.view, members.manage |
| COMPANY_ADMIN | view, manage, members.view, members.manage |
| MANAGER | view, members.view |
| MEMBER | view |
| VIEWER | view |

## "Inheritance" Ecosystem → Company — quyết định quan trọng nhất Phần 3

Đây là điểm mà lỗ hổng ADMIN-bypass thật của ZenithTasks (`user.role ===
"ADMIN"` bỏ qua `ZProjectMember` check) có nguy cơ tái xuất hiện dưới tên
gọi khác nếu implement cẩu thả. Quyết định đã chốt và implement
(`src/lib/authorization/company-context.ts` hàm `resolveCompanyContextForActor`):

1. **Đường 1 — CompanyMembership thật:** nếu actor có `CompanyMembership`
   ACTIVE trên đúng Company đó, permissions đến từ preset của membership đó.
   Đây là đường duy nhất cấp quyền GHI (`company.manage`,
   `company.members.manage`).
2. **Đường 2 — `ecosystem.company.view_all` (Founder/Ecosystem Admin/
   Auditor):** nếu KHÔNG có CompanyMembership nhưng actor có quyền
   Ecosystem-tier `ecosystem.company.view_all`, actor vẫn xem được Company
   (đúng tinh thần "Founder có thể drill-down") nhưng **chỉ nhận
   `company.view`** — không có `company.manage` hay `company.members.manage`.

Nói cách khác: **không có role Ecosystem-tier nào — kể cả FOUNDER — tự động
ghi được vào một Company cụ thể.** Muốn ghi, phải có `CompanyMembership`
tường minh trên đúng Company đó (tự thêm mình khi tạo Company — xem dưới —
hoặc được Owner/Company Admin của Company đó thêm vào).

**Ngoại lệ duy nhất, có chủ đích, hẹp:** hành động **lifecycle** của Company
(suspend/resume/archive) — đây không phải "ghi dữ liệu business vào Company"
mà là quyền hạn của Ecosystem đối với chính sự tồn tại/trạng thái của
Company nó sở hữu (mục LIII: "Founder có thể: suspend Company; manage
Company... nhưng domain write sau này vẫn qua domain policy"). Permission
`ecosystem.company.lifecycle` cấp đúng 3 hành động này, không hơn — xem
`requireCompanyForLifecycle()` trong `company-service.ts`. Việc tạo Company
(`ecosystem.company.create`) cũng ở Ecosystem-tier, nhưng transaction tạo
Company LUÔN kèm tạo `CompanyMembership(rolePreset=OWNER)` cho người tạo
ngay lập tức (mục XLV/XLVII) — nên không có khoảng trống "Company vừa tạo
mà không ai quản lý được", và người tạo có quyền business thật (OWNER) qua
CompanyMembership thật, không qua bypass.

## Quyết định bổ sung khi implement (chưa có trong Phần 2, chốt ở đây)

1. **Chỉ Owner mới cấp/giữ vai trò OWNER cho người khác** — Company Admin
   quản lý được Manager/Member/Viewer nhưng không tự tạo thêm Owner ngang
   hàng mình (`requireOwnerToGrantOwner()` trong `company-service.ts`).
2. **Không ai tự đổi vai trò của chính mình** qua
   `updateCompanyMemberRole`/`removeCompanyMember` — kể cả Owner. Chống
   self-escalation VÀ self-demotion vô tình (mục CLXX). Chuyển quyền sở hữu
   thật sự (nếu cần) là thao tác của một Owner/Admin khác — chưa có UI
   "transfer ownership" riêng ở Phần 3, ghi backlog Phần 4+.
3. **Company code unique trong Ecosystem, không global** (ADR-012) — route
   `/c/[code]` resolve qua `resolveCompanyContextByCodeForActor()`, tìm
   Company đầu tiên actor có quyền xem trong số các Company trùng code (giới
   hạn đã biết nếu multi-ecosystem trùng code — mục CXXIV cho phép defer).
4. **403 vs 404 (mục CXII):** Page loader (Server Component) luôn dùng
   `notFound()` cho MỌI lý do từ chối (không tồn tại hay không có quyền đều
   như nhau) — chống resource enumeration. Server Action throw
   `AuthorizationError` với message chung chung, không phân biệt lý do.

## Audit

`src/lib/audit.ts` — mọi state change quan trọng (`Company` create/suspend/
resume/archive, `CompanyMembership` add/role-change/remove, login success/
fail) ghi `AuditEvent` **trong cùng `$transaction`** với state change (mục
XCVI) — không có trường hợp state đổi thành công nhưng audit ghi thất bại
âm thầm.

## Điều đã cố tình KHÔNG làm ở Phần 3 (đúng phạm vi)

Position/Assignment (Part 4), Work/Project (Part 4), CRM/Finance/Healthcare
permissions (reserved namespace only, chưa implement check), role builder
UI, email invitation service, break-glass access, user impersonation, hard
delete Company có dữ liệu.

## Cập nhật Phần 5 — CRM/Sales/Appointment dùng nguyên cơ chế Phần 3

Không có thay đổi nào ở tầng cơ chế (`resolveCompanyPermissions`,
`requireCompanyContextForActor`, session, audit-in-transaction) — Phần 5
chỉ thêm permission key mới (`customer.*`/`lead.*`/`appointment.*`/
`sales.*`/`catalog.*`, xem `src/lib/permissions/registry.ts`) chảy qua
đúng pipeline đã có. Điểm khác biệt DUY NHẤT đáng chú ý: visibility CRM là
Company-wide theo permission (ADR-022), không tự-scope theo owner như
WorkItem (ADR-015) — đây là quyết định ở TẦNG QUERY của domain service
(`getCustomerList`/`getAppointmentList`/`getSaleList` không thêm
`scopeFilter` theo `ownerUserId`), không phải thay đổi ở tầng
`requireCompanyContextForActor`/resolver — 2 tầng này vẫn hoạt động y hệt
Phần 3/4. `finance.`/`payroll.`/`healthcare.` vẫn còn trong
`RESERVED_PERMISSION_PREFIXES`, chưa implement check (đúng phạm vi, dành
cho Phần 6/7).

## Cập nhật Phần 6 — Finance/Payroll/Commission/Inventory dùng nguyên cơ chế Phần 3

Không có thay đổi nào ở tầng cơ chế — Phần 6 chỉ thêm 16 permission key mới
(`finance.*`/`payment.*`/`expense.*`/`correction.*`, `payroll.*`,
`commission.*`, `inventory.*`, xem `src/lib/permissions/registry.ts`) chảy
qua đúng pipeline `resolveCompanyPermissions`/`requireCompanyContextForActor`
đã có từ Phần 3. Gỡ `"finance."`/`"payroll."` khỏi
`RESERVED_PERMISSION_PREFIXES` (chỉ còn `"healthcare."`, dành Phần 7).

Điểm khác biệt đáng chú ý DUY NHẤT so với Phần 3-5: `payroll.view`/
`commission.view` **KHÔNG** cấp mặc định cho VIEWER (phá vỡ pattern
"VIEWER thấy mọi `.view`" nhất quán từ Phần 3 — quyết định tường minh, rủi
ro lộ lương đồng nghiệp). `READ_ONLY_PERMISSIONS` (`company-context.ts`) mở
rộng đúng 4 permission `.view` mới, không lặp lại lỗ hổng Suspended-Company
của Phần 4 (mọi mutation Phần 6 đều nằm ngoài `READ_ONLY_PERMISSIONS`).

Bổ sung mới ngoài phạm vi Phần 3: mọi wrapper approval (`firstApprovePayrollFinalize`/
`secondApprovePayrollFinalize`/`rejectPayrollFinalize`/
`firstApproveStockAdjustment`/`secondApproveStockAdjustment`/
`rejectStockAdjustment`) hardcode permission string (`"payroll.manage"`/
`"inventory.adjust"`) NGAY TRONG HÀM — không nhận `permission` như tham số
truyền vào rồi chuyển tiếp cho `requireCompanyContextForActor`. Đây là ranh
giới mới cần giữ nguyên cho MỌI approval domain tương lai (Phần 7+): tham
số permission client-controlled đi tới hàm authorization là lỗ hổng leo
thang quyền, bất kể domain nào.
