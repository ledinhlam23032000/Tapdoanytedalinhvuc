# Security Boundaries (Phần 2)

Bổ sung `TENANT_INVARIANTS.md` (chi tiết threat model tenant/Company). File
này chốt các ranh giới bảo mật rộng hơn: Identity/Permission, AI safety,
Audit, Secrets, Platform operator.

## Ranh giới bắt buộc chứng minh được (quality gate — Master Prompt mục CXXXI)

| Ranh giới | Đã thoả mãn ở Domain Model? |
|---|---|
| Company ≠ Project | ✅ — `Project.companyId` bắt buộc, Project không sở hữu mini-ERP |
| Company ≠ Branch | ✅ — Branch là `OrganizationUnit`, không phải entity tenant riêng |
| Ecosystem ≠ toàn bộ database | ✅ — GLOBAL luôn nghĩa "trong Ecosystem X", không phải "mọi Ecosystem" |
| User ≠ Role | ✅ — `User` chỉ chứa platform identity; role luôn qua `EcosystemMembership`/`CompanyMembership` |
| Position ≠ Permission | ✅ — `Position` là organizational identity; quyền qua `permissionPackRef`/`CompanyMembership.permissions` |
| Project ≠ chủ sổ Ledger | ✅ — `LedgerEntry.companyId`, `projectId?` chỉ là attribution |
| Healthcare ≠ Product Core | ✅ — Healthcare là vertical module, dependency một chiều (Healthcare → Core) |
| AI Scope ≠ Client input | ✅ — `Agent.scopeId` resolve server-side, tool không tin argument caller |

## Identity vs Permission (Platform boundary)

`User` (identity) tách hoàn toàn khỏi authorization. Authorization luôn đi
qua một trong hai đường:

```
EcosystemMembership.role      (FOUNDER | ECOSYSTEM_ADMIN | AUDITOR | VIEWER | CUSTOM)
CompanyMembership.rolePreset  (OWNER | COMPANY_ADMIN | MANAGER | EMPLOYEE | VIEWER | AUDITOR | CUSTOM)
```

**`ECOSYSTEM_ADMIN` không phải "ADMIN toàn cục"** (chốt sau red-team review
— đây là điểm dễ tái tạo lỗ hổng cũ nhất do trùng tên): role này chỉ cấu
hình được ở tầng Ecosystem (mời thành viên, quản lý danh sách Company), và
chịu **cùng ràng buộc như FOUNDER** khi cần đọc/ghi một Company cụ thể —
phải có `CompanyMembership` tường minh trên Company đó, không có ngoại lệ
theo tên role. Chi tiết + acceptance test: `DOMAIN_MODEL.md` mục Ecosystem,
`TENANT_INVARIANTS.md`.

Không có `PLATFORM_OPERATOR` trộn với `FOUNDER` (mục XXIV) — nếu cần tài
khoản kỹ thuật vận hành platform (deploy/diagnostics), đó là role
`PLATFORM_OPERATOR` riêng, không mặc định là business owner của bất kỳ
Ecosystem nào.

Permission model bắt đầu từ capability groups thực tế theo use case (mục
XXI), không enum hoá toàn bộ ngay: ví dụ `company.manage`, `people.view`,
`people.manage`, `work.view`, `work.assign`, `customer.view`,
`customer.manage`, `finance.view`, `finance.write`, `finance.approve`,
`payroll.view`, `payroll.approve`, `healthcare.view`, `healthcare.write`.
Danh sách đầy đủ + role preset chốt ở Phần 3 dựa trên nhu cầu thật của từng
domain, không copy nguyên permission legacy.

## AI Safety Boundary

Mọi hành động AI rủi ro cao đi theo lifecycle bắt buộc (Product Constitution
C10): **Plan → Preview → Approve → Execute → Verify → Audit → Report.**
Chi tiết implement thuộc Phần 8, nhưng ranh giới kiến trúc phải chốt ngay:

- Agent không bao giờ tự suy luận `scope` từ input — `scopeType`/`scopeId`
  gắn chết vào `Agent` record khi tạo, resolve server-side khi dispatch job.
- Ecosystem AI (`scope=ECOSYSTEM`) đọc aggregate được phép theo
  `EcosystemMembership` của actor; **ghi xuống một Company cụ thể vẫn phải đi
  qua đúng policy của Company đó** — Ecosystem AI không phải superuser
  (Product Constitution: "AI Tổng không phải superuser vô hạn"). Cụ thể
  (chốt sau red-team review — trước đó "permission" ở đây chưa định nghĩa
  rõ): actor (kể cả Founder) phải có `CompanyMembership`/grant tường minh
  trên đúng Company đích mới được AI ghi thay — riêng
  `EcosystemMembership.role=FOUNDER` hay `ECOSYSTEM_ADMIN` KHÔNG tự động đủ.
  Đây là ranh giới quan trọng nhất rút ra từ review: nếu bỏ qua, AI sẽ tái
  tạo đúng lỗ hổng `user.role === "ADMIN"` của ZenithTasks, chỉ khác là chạy
  qua AI thay vì UI trực tiếp.
- Verify step (đọc lại DB sau khi ghi để xác nhận trước khi đánh SUCCEEDED)
  là bắt buộc cho mọi write action rủi ro — salvage nguyên từ
  `v2-ai-job-engine.ts` của ZenithTasks (đã chứng minh tốt qua
  `v2-ai-job-verify.itest.ts`).
- **Bài học bắt buộc áp dụng ngay từ Phần 8** (không phải chờ phát hiện lại):
  phải có 1 test cấu trúc tự động assert "mọi tool trong toolAllowlist của
  một Agent đều có handler thật trong dispatcher" — ZenithTasks đã dính lỗi
  này ít nhất 3 lần (xem Legacy Capability Matrix mục L-V09) vì thiếu đúng
  loại test này.

## Audit Boundary

Audit là platform capability cross-cutting, không phải business module có
thể tắt. Bất biến:

- Không sửa/xoá bằng CRUD thường (salvage nguyên cơ chế trigger chặn
  UPDATE/DELETE đã có ở `AuditLog` của ZenithTasks).
- User-facing audit dùng ngôn ngữ business ("AI Hồng Phúc đã tạo công việc
  X theo yêu cầu của BS Lam"); raw/technical audit (tool name, job ID, risk
  code) chỉ Technical Admin thấy — đúng nguyên tắc Progressive Disclosure.
- Bắt buộc ghi audit cho: permission changes, finance, payroll, healthcare
  records, AI actions, Company lifecycle changes, approvals.

## Secrets Boundary

- Không commit `.env`/API key/credential vào bất kỳ repo nào (đã tuân thủ ở
  Phần 1 — xem `.gitignore`).
- Không copy giá trị secret từ ZenithTasks (`.env`, `PHONE_ENC_KEY-*.txt`,
  v.v.) — chỉ salvage pattern code (vd AES-256-GCM cho SĐT), không salvage
  giá trị khoá.
- Khi Phần 3 làm Auth thật: mỗi môi trường (dev/staging/production) có secret
  riêng, không chia sẻ giữa Tapdoanytedalinhvuc và ZenithTasks.

## Platform Operator

Nếu cần tài khoản kỹ thuật vận hành hạ tầng (không phải nghiệp vụ), dùng role
`PLATFORM_OPERATOR` tách biệt hoàn toàn khỏi `FOUNDER`. Chưa cần implement ở
Phần 2/3 nếu chưa có use case vận hành đa Ecosystem thật — chỉ chốt để không
lặp lại việc trộn "quyền kỹ thuật" với "quyền chủ doanh nghiệp" như đã thấy
ở ZenithTasks (ADMIN legacy vừa là quyền vận hành vừa bị dùng làm superuser
đa tenant).

## Cập nhật Phần 5 — CRM/Sales/Appointment permission thật

Permission conceptual Phần 2 ở trên (`customer.view`/`customer.manage`) đã
implement thật ở Phần 5 với độ chi tiết khác đôi chút so với bản nháp: thay
vì 1 `customer.manage` gộp, tách thành `customer.create`/`update`/
`archive`/`assign`/`interaction.create` (mục LXXXV: "đừng tạo hàng trăm
permission" nhưng vẫn cần tách `assign`/`archive` riêng vì đây là 2 hành
động rủi ro cao hơn create/update thường, giữ ở tier MANAGER trở lên). Thêm
mới ngoài dự kiến Phần 2: `lead.*`, `appointment.*`, `sales.*`, `catalog.*`
— xem `docs/domain/CRM.md` và ADR-017 đến ADR-023
(`docs/architecture/DECISIONS.md`) cho lý do đầy đủ. SĐT Customer/Lead mã
hoá AES-256-GCM tại rest (ADR-023) — `src/lib/crypto/phone.ts`, khoá
`PHONE_ENC_KEY` không commit, không dùng chung giá trị với ZenithTasks.

## Cập nhật Phần 6 — Finance/Payroll/Commission/Inventory permission thật

Thêm 16 permission key mới: `finance.view`/`payment.create`/`payment.void`/
`expense.create`/`expense.void`/`correction.create`, `payroll.view`/
`payroll.manage`, `commission.view`/`commission.manage`, `inventory.view`/
`receive`/`issue`/`transfer`/`adjust`/`manage`. Gỡ `"finance."`/`"payroll."`
khỏi `RESERVED_PERMISSION_PREFIXES`; **`"healthcare."` VẪN CÒN reserved**
(`registry.ts:105`) — prefix cuối cùng còn lại, Phần 7 gỡ khi thêm
permission y tế thật. Khác biệt đáng chú ý so với pattern VIEWER-mặc-định của Phần 4/5:
`payroll.view`/`commission.view` **KHÔNG** cấp mặc định cho VIEWER/MEMBER
(quyết định tường minh theo anti-drift Q12 "User bình thường có thấy
payroll? NO unless permission") — đây là domain đầu tiên phá vỡ "VIEWER
thấy mọi thứ `.view`" đã áp dụng nhất quán từ Phần 3, cố tình vì rủi ro lộ
lương đồng nghiệp cao hơn hẳn CRM/Sales. Ranh giới quan trọng thứ 2: mọi
wrapper approval (`firstApprovePayrollFinalize`, `firstApproveStockAdjustment`,
...) hardcode permission string ngay trong hàm, KHÔNG BAO GIỜ nhận
`permission` như tham số truyền từ ngoài vào rồi chuyển tiếp cho
`requireCompanyContextForActor` — lỗ hổng leo thang quyền tự phát hiện và
sửa trước khi review, không phải do review tìm ra. Chi tiết:
`docs/domain/PAYROLL.md`, `INVENTORY.md`, ADR-028/029
(`docs/architecture/DECISIONS.md`).

## Cập nhật Phần 7 — Healthcare permission + permission pack

Thêm 18 permission key `healthcare.*` (78 tổng). `RESERVED_PERMISSION_PREFIXES`
giờ **rỗng** — `"healthcare."` là prefix cuối cùng và đã thành permission
thật. Lưu ý đã xác minh: hằng số đó không được dùng ở bất kỳ đâu (marker khai
báo-thuần đúng chủ đích mục CCXXVI) nên nó **không chặn gì lúc runtime**.

Ranh giới mới quan trọng nhất của Phần 7: **quyền không còn chỉ đến từ
`rolePreset`**. Trước Phần 7, `resolveCompanyPermissions` chỉ đọc 5 preset
generic — không diễn đạt nổi 3 bất biến có test cụ thể (pack reception không
đọc nội dung khám #50; pack nurse không có finance/payroll #51; pack doctor
không có quyền quản trị Company #52). ADR-051 thêm `CompanyMembershipPack`:
quyền = `rolePreset` + pack, pack chỉ CỘNG THÊM. Pack là **tên gọi của một
tập permission key trong code**, không phải điều kiện so sánh tên role — giữ
nguyên bất biến #131/#179 (không suy quyền từ tên Position/title).

Ranh giới thứ hai: **module enablement là cổng độc lập với permission**. Mọi
domain service healthcare gọi `assertHealthcareModuleEnabled(companyId)` ngay
sau `requireCompanyContextForActor` — có quyền mà Company chưa bật phân hệ
thì vẫn bị từ chối.

Ranh giới thứ ba: `healthcare.*` **không bao giờ** implicit-grant
`finance.*`/`payroll.*` (#49) — có unit test âm tính riêng cho từng pack.

## Red-team review

Xem `docs/architecture/RED_TEAM_REVIEW.md` — kết quả review đối kháng thiết
kế Phần 2 trước khi chuyển Phần 3 (Master Prompt mục CXXVII).
