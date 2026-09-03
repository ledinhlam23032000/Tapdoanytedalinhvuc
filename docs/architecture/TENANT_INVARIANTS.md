# Tenant Invariants (Phần 2)

Đây là bất biến bắt buộc — Phần 3 trở đi phải có test cho từng dòng. Enforcement
thật (code) thuộc Phần 3+; ở đây chỉ chốt invariant + acceptance test hình
thức để Phần 3 implement đúng ngay từ đầu.

## Nguyên tắc nền

1. **Client không quyết định tenant** (mục LV). Nếu request gửi
   `companyId=X`, server phải tự resolve scope authoritative từ session/
   membership, KHÔNG tin trực tiếp giá trị client gửi rồi query thẳng.
2. **Tenant isolation ở tầng ứng dụng**: mọi query nhạy cảm phải scope
   `companyId = authorizedCompany` ngay trong điều kiện truy vấn, không phải
   "query rồi kiểm tra sau" (mục LVI).
3. **Tenant isolation ở tầng database — cam kết cụ thể cho domain rủi ro
   cao** (chốt dứt điểm sau red-team review, không còn "cân nhắc" chung
   chung): Phần 2 KHÔNG chốt composite FK cho toàn schema, nhưng **bắt buộc**
   composite FK/database constraint (không chỉ service-layer validation) cho
   quan hệ cross-entity trong hai domain rủi ro cao nhất mà chính threat
   model này tự nêu tên — **Finance** (`Sale`/`LedgerEntry` ↔ `Customer`) và
   **Healthcare** (`MedicalCase`/`Consultation` ↔ `Customer`/`Appointment`).
   Các domain rủi ro thấp hơn (Work/CRM cơ bản) có thể chỉ cần service-layer
   validation ở Phần 3, nâng cấp sau nếu có bằng chứng cần. Phần 3 cũng nên
   đánh giá PostgreSQL Row-Level Security (RLS) như lớp phòng thủ thứ hai
   cho hai domain trên, thay vì chỉ dựa vào từng service function tự nhớ
   thêm `WHERE companyId = ...` — đây là đúng dạng lỗi "thiếu check ở một
   nơi" đã từng gây lỗ hổng thật ở ZenithTasks.
4. **Không có role toàn cục nào bypass Company boundary** — đây là điều luật
   quan trọng nhất rút ra từ chính lỗ hổng thật đã tìm thấy ở ZenithTasks
   (xem `docs/legacy/LEGACY_CAPABILITY_MATRIX.md` mục L-V01:
   `user.role === "ADMIN"` bypass `ZProjectMember` check trên MỌI project).
   Ecosystem-level access (Founder) phải luôn đi qua `EcosystemMembership`
   tường minh + policy, không phải một cờ role đơn lẻ trên `User`.
5. **Sharing cross-Company mặc định DENY** (mục CII) — bất kỳ hợp tác nào
   giữa 2 Company phải là capability tường minh riêng (tương lai:
   `CrossCompanyAgreement`/`ExplicitGrant`), không phải lỗ hổng.

## Threat model tối thiểu (mục CIV)

| Vector | Rủi ro | Hướng chặn (Phần 3+) |
|---|---|---|
| ID guessing | Đoán ID record của Company khác | Query luôn kèm `companyId` scope, không chỉ check ID tồn tại |
| Client-supplied companyId | Client tự gửi `companyId` khác quyền | Server resolve scope từ session/membership, bỏ qua giá trị client nếu khác |
| Cross-company relation injection | Tạo record ở Company A trỏ FK sang record Company B (vd Sale B reference Customer A) | Validate ở service layer + **bắt buộc** composite FK/DB constraint cho Finance và Healthcare (xem nguyên tắc nền số 3) |
| Admin bypass | Role toàn cục bỏ qua membership check (đã xảy ra thật ở ZenithTasks V2) | Không role nào bypass mặc định; Ecosystem access qua EcosystemMembership tường minh |
| AI tool argument injection | AI tool nhận `companyId` từ argument thay vì scope thật của Agent | `Agent.scopeId` cố định server-side khi tạo/dispatch job, tool handler không tin argument caller — salvage đúng nguyên tắc `bypassTenantFilter` có tài liệu, scoped của ZenithTasks (KHÔNG salvage kiểu `user.role==="ADMIN"` bypass) |
| Background worker wrong scope | Worker xử lý job nhưng dùng nhầm scope | Job phải capture scope tại thời điểm enqueue, không suy luận lại lúc chạy |
| Export leak | File Excel/CSV/PDF xuất dữ liệu ngoài quyền | Export dùng server-authorized scope giống mọi query khác, không dựa filter client |
| Search leak | Full-text/command search trả kết quả Company khác | Search index/scope phải Company-bound; Ecosystem-level search chỉ khi có Ecosystem permission |
| File leak | File nhạy cảm (đặc biệt Healthcare) lộ qua URL đoán được | Không dựa "URL khó đoán" làm bảo mật — access phải check Company+resource+permission mỗi lần (bài học từ chính lỗi `/uploads/*` bypass `/media` từng có ở ZenithTasks, đã tự vá — xem Salvage Ledger) |
| Notification leak | Notification tiết lộ số liệu Company khác cho user không thuộc Company đó | Notification target resolution phải permission-aware trước khi gửi |
| Cache leak | Cache key không phân biệt tenant | Cache key luôn chứa scope, vd `company:{id}:customer:{id}`, không chỉ `customer:{id}` |

## Acceptance test bắt buộc (ánh xạ 1-1 vào test thật ở Phần 3)

```
GIVEN User U có CompanyMembership CHỈ ở Company A
WHEN  U gọi API/Server Action đọc hoặc ghi resource của Company B
THEN  DENY (403/redirect), không phân biệt route UI hay gọi trực tiếp

GIVEN Customer C ∈ Company A
WHEN  Sale S được tạo ở Company B tham chiếu Customer C
THEN  DENY ở service layer (cross-company relation injection)

GIVEN Company AI A có scope = Company A
WHEN  Tool call nhận argument companyId = B (do caller cố tình truyền)
THEN  DENY — Agent.scopeId server-side thắng, không dùng argument

GIVEN Ecosystem AI, Founder hỏi "so sánh doanh thu A và B"
THEN  Aggregate READ được phép nếu Founder có EcosystemMembership hợp lệ
WHEN  Founder yêu cầu AI ghi/xoá dữ liệu ở Company B
THEN  Chỉ cho phép nếu Founder CÓ CompanyMembership/grant tường minh trên
      Company B — riêng EcosystemMembership.role=FOUNDER KHÔNG tự động đủ
      (chốt sau red-team review, tránh đúng hình dạng lỗ hổng ADMIN-bypass
      cũ, chỉ đổi tên thành FOUNDER) — sau đó vẫn qua risk policy đầy đủ
      (Plan → Preview → Approve → Execute → Verify → Audit)

GIVEN EcosystemMembership.role = ECOSYSTEM_ADMIN (không phải FOUNDER)
WHEN  User đó cố đọc/ghi resource của một Company mà họ không có
      CompanyMembership
THEN  DENY — tên "ADMIN" không tự cấp quyền Company nào (test riêng bắt
      buộc, xem mục "Không lặp lại" bên dưới)

GIVEN Company bị SUSPENDED
WHEN  User cố ghi nghiệp vụ mới vào Company đó
THEN  DENY (chặn ghi mới), đọc vẫn có thể cho phép theo quyền, audit vẫn giữ

GIVEN Position "Bác sĩ Tim mạch" được gán cho User U
WHEN  Kiểm tra quyền Founder/Company-Admin của U
THEN  KHÔNG tự động có — Position không cấp quyền hệ thống, chỉ
      permissionPackRef tường minh mới cấp
```

## Cập nhật Phần 4 — mở rộng acceptance test sang Organization/Work/Project

Nguyên tắc nền 1-5 và toàn bộ threat model ở trên áp dụng nguyên vẹn cho
`OrganizationUnit`/`Position`/`Assignment`/`WorkItem`/`Project`/
`ProjectMembership` — không có ngoại lệ nào cho domain mới. Acceptance test
thật (không chỉ hình thức) nằm ở
`src/lib/__tests__/tenant-isolation-part4.itest.ts`, bao gồm: cross-company
FK injection (parentId Unit, positionId, organizationUnitId, projectId,
assigneeUserId, owningUnitId — mỗi FK đều bị chặn nếu trỏ sang Company khác),
gán Assignment/WorkItem cho người không phải `CompanyMembership` ACTIVE
đúng Company, ID injection trực tiếp lên WorkItem/Project biết trước từ
Company khác, Suspended Company chặn ghi mới ở cả 3 domain, và ranh giới
riêng của Phần 4: Project OWNER-membership (per-project) không tự mở rộng
thành quyền cấp Company (`project.archive`/`work.assign`) — xem
`docs/domain/PROJECT.md`.

## Cập nhật Phần 5 — mở rộng sang Customer/Lead/Appointment/Sales

Toàn bộ nguyên tắc nền 1-5 áp dụng nguyên vẹn cho `Customer`/`Lead`/
`CustomerInteraction`/`Appointment`/`CatalogItem`/`Sale`/`SaleLine`. Acceptance
test thật: `src/lib/__tests__/tenant-isolation-part5.itest.ts` — cross-company
FK injection trên mọi FK (sourceId, ownerUserId, organizationUnitId,
customerId, assignedUserId, catalogItemId, projectId, salespersonUserId),
Customer search theo SĐT/tên không lộ Company khác (mục CXLIII), truy cập
Customer bằng ID trực tiếp qua route bị deny/404 (mục CXLIV), Sale/Appointment
injection (mục CXLV-CXLVI), Suspended/Archived Company chặn ghi cả 4 domain
mới. Điểm khác Phần 4: visibility Customer/Appointment/Sale KHÔNG tự-scope
theo owner (ADR-022) — test phải xác nhận đúng "Company-wide theo permission",
KHÔNG test kiểu "MemberA không thấy Customer của MemberB trong cùng Company"
(đó sẽ là test SAI, đi ngược ADR-022 tường minh).

## Cập nhật Phần 6 — mở rộng sang Finance/Payroll/Commission/Inventory

Toàn bộ nguyên tắc nền 1-5 áp dụng nguyên vẹn cho `Payment`/`Expense`/
`LedgerEntry`/`PayrollProfile`/`PayrollRun`/`PayrollItem`/`ApprovalRequest`/
`CommissionRule`/`CommissionCalculation`/`InventoryLocation`/
`InventoryItem`/`StockMovement`. Acceptance test thật:
`src/lib/__tests__/tenant-isolation-part6.itest.ts` (133 test) — cross-company
FK injection trên mọi FK mới, vòng đời PayrollRun đầy đủ kể cả assertion
sống "cùng actor không thể duyệt lần 2" (`secondApproveRequest`), Commission
allocation + chặn double-count + cross-company, Inventory movement + chặn
âm kho + transfer + duyệt điều chỉnh, Suspended-Company chặn ghi cả 4 domain
mới. Điểm khác Phần 3/4/5: Phần 6 là Phần đầu tiên có **describe block
riêng cho concurrency** ("Concurrency — race condition regression (P0
fix)") — dùng `Promise.allSettled` bắn thật 2 lệnh domain-service song song
vào cùng 1 Postgres instance (không mô phỏng), xác nhận đúng 1 trong 2 lệnh
thành công cho `recordPayment`/`finalizePayrollRun`/`issueStock` — bằng
chứng thật rằng khoá `SELECT...FOR UPDATE` hoạt động, không chỉ review logic
tĩnh.

## Không lặp lại (đối chiếu trực tiếp bằng chứng từ Legacy Capability Matrix)

- `v2-access.ts`: `user.role === "ADMIN"` bypass toàn bộ `ZProjectMember`
  check trên MỌI project → **cấm tuyệt đối pattern này** trong
  CompanyMembership/EcosystemMembership check ở Phần 3.
- `v2-global-console-policy.ts`: `canOpenGlobalProjectConsole = role ===
  "ADMIN"` → Ecosystem-level console access phải qua `EcosystemMembership`
  thật, không phải so sánh 1 field role.
- Pattern **đúng** đáng giữ: `bypassTenantFilter` ở `v2-tenant-extension.ts`
  — escape hatch có tài liệu, scoped rõ ("chỉ dùng cho GLOBAL admin aggregate
  queries"), khác về chất với 2 pattern trên.
- **Bổ sung sau red-team review**: tên role `ECOSYSTEM_ADMIN` trong
  `EcosystemMembership` (xem `DOMAIN_MODEL.md`) là role dễ tái tạo lỗi này
  nhất chỉ vì trùng chữ "ADMIN" — Phần 3 bắt buộc: (1) viết acceptance test
  negative riêng cho `ECOSYSTEM_ADMIN` y hệt kiểu test AI tool argument
  injection ở trên; (2) không code bất kỳ nhánh nào dạng
  `if (membership.role === "ECOSYSTEM_ADMIN") return true` khi check quyền
  một Company cụ thể.
