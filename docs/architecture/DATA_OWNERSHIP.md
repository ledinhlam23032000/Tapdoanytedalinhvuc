# Data Ownership Matrix (Phần 2)

Cột theo Master Prompt mục CIII. "Cross-company Allowed?" mặc định **No**
(mục CII) trừ khi ghi rõ lý do khác.

| Domain | Entity | Owner Scope | Optional Attribution | Cross-company Allowed? | Archive Behavior | Sensitive? | Audit Required? | Legacy Source | Target Status |
|---|---|---|---|---|---|---|---|---|---|
| Platform | User | Platform (không scope Company) | — | N/A (identity, không phải business data) | Disable, không hard-delete tuỳ tiện | Có (PII) | Có | `User` | KEEP_CONCEPT, REWRITE physical (bỏ role global) |
| Ecosystem | Ecosystem | Platform (root) | — | N/A | Archive ≠ Delete | Không | Có (lifecycle) | (mới) | NEW |
| Ecosystem | EcosystemMembership | Ecosystem | — | No | Revoke (giữ lịch sử) | Có (quyền) | Có | (mới, gần với "GLOBAL admin" cũ) | NEW |
| Company | Company | Ecosystem | — | N/A | Suspend → Archive, hard-delete chỉ Company test trống | Không | Có (lifecycle) | `ZProject` (một phần) | NEW entity, REMAP từ ZProject records phân loại COMPANY |
| Company | CompanyMembership | Company | — | No | Revoke | Có (quyền) | Có | `ZProjectMember` | REMAP (đổi tên + bỏ ADMIN-bypass, xem Tenant Invariants) |
| Organization | OrganizationUnit | Company | — | No | Archive theo Company | Không | Thấp | `ZOrganizationUnit` | KEEP_CONCEPT, REMAP (projectId→companyId) |
| Organization | Position | Company | OrgUnit | No | Archive theo Company | Không | Thấp | `ZProjectPosition` | KEEP_CONCEPT, REMAP |
| Organization | Assignment | Company | OrgUnit | No | End theo status | Thấp | Trung bình | `ZProjectAssignment` | dead ở legacy (RETIRE physical) — REWRITE mới, giữ concept |
| Project | Project | Company (bắt buộc) | — | No (mặc định) | Archive; xong không xoá Customer/Company data liên quan | Không | Trung bình | `ZProject` (phần đóng vai PROJECT thật) | REMAP có chọn lọc theo classification |
| Project | ProjectMembership | Project (⊂ Company) | — | No | Revoke | Thấp | Thấp | (một phần `ZProjectMember` nếu record là PROJECT) | NEW/REMAP |
| Work | WorkItem | Company | OrgUnit, Project | No | Archive/Complete | Thấp–TB (tuỳ nội dung) | Trung bình | `Plan`/`PlanTask` + `ZWorkspaceTask` | MERGE hai engine cũ thành một |
| CRM | Customer | Company | OrgUnit, Project (qua liên kết) | No (mục XXXIX — không auto-dedupe cross-company) | Archive, giữ lịch sử giao dịch | **Cao** (PII, SĐT mã hoá) | Có (đặc biệt reveal phone) | `Customer`, `ZWorkspaceCustomer` | MIGRATE_DATA (Customer legacy = Company Hồng Phúc), REMAP (ZWorkspaceCustomer) |
| CRM | Appointment | Company | Branch, Dept, Project | No | Archive | Trung bình (liên quan lịch/khám) | Thấp–TB | `Appointment`, `FollowUp`, `ZWorkspaceAppointment` | MERGE (Appointment+FollowUp legacy đã tự merge UX, giữ bài học) + REMAP V2 |
| Sales | Sale | Company | OrgUnit, Project | No | Void/Archive, không xoá | Trung bình | Có | `ZWorkspaceSale` | REMAP |
| Finance | LedgerEntry | Company | OrgUnit, Project, CostCenter | No | Void/Reversal, không xoá lịch sử | **Cao** | **Có, bắt buộc** | `CashTransaction`, `ZWorkspaceLedgerEntry` | MIGRATE_DATA (CashTransaction) + REMAP (ZWorkspaceLedgerEntry) |
| Finance | PaymentRequest (Decision Inbox candidate) | Company | — | No | Archive sau khi PAID/REJECTED | Cao | Có | `PaymentRequest` | KEEP_CONCEPT (salvage pattern preview→approve→execute→audit) |
| Payroll | PayrollRun/Line | Company | OrgUnit, Project (attribution), Position | No | Finalize/Void, không xoá | **Cao** | **Có, bắt buộc** | `PayrollEntry`, `ZWorkspacePayrollRun/Line` | MIGRATE_DATA + REMAP; **chờ fix double-revenue-count trước khi migrate công thức** (xem Salvage Ledger) |
| Inventory | (chi tiết Phần 6) | Company | Location (Branch/Warehouse) | No | Archive | Thấp | Thấp–TB | `Material`, `StockMovement`, `ServiceMaterial` | KEEP_CONCEPT, chưa modeled chi tiết Phần 2 |
| Healthcare | MedicalCase/Consultation/Procedure/Consent/ClinicalPhoto/MedicalFollowUp | Company (vertical module) | Appointment/Customer | No | Archive theo Company/Customer, không tuỳ tiện xoá hồ sơ y tế | **Rất cao** (dữ liệu y tế) | **Có, bắt buộc** | `CaseRecord`, `CaseService`, `ConsultationRecord`, `Photo`, `CaseConsent`... | MIGRATE_DATA (giữ nguyên toàn bộ, chỉ đổi ownership sang Company Hồng Phúc) |
| AI | Agent | Ecosystem hoặc Company (theo scopeType) | OrgUnit, Project | No — write cross-scope phải qua policy tường minh | Deactivate | Thấp (config), nhưng hành vi nhạy | Có | `ZAiAgent` | KEEP (đổi GLOBAL→ECOSYSTEM, CHILD→COMPANY dần — xem ADR mới) |
| AI | AiJob/Approval/Verify/Audit record | theo `sourceScope`/`targetScope` | — | Chỉ Ecosystem AI aggregate đọc, ghi vẫn phải qua Company policy | Archive sau hoàn tất | Cao (có thể chứa business data) | **Có, bắt buộc** | `ZAiJob`, `AssistantApproval` | KEEP (backend), chưa có UI thật — xem Legacy Capability Matrix L-V08 |
| Audit | AuditLog | theo entity gốc (đa số Company, một số Ecosystem/Platform) | — | Chỉ đọc theo permission, không mặc định | Không xoá (immutable) | Cao | Chính nó là audit | `AuditLog` | KEEP (append-only + trigger chặn UPDATE/DELETE — salvage nguyên) |
| Notification | Notification | theo target User + scope nguồn | — | No (mục CVII — không leak) | Auto-expire | Trung bình | Thấp | (chưa có ở legacy tương đương rõ) | NEW (Phần 9) |
| File | File metadata | Company (hoặc Ecosystem cho tài liệu nền tảng) | Entity liên quan (Case, Project...) | No | Archive theo entity cha | Cao (đặc biệt clinical) | Có (access log) | `Photo`, `CaseDocument`, uploads | KEEP_CONCEPT (metadata + storage provider abstraction, không lưu binary lớn trong DB — đã đúng ở legacy) |

## Cập nhật Phần 4

Các dòng Organization/Project/Work ở trên đã implement đúng ownership scope
đã ghi (Company là owner, OrgUnit/Project là optional attribution) — không
có delta. Xem `docs/domain/ORGANIZATION.md`/`WORK_CORE.md`/`PROJECT.md` cho
chi tiết thật.

## Cập nhật Phần 5

Dòng CRM/Sales ở trên (Customer/Appointment/Sale) đã implement đúng owner
scope + attribution đã ghi. Bổ sung: `Lead` (Company-owned, không có trong
bảng gốc — ADR-017), `CustomerInteraction` (Company-owned qua Customer),
`CatalogItem` (Company-owned), `SaleLine` (owned qua Sale). Sensitivity
Customer PII vẫn **Cao** như đã chốt — thực hiện bằng mã hoá tại rest
(ADR-023), không phải chỉ ghi chú suông nữa.

## Cập nhật Phần 6

Dòng Finance/Payroll/Inventory ở bảng trên (`LedgerEntry`, `PayrollRun/Line`,
Inventory) đã implement với delta so với draft Phần 2: `LedgerEntry` KHÔNG
lấy attribution `CostCenter` (chưa tồn tại domain đó), giữ `OrganizationUnit`/
`Project`/`Customer`; thêm `Payment` và `Expense` (Company-owned, không có
trong bảng gốc — draft chỉ dự tính `PaymentRequest`, thực tế Phần 6 KHÔNG
xây `PaymentRequest`/Decision Inbox pattern, dùng trực tiếp `Payment`/
`Expense` + `ApprovalRequest` cho phần cần duyệt); `PayrollRun/Line` đổi
tên field thật thành `PayrollRun`/`PayrollItem`, thêm `PayrollProfile`
(lương hiệu lực theo thời gian, không có trong draft) và
`CommissionRule`/`CommissionCalculation` (Company-owned, tách khỏi
PayrollRun — draft gộp chung); **bug double-revenue-count đã ghi chú ở dòng
Payroll gốc (`chờ fix double-revenue-count trước khi migrate công thức`) đã
được giải quyết ở tầng thiết kế mới bằng `allocationBps` tường minh +
validate tổng ≤10000 (ADR-030) — không migrate công thức cũ, viết lại từ
đầu**; Inventory (dòng "chi tiết Phần 6") giờ có model đầy đủ:
`InventoryLocation`, `InventoryItem`, `StockMovement` — sensitivity giữ
Thấp–TB như dự tính, KHÔNG owned qua Location như draft gợi ý mà owned trực
tiếp qua Company (Location chỉ là 1 field trên StockMovement, không phải
parent ownership). Chi tiết: `docs/domain/FINANCE.md`, `PAYROLL.md`,
`COMMISSION.md`, `INVENTORY.md`.

## Cập nhật Phần 7

Dòng Healthcare ở bảng trên (`MedicalCase`/`Consultation`/`Procedure`/
`Consent`/`ClinicalPhoto`/`MedicalFollowUp`) đã implement đúng owner scope
đã ghi (Company-owned, sensitivity **Rất cao**, audit **bắt buộc**) với delta:
attribution optional là `OrganizationUnit` (KHÔNG phải `Project` — bất biến
#143: `MedicalCase` không bao giờ scope theo Project); `Appointment` liên
kết qua `HealthcareAppointmentContext` chứ không phải FK trực tiếp.

Archive behavior của Healthcare **chặt hơn** mọi domain trước: xoá không bao
giờ lan truyền vào lịch sử lâm sàng (`ON DELETE RESTRICT`, đã verify 0
`ON DELETE CASCADE` trong migration SQL), và hard delete bản ghi lâm sàng đã
finalize luôn bị từ chối. Đây là phản ứng trực tiếp với phát hiện khảo cổ:
legacy để CẢ 3 loại chứng từ pháp lý (`CaseConsent`, `CaseDocument`,
`StaffAgreement`) `onDelete: Cascade`.

Hai entity Platform mới: `CompanyModule` (Company-owned, bật/tắt phân hệ) và
`CompanyMembershipPack` (owned qua `CompanyMembership`, sensitivity **Cao**
vì là quyền, audit bắt buộc).

## Ghi chú UNKNOWN (không có ở core entity quan trọng — quality gate CXXX)

Không có UNKNOWN ở core entity (Ecosystem/Company/Membership/Organization/
Project/WorkItem). UNKNOWN chỉ còn ở phân loại record-level của `ZProject`
cụ thể (COMPANY vs BRANCH vs PROJECT vs OTHER) — đây là việc của migration
tooling thật (Phần 10), không phải thiếu sót thiết kế Phần 2 (mục LXXXI: not
map "every ZProject → Company" theo tên, phải classify từng record).
