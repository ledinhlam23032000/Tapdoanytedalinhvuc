# Legacy → Target Domain Map (Phần 2)

Bổ sung `docs/legacy/LEGACY_CAPABILITY_MATRIX.md` (Phần 1, theo capability
nghiệp vụ) bằng góc nhìn theo **model/entity**, có decision kiểu Master
Prompt mục LXXX (một model có thể có nhiều decision khác nhau: concept/
physical model/data/tests/UI). Không map theo tên (mục LXXXI) — `ZProject`
được ghi rõ là phải phân loại **từng record** (COMPANY/BRANCH/PROJECT/OTHER/
UNKNOWN) ở migration tooling thật (Phần 10), không đoán ở đây.

| Legacy model | Target entity | Concept | Physical model | Data | Tests | UI |
|---|---|---|---|---|---|---|
| `User` (+ `Role` enum Clinic-global) | `User` (Identity) + `EcosystemMembership`/`CompanyMembership` cho quyền | KEEP_CONCEPT (identity) | REWRITE (bỏ `role` global) | MIGRATE_DATA (mọi User thật) | SALVAGE_TEST (auth flow) | REWRITE (login/profile UI mới) |
| Clinic `Role` enum (ADMIN/MANAGER/TELESALE/RECEPTION/CONSULTANT/DOCTOR/NURSE/CARE/SHAREHOLDER/COLLABORATOR) | `CompanyMembership.rolePreset` + `Position` (cho role nghiệp vụ như DOCTOR/NURSE) | REMAP (role hệ thống → rolePreset; role nghiệp vụ → Position) | REWRITE | MIGRATE_DATA (giữ mapping user↔role cũ làm evidence) | SALVAGE_TEST (RBAC boundary test — vd `collaborator-access.test.ts`) | REWRITE |
| `ZProject` | **Phân loại theo record**: COMPANY → `Company`; BRANCH → `OrganizationUnit(type=BRANCH)`; PROJECT thật → `Project`; OTHER/UNKNOWN → không đoán, để UNKNOWN | KEEP_CONCEPT (đã xác nhận đúng ý tưởng "company" nhưng sai cấp abstraction — audit + workflow khảo cổ đồng thuận) | REWRITE (tách 3 entity) | MIGRATE_DATA có phân loại thủ công/luật rõ, KHÔNG tự động suy đoán | SALVAGE_TEST (`v2-write-denial.itest.ts` là khuôn mẫu tốt cho Company isolation test) | REWRITE |
| `ZProjectMember` | `CompanyMembership` (nếu ZProject→Company) hoặc `ProjectMembership` (nếu ZProject→Project) | KEEP_CONCEPT | REMAP | MIGRATE_DATA theo phân loại ZProject cha | SALVAGE_TEST | REWRITE |
| `ZOrganizationUnit` | `OrganizationUnit` | KEEP_CONCEPT (audit: "giữ gần như nguyên vẹn") | REMAP (`projectId`→`companyId`) | MIGRATE_DATA | không có test riêng ở legacy — viết mới | REWRITE (trang `/to-chuc` hiện chỉ đọc, chưa có CRUD thật — REWRITE thật sự cần) |
| `ZProjectPosition` | `Position` | KEEP_CONCEPT | REMAP | MIGRATE_DATA | không có | REWRITE (CRUD thật, hiện chỉ demo-seed) |
| `ZProjectAssignment` | `Assignment` | KEEP_CONCEPT (ý tưởng đúng: nối Membership↔Position) | RETIRE physical (dead code xác nhận — 0 tham chiếu ngoài Prisma client tự sinh) | không có data thật để migrate | không có | REWRITE hoàn toàn (chưa từng có UI/action) |
| `Customer` (legacy Clinic) | `Customer` | KEEP_CONCEPT | MIGRATE_DATA trực tiếp (companyId = Company Hồng Phúc cố định) | MIGRATE_DATA (toàn bộ, PII mã hoá giữ nguyên thuật toán) | SALVAGE_TEST (`leads.test.ts`, `phone-redaction.test.ts`) | ADAPT (UI hiện tại đã tốt, chỉ đổi route hierarchy `/c/[companyId]/customers`) |
| `ZWorkspaceCustomer` | `Customer` (companyId theo phân loại ZProject cha) | KEEP_CONCEPT | REMAP (`projectId`→`companyId`) | MIGRATE_DATA | SALVAGE_TEST (`v2-write-denial.itest.ts` liên quan) | REWRITE |
| `Appointment` + `FollowUp` (legacy) | `Appointment` (+ `MedicalAppointmentContext` nếu cần healthcare metadata) | KEEP_CONCEPT, MERGE (2 model cũ → cân nhắc hợp nhất nếu quan hệ dữ liệu cho phép — học từ chính cạm bẫy #18 ZenithTasks đã tự vá bằng cách gộp UI, không gộp bảng) | ADAPT | MIGRATE_DATA | SALVAGE_TEST (`schedule.test.ts`) | ADAPT |
| `ZWorkspaceAppointment` | `Appointment` | KEEP_CONCEPT | REMAP | MIGRATE_DATA | SALVAGE_TEST | REWRITE |
| `Plan`/`PlanTask` (legacy, 2 cấp, AI draft) | `WorkItem` (Work Core) | KEEP_CONCEPT (hierarchy + reorder + AI-draft đáng giữ nhất trong 2 hệ cũ) | MERGE (hội tụ với `ZWorkspaceTask` thành MỘT engine — mục XXXIV) | MIGRATE_DATA | SALVAGE_TEST (`plans.test.ts`, `plan-ai.test.ts`) | REWRITE (Work Core UI mới, Phần 4) |
| `ZWorkspaceTask` | `WorkItem` | KEEP_CONCEPT (mỏng hơn Plan/PlanTask, salvage ít hơn) | MERGE | MIGRATE_DATA | SALVAGE_TEST (gián tiếp qua `v2-write-denial.itest.ts`) | REWRITE |
| `CaseRecord`/`CaseService`/`Payment`/`MaterialUsage` | `Sale`/`LedgerEntry` (generic) + `MedicalCase`/`Procedure` (Healthcare vertical) | KEEP_CONCEPT, tách generic vs vertical rõ (mục XLVIII) | REWRITE có tách domain | MIGRATE_DATA (**chờ fix double-revenue-count trước** — xem Salvage Ledger) | SALVAGE_TEST (`financial-summary.test.ts`, `case-lock.test.ts`) | REWRITE |
| `ZWorkspaceSale` | `Sale` | KEEP_CONCEPT | REMAP | MIGRATE_DATA | SALVAGE_TEST | REWRITE |
| `CashTransaction` | `LedgerEntry` | KEEP_CONCEPT | REWRITE (áp dụng Ledger Principle: reversal/void thay vì sửa/xoá) | MIGRATE_DATA | SALVAGE_TEST (`pnl.test.ts`) | REWRITE |
| `ZWorkspaceLedgerEntry` | `LedgerEntry` | KEEP_CONCEPT | REMAP | MIGRATE_DATA | SALVAGE_TEST | REWRITE |
| `PayrollEntry` + commission engine (`commission.ts`/`collections.ts`) | `PayrollRun`/`PayrollLine` (Company) | KEEP_CONCEPT + **SALVAGE_LOGIC bắt buộc** (công thức hoa hồng thật, tài sản nghiệp vụ quý nhất) | REWRITE (schema), giữ nguyên formula logic thuần | MIGRATE_DATA (sau khi fix double-count) | SALVAGE_TEST (`commission.test.ts`, `payroll.test.ts`, `commission-clinic-scenario.itest.ts`) | REWRITE |
| `ZWorkspacePayrollRun`/`Line` | `PayrollRun`/`PayrollLine` | KEEP_CONCEPT (lifecycle DRAFT→PREVIEW→APPROVED→FINALIZED→VOIDED + two-person governance đáng giữ) | REMAP | MIGRATE_DATA | SALVAGE_TEST (`v2-payroll-lifecycle.itest.ts`) | REWRITE |
| `Material`/`StockMovement`/`ServiceMaterial` (BOM) | Inventory (chi tiết Phần 6) | KEEP_CONCEPT | ADAPT | MIGRATE_DATA | SALVAGE_TEST (`inventory-cost.test.ts`, `service-bom.test.ts`) | ADAPT |
| `AssistantConversation`/`AssistantMessage`/`AssistantApproval` (Legacy Assistant) | AI Runtime (Company AI, Phần 8) | KEEP_CONCEPT + **SALVAGE_LOGIC bắt buộc** (đây là AI runtime user-facing THẬT DUY NHẤT hiện có) | MERGE với `ZAiAgent`/`ZAiJob` thành một AI runtime (mục LII/LIII Phần 1 + LXXIX Phần 2 — không giữ 2 hệ song song) | MIGRATE_DATA (lịch sử hội thoại nếu cần) | SALVAGE_TEST (`two-person-approval.itest.ts`) | REWRITE (3 hình thái AI UX — AI Brief/Copilot/Full Workspace, Phần 9) |
| `ZAiAgent` (GLOBAL/CHILD) | `Agent` (scopeType ECOSYSTEM/COMPANY) | KEEP_CONCEPT + SALVAGE_LOGIC (idempotency/approval/verify/audit engine) | REMAP (GLOBAL→ECOSYSTEM, CHILD→COMPANY dần, giữ compatibility field trong giai đoạn migrate) | MIGRATE_DATA (config Agent, không phải business data) | SALVAGE_TEST (`v2-ai-job-lifecycle.itest.ts`, `v2-ai-job-engine.test.ts`) | REWRITE (chưa từng có UI thật — xem Legacy Capability Matrix L-V08) |
| `ZAiJob` | AiJob (theo Agent scope) | KEEP_CONCEPT + SALVAGE_LOGIC | REMAP | không migrate job history cũ (không có giá trị business) | SALVAGE_TEST | REWRITE |
| `AuditLog` | AuditLog (Platform) | KEEP_CONCEPT + SALVAGE_LOGIC (append-only + trigger chặn UPDATE/DELETE) | KEEP (giữ gần nguyên cơ chế) | MIGRATE_DATA (lịch sử audit quan trọng, đặc biệt tài chính/y tế) | không cần test riêng thêm | REWRITE (business-language audit UI, Phần 9) |
| `ZMechanismDefinition`/`ZMechanismVersion` | Commission/pricing policy config (Phần 6) | KEEP_CONCEPT (DRAFT-only guardrail đáng giữ) | ADAPT | KHÔNG migrate data cũ (DRAFT-only, chưa từng áp dụng thật) | SALVAGE_TEST (`v2-rule-engine.test.ts`) | DEFER (không phải ưu tiên Phần 6 sớm) |
| Healthcare models (`ConsultationRecord`, `CaseConsent`, `Photo` type CLINICAL, v.v.) | Healthcare Vertical (`MedicalCase`, `Consultation`, `Consent`, `ClinicalPhoto`, `MedicalFollowUp`) | KEEP_CONCEPT (giá trị nghiệp vụ rất lớn) | ADAPT (đổi companyId, giữ nguyên field y tế) | MIGRATE_DATA (toàn bộ, không rút gọn) | SALVAGE_TEST (`consultation-sheet.test.ts`) | ADAPT (UI Clinic hiện tại giữ tương đối nguyên vẹn giai đoạn đầu — strangler pattern, không big-bang) |
| `ZAgentProfile`/`ZTrainingDataset`/`ZTrainingExample`/`ZPromptVersion`/`ZEvaluationRun` (AI Training Studio V3) | (tương lai, P5) | DEFER hoàn toàn | DEFER | KHÔNG migrate (chỉ demo seed, không có giá trị business) | DEFER | DEFER |

## Cập nhật Phần 4 — trạng thái implement thật của các dòng Organization/Work

Các dòng `ZOrganizationUnit`→`OrganizationUnit`, `ZProjectPosition`→
`Position`, `ZProjectAssignment`→`Assignment`, `Plan`/`PlanTask` +
`ZWorkspaceTask`→`WorkItem` ở bảng trên đã hoàn tất Physical Model (REWRITE/
MERGE) ở Phần 4 — không còn "chưa implement". Data thật (`MIGRATE_DATA`) vẫn
CHƯA chạy (chờ migration tooling Phần 10, đúng như Data đã ghi ở trên — Phần
4 chỉ build physical model + service + UI mới, không di dữ liệu ZenithTasks
thật vào Tapdoanytedalinhvuc). Test: `SALVAGE_TEST` cho `v2-write-denial.
itest.ts`-style đã áp dụng thành `tenant-isolation-part4.itest.ts`. UI:
`REWRITE` hoàn tất — `/c/[code]/organization`, `/c/[code]/work`, `/c/[code]/
today`, `/c/[code]/projects` (trang `/to-chuc` legacy chỉ đọc, đã thay hoàn
toàn bằng CRUD thật).

## Cập nhật Phần 5 — Legacy Capability Matrix rows (mục CCLXIX)

| Legacy | Target entity | Salvage decision | Ghi chú |
|---|---|---|---|
| `Customer` (Clinic legacy, schema:402-445) | `Customer` | KEEP CONCEPT + MIGRATE DATA + REWRITE OWNERSHIP | Physical model REWRITE (mã hoá SĐT viết mới, không copy khoá — ADR-023); data thật CHƯA migrate (Phần 10). |
| `Lead` (Clinic legacy, schema:464) | `Lead` | KEEP CONCEPT + MIGRATE DATA + REWRITE OWNERSHIP | Bằng chứng trực tiếp cho ADR-017 — xem `LEGACY_CAPABILITY_MATRIX.md` L-C04. |
| `ZWorkspaceCustomer` (V2) | `Customer` | MERGE INTO TARGET CUSTOMER | REMAP `projectId`→`companyId`, giống pattern Phần 3/4. |
| Legacy "Customer Care" (follow-up, call script, care status, reminder — rải rác trong Clinic + `lib/workqueue.ts`) | `CustomerInteraction` + Work Core + Appointment | ADAPT INTO WORK CORE | KHÔNG tạo `CareTask` engine riêng (mục CXXVIII, đã xác nhận không có trong code — anti-drift check CCCV Q9 = NO). |
| `Appointment`/`FollowUp` (Clinic legacy, schema:489/719) | `Appointment` | KEEP CONCEPT + MIGRATE DATA, MERGE FollowUp vào Appointment lifecycle | 2 model legacy vì quan hệ 1-1 vs 1-nhiều khác nhau (L-C02) — Target chỉ 1 `Appointment`, follow-up là WorkItem sinh ra từ No-show, không phải bảng FollowUp riêng. |
| `ZWorkspaceAppointment` (V2) | `Appointment` | MERGE INTO APPOINTMENT | Field y tế (nếu có) tách sang Healthcare Vertical (Phần 7), chưa build. |
| Clinic `CaseService`/`Payment` (một phần đóng vai giao dịch bán) | `Sale`/`SaleLine` (phần generic) + Healthcare vertical (phần lâm sàng, Phần 7) | REWRITE có tách domain | Không map 1:1 — CaseService gộp cả dịch vụ y tế lẫn giao dịch tiền, Phần 5 chỉ salvage phần "đã bán gì, giá bao nhiêu" generic. |
| `ZWorkspaceSale` (V2) | `Sale` | MERGE INTO SALE | Không giữ song song 2 khái niệm Sale. |
| `ZMechanismDefinition`/`ZMechanismVersion` (rule engine chiết khấu/hoa hồng) | — (không port) | DEFER TO PART 6, salvage LOGIC/TESTS khi cần | DRAFT-only ở legacy, chưa từng chạy thật — không đủ điều kiện port theo ADR-021. |
| Nguồn khách (không có model riêng ở legacy, chỉ field rời rạc) | `CustomerSource` | NEW | Legacy không có bảng Source chuẩn hoá — tạo mới, không REMAP. |
| Danh mục dịch vụ/sản phẩm (rải rác `ServiceMaterial`/`Material` — phần "bán được gì", tách khỏi phần tồn kho) | `CatalogItem` | NEW (phần bán) + KEEP_CONCEPT cho phần tồn kho (Phần 6 Inventory) | `CatalogItem` chỉ lấy phần "tên/giá/loại", KHÔNG lấy `StockMovement`/giá vốn — đó là Phần 6. |
| Customer/Sale/Appointment status field (nhiều biến thể rải rác legacy) | `CustomerStatus`/`CustomerJourneyStage`/`AppointmentStatus`/`SaleStatus` | REWRITE, tối giản hoá | Không giữ nguyên số lượng trạng thái legacy — mỗi enum Phần 5 tối giản theo đúng mục VIII/XXXVI/XLVIII/LXV. |

## Cập nhật Phần 6 — Legacy Capability Matrix rows

| Legacy | Target entity | Salvage decision | Ghi chú |
|---|---|---|---|
| `CashTransaction`/`ZWorkspaceLedgerEntry` | `LedgerEntry` | KEEP CONCEPT + REWRITE OWNERSHIP | Bất biến append-only; sửa sai bằng correction record (`correctionOfEntryId`), không port cơ chế update trực tiếp nào của legacy (ADR-027). |
| `PaymentRequest` (legacy, pattern preview→approve→execute→audit) | `ApprovalRequest` (Payroll Finalize + Inventory Adjustment) | ADAPT PATTERN, không REMAP data | Không xây `PaymentRequest`/Decision Inbox riêng cho Finance — Payment/Expense ghi trực tiếp, chỉ 2 hành động rủi ro cao nhất (Payroll Finalize, Inventory Adjustment) qua `ApprovalRequest`. |
| `AssistantApproval` (2-người-duyệt thật, `web/src/app/(app)/tro-ly/agent.ts`) | `ApprovalRequest` | KEEP CONCEPT, REWRITE physical | Nguyên mẫu THẬT được dùng để thiết kế `ApprovalRequest` (verify bằng grep trực tiếp, có implementation chạy thật) — KHÔNG dùng `ZWorkspacePayrollRun` dual-field pattern (chưa xác minh chạy thật) làm mẫu (ADR-028). |
| `PayrollEntry`/`ZWorkspacePayrollRun/Line` | `PayrollProfile`/`PayrollRun`/`PayrollItem` | MIGRATE_DATA + REWRITE formula | **Bug double-revenue-count đã ghi ở Phần 2 (`Data Ownership Matrix`) — KHÔNG migrate công thức cũ**, viết lại từ đầu với `allocationBps` tường minh + validate tổng ≤10000 (ADR-030), test hồi quy riêng cho đúng bug class này. |
| Cơ chế hoa hồng rải rác legacy (không có model `CommissionRule` chuẩn hoá) | `CommissionRule`/`CommissionCalculation` | NEW | Không có bảng rule tương đương ở legacy — 3 loại rule đóng (`PERCENTAGE_OF_SALE`/`FIXED_PER_ITEM`/`TIERED_THRESHOLD`) thiết kế mới, không REMAP. |
| `Material`/`StockMovement`/`ServiceMaterial` (legacy) | `InventoryItem`/`InventoryLocation`/`StockMovement` | KEEP CONCEPT (tên `StockMovement`) + REWRITE physical | Chỉ giữ triết lý "nguồn sự thật là movement, không phải cột số dư" — schema/type/idempotency viết mới hoàn toàn, không copy field. |
| `ZMechanismDefinition`/`ZMechanismVersion` (rule engine chiết khấu/hoa hồng) | — (không port, đã DEFER từ Phần 5) | KHÔNG SALVAGE | Xác nhận lại ở Phần 6: DRAFT-only, chưa từng chạy production thật (ADR-021 Phần 5 vẫn đúng cho cả Commission Phần 6). |

## Cập nhật Phần 7 — Legacy Capability Matrix rows

Nguồn: `docs/legacy/PART7_MODEL_CLASSIFICATION.md` — 12 model đã xác minh
bằng cách đọc định nghĩa thật (mục VI: "không classification → không migrate").

| Legacy | Target entity | Salvage decision | Ghi chú |
|---|---|---|---|
| `CaseRecord` (597) | **TÁCH 5 chiều**, không map 1-1 | REWRITE | God-model gộp đơn hàng + hồ sơ lâm sàng + phễu bán + hoa hồng CTV + khoá bản ghi. Tiền → `Sale`/`Payment`; hoa hồng → `CommissionCalculation`; khoá → `ApprovalRequest`+audit; phần lâm sàng → `MedicalCase`. |
| `ConsultationRecord` (1154) | `ClinicalConsultation` + `ClinicalScreeningItem` | ADAPT | Cột `screening` Json không schema, đang chứa ≥2 thế hệ dữ liệu → chuẩn hoá thành bảng con. |
| `CaseService` (646) | `SaleLine` (đã có) + `Procedure` | MERGE + REWRITE | SALE ≠ PROCEDURE (mục XXXV-XXXVI). Cờ `bomApplied` là idempotency tự chế → thay bằng `(sourceType, sourceId)` do server sinh. |
| `Service` (525) | `CatalogItem` (đã có) | MERGE | 7 trường map thẳng. |
| `CaseConsent` (940) + `ConsentTemplate` (928) | `ConsentRecord` + `ConsentTemplate` | ADAPT + bổ sung | Legacy KHÔNG có cách ghi nhận rút đồng ý — chỉ xoá bản ghi. Target thêm `REVOKED` tường minh. |
| `Photo` (704) | `ClinicalPhoto` | REWRITE | Legacy lưu path trần `/media/<tệp>`, không checksum/sizeBytes, xoá bản ghi không xoá tệp. |
| `MaterialUsage` (687) | `ProcedureMaterialUsage` + `StockMovement` (đã có) | MERGE | Legacy ghi ĐÔI usage + movement trong cùng transaction. |
| `FollowUp` (719) | `Appointment` (đã có) + `MedicalFollowUp` | MERGE + tách | `FollowUp` tồn tại CHỈ VÌ `Appointment` legacy bị khoá 1-1 với case. |
| `CaseDocument` (978), `CollaboratorDocument`, `StaffAgreement.fileUrl` | — (defer) | DEFER | 3 hình dạng lưu tệp song song cùng semantics → gom thành `Attachment` đa hình, nhưng CHƯA làm ở Phần 7. |
| `CaseRevenueAllocation` (1031) | `CommissionCalculation` (đã có) | MERGE | Thuộc tầng generic, không phải vertical. |
| `DebtPlan` (962) | — (chưa có target) | DEFER | Lịch trả góp/hẹn nợ — khoảng trống thật của Phần 3-6, ghi nhận để Phần sau xử lý. |

## Legacy Role Map (bổ sung Phần 3 — mục CIII-CVII)

Legacy `Role` enum (10 giá trị, global trên `User`) KHÔNG map 1:1 vào
`CompanyRolePreset`. Phân loại theo 5 nhóm ngữ nghĩa (mục CIII):

| Legacy Role | Phân loại | Target | Ghi chú |
|---|---|---|---|
| ADMIN | **Hỗn hợp — phải tách** (mục CV) | Không map thẳng `ADMIN → FOUNDER` | Thực tế legacy ADMIN gộp Company Owner/Admin + technical admin + healthcare admin. Phần 10 (migration thật) phải xem xét từng User cụ thể, không suy đoán hàng loạt. |
| MANAGER | ORGANIZATIONAL POSITION + PERMISSION PACK | `CompanyRolePreset.MANAGER` cho quyền vận hành cơ bản; quyền nghiệp vụ cụ thể (nếu có) qua permission pack riêng | |
| TELESALE | PROFESSIONAL ROLE | `Position` (Phần 4) + permission pack Sales, KHÔNG phải CompanyRolePreset | |
| RECEPTION | PROFESSIONAL ROLE | `Position` (Phần 4) | |
| CONSULTANT | PROFESSIONAL ROLE | `Position` (Phần 4) + permission pack liên quan tư vấn/hoa hồng | |
| DOCTOR | PROFESSIONAL ROLE (mục CIV, ví dụ chính thức của Master Prompt) | `Position` (Healthcare Professional Role) + healthcare permission pack | KHÔNG `CompanyRolePreset.DOCTOR` — Position ≠ Permission (Law XX) |
| NURSE | PROFESSIONAL ROLE | `Position` + healthcare permission pack | |
| CARE | PROFESSIONAL ROLE | `Position` + CRM/care permission pack | |
| SHAREHOLDER | tương lai: Ecosystem/Company relationship + VIEWER + report permission (mục CVI) | Chưa ép vào core role — cần capability riêng (cổ đông có thể xuyên nhiều Company) | Không implement Phần 3 |
| COLLABORATOR | EXTERNAL RELATIONSHIP (mục CVII) | Có thể KHÔNG phải `CompanyMembership`/Employee — là quan hệ đối tác ngoài (giữ nguyên ý tưởng `Collaborator` model của legacy, xem Legacy Capability Matrix L-C12) | Không ép thành Company Member role nếu không hợp lý |

**Nguyên tắc migration Phần 10:** legacy `Role` global → (a) nếu là quyền hệ
thống thật → `CompanyRolePreset`/`EcosystemRolePreset` tường minh theo từng
User; (b) nếu là vai trò nghiệp vụ/chuyên môn → `Position` (Phần 4); (c) nếu
là quan hệ bên ngoài → giữ dạng tương đương `Collaborator`, không phải
Membership. Không suy đoán hàng loạt — mỗi User cần review khi migrate thật.

## UNKNOWN cần migration tooling thật xử lý (Phần 10, không đoán ở đây)

- Từng record `ZProject` cụ thể: COMPANY vs BRANCH vs PROJECT vs OTHER —
  cần bảng phân loại thủ công có review, không suy đoán tự động theo tên.
- Trạng thái migrate production thật của V2 (xem mâu thuẫn tài liệu đã ghi
  trong Legacy Capability Matrix) — ảnh hưởng trực tiếp tới việc có cần
  extract từ ZProject/ZWorkspace* thật hay chỉ từ Clinic legacy models.
