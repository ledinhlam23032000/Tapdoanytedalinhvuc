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
