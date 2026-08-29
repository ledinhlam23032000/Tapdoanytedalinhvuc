# Legacy Capability Matrix — ZenithTasks

Nguồn: khảo cổ trực tiếp `ZenithTasks/web` (đọc `web/BAN-GIAO.md` đầy đủ qua
`web/CLAUDE.md`→`AGENTS.md`/`BAN-GIAO.md`, `package.json`, cấu trúc thư mục)
**+ workflow khảo cổ 5-agent, mỗi agent đọc trực tiếp source/schema/test/
CHANGELOG với evidence file:line thật** (transcript đầy đủ:
`C:\Users\PC\.claude\projects\C--\...\subagents\workflows\wf_4ba5dcda-d94\journal.jsonl`)
+ audit lịch sử (`tổng nhận xét dự án của chúng ta.docx`).

Quy ước Decision: KEEP / ADAPT / REWRITE / REPLACE / MERGE / RETIRE / DEFER /
UNKNOWN. Không capability quan trọng nào bị bỏ sót im lặng.

Stack xác nhận (khớp cả 5 agent độc lập): Next.js 16.3.0 (App Router,
Turbopack) + React 19.2.4 + TypeScript + Tailwind v4 + Prisma 7.9.1
(`@prisma/adapter-pg`, client lazy qua Proxy ở `web/src/lib/db.ts`) +
PostgreSQL + Vitest 4 (2 lane: `*.test.ts` unit không cần DB, `*.itest.ts`
integration cần QA Postgres thật, `fileParallelism:false`). → ADR-006 (giữ
nguyên). `schema.prisma` dài 2083 dòng, 3 khối rõ theo comment header: Clinic
legacy (dòng 17–1379), ZENITH OPERATING FRAMEWORK V2 (1381–1978), AI TRAINING
STUDIO V3 (1980–2083). 72 migration viết tay (`20260612151658_init` →
`20260829220000_assistant_two_person_approval`).

## ⚠️ Mâu thuẫn tài liệu quan trọng cần biết trước khi đọc bảng dưới

`web/BAN-GIAO.md` mục 14 (tự ghi "cập nhật 24/08/2026") nói production
**"chưa apply"** migration V2/Training. Nhưng `CHANGELOG.md` — có nhiều mục
cũng đề ngày **24/08/2026**, và theo agent QA/Docs là file được cập nhật sát
theo từng thay đổi code hơn BAN-GIAO.md — ghi rõ: *"bật `ENABLE_ZENITH_V2=true`
trên production + thêm mục 'Dự án' vào navigation; xác nhận migration
Operating Framework V2 + AI Training Studio **đã apply clinic** (56
migrations)"*. `VERSION.md` (bản mới nhất, 29/08) không phủ nhận điều này —
chỉ nói riêng UI tạo/duyệt AI Job V2 chưa có, không nói gì về việc DB đã
migrate hay chưa.

**Kết luận theo Rule LXXI (source code + doc cập nhật gần nhất thắng):**
V2 Operating Framework nhiều khả năng **ĐÃ ở trạng thái migrated + bật trên
production clinic** kể từ 24/08/2026, không còn là "chỉ QA sandbox" như
BAN-GIAO.md mục 14 mô tả. Đây là điểm PHẢI xác minh trực tiếp lại (đọc
`prisma migrate status` thật hoặc DB thật của ZenithTasks) trước khi dựa vào
để ra quyết định migration ở Phần 2/3 — không suy đoán thêm ở đây. Nếu đúng
là đã bật thật, thì pattern "ADMIN bypass toàn cục" mô tả bên dưới (L-V01)
không còn là rủi ro lý thuyết cho tương lai SaaS — nó là rủi ro đang tồn tại
trên dữ liệu production ngay bây giờ (dù hiện tại clinic mới chỉ có khả năng
1 "company" thật nên blast radius còn nhỏ).

## Lớp 1 — Clinic Legacy (Trung tâm Phẫu thuật Thẩm mỹ / BVĐK Hồng Phúc)

Toàn bộ dòng dưới đây: `cliniOrGeneric = clinic_only`, không có field
tenant/company/project nào trên các model này (đã grep xác nhận toàn
`schema.prisma` — chỉ `AssistantConversation`/`AssistantApproval` và khối
Z*-prefixed mới có scoping field). → khi migrate sang Company, đây đều là
**dữ liệu của Company đầu tiên (Bệnh viện Đa khoa Hồng Phúc)**, không cần
tenant-split, chỉ cần backfill `companyId` cố định.

| Legacy ID | Capability | Route/UI | Data Models (evidence) | Tests | Decision | Ghi chú |
|---|---|---|---|---|---|---|
| L-C01 | Tiếp nhận + hồ sơ điều trị (CaseRecord/CaseService/Payment/MaterialUsage) | `/tiep-nhan`, `/ho-so/[id]`, `/ho-so/[id]/hoa-don` | schema.prisma:597-687; action file lớn nhất legacy `ho-so/actions.ts` (1240 dòng) | `financial-summary.test.ts`, `case-lock.test.ts`, `case-lock-checklist.test.ts`, `case-readiness.test.ts`, `case-workspace.test.ts`, `material-delete-guard.itest.ts`, `cash-transaction-lock.itest.ts` | ADAPT | **Known bug (self-documented, FINANCE-DEFINITIONS.md):** khi 1 nhân sự vừa là `consultantId` vừa `doctorId` trên cùng case, `getStaffPerformance()` cộng đôi doanh thu (double-count). Model sửa (`CaseRevenueAllocation`, schema:1031 + enum `RevenueAllocationRole`:238) đã có trong schema nhưng rollout **đang dở dang** ("không tự ý biến đổi dữ liệu cũ"). **Hoàn tất fix này trước khi migrate logic hoa hồng sang Company** — đừng salvage số liệu hiện tại làm ground truth. |
| L-C02 | Lịch hẹn + tái khám (Appointment/FollowUp) | `/lich-hen`, `/dat-lich`, `/khach/[token]` | schema.prisma:489 (Appointment), 719 (FollowUp) | `schedule.test.ts` (slotConflict) | KEEP | 2 model tách biệt do quan hệ 1-1 vs 1-nhiều với case — bài học migration: đừng gộp nếu quan hệ dữ liệu khác nhau (cạm bẫy #18 đã tự sửa trong BAN-GIAO.md). |
| L-C03 | Sổ tư vấn điện tử (ConsultationRecord) | `/ho-so/[id]/consultation` | schema.prisma:1154 | — | KEEP | Đặc thù y tế — Healthcare Vertical, không generic hoá. |
| L-C04 | Customer + Lead + cổng khách công khai | `/khach-hang`, `/khach-tham-khao`, `/khach/[token]` | Customer schema:402-445 (phoneEnc/phoneHash, KHÔNG có field tenant), Lead:464, NpsResponse:448 | `leads.test.ts`, `phone-redaction.test.ts`, `case-access.test.ts` | KEEP | Nguồn sự thật khách hàng thật của clinic đang chạy production — không có FK nào tới ZProject. |
| L-C05 | Công nợ + kế hoạch trả nợ (DebtPlan) | `/cong-no` | schema:962 | `debt-plan.test.ts`, `debt-aging.test.ts` | ADAPT | Logic thuần tách rời DB — salvage trực tiếp. |
| L-C06 | Kế toán / P&L / chốt sổ (AccountingPeriod, PaymentRequest) | `/ke-toan`, `/ke-toan/de-nghi-thanh-toan` | schema:1297 (AccountingPeriod), 1119 (PaymentRequest), 1316 (CommissionPayout) | `accounting-period-lock.itest.ts`, `accounting-tasks.test.ts`, `payment-request.test.ts`, `payment-request-state.test.ts`, `pnl.test.ts` | KEEP | `PaymentRequest` (preview→ADMIN duyệt/từ chối→in→ghi sổ PAID) là **tiền thân tốt nhất cho Decision Inbox (Phần 8)** — salvage nguyên pattern. |
| L-C07 | Lương + hoa hồng (PayrollEntry, commission engine) | `/luong`, `/luong/export-ke-toan` | schema:373-401 | `payroll.test.ts`, `commission.test.ts`, `collections.test.ts`, `payroll-clinic-scenario.itest.ts`, `commission-clinic-scenario.itest.ts` | ADAPT | Công thức hoa hồng thật của trung tâm (bác sĩ 8%/10%, điều dưỡng 100k/4%, tư vấn viên theo bậc) — **tài sản nghiệp vụ quý nhất, đừng viết lại từ trí nhớ.** Kế thừa cùng double-count bug với L-C01. |
| L-C08 | Kho vật tư + BOM + giá vốn bình quân | `/kho`, `/danh-muc` | Material:538, StockMovement:579, ServiceMaterial:560 | `inventory-cost.test.ts`, `service-bom.test.ts`, `stock-in.test.ts` | KEEP | |
| L-C09 | Cộng tác viên (CTV) + cổng CTV | `/cong-tac-vien`, `/cong-tac-vien-cua-toi` | Collaborator:1336, CollaboratorDocument:994, CollaboratorPayoutRecord:1011 | `collaborator-access.test.ts`, `collaborator-lifecycle.test.ts`, `collaborator-sync.test.ts`, `collaborator-data-quality.test.ts` | KEEP | `collaborator-access.test.ts` là ví dụ gần nhất legacy có với "negative/cross-actor test" (COLLABORATOR chỉ thấy dữ liệu 6 tháng của chính mình). |
| L-C10 | Chăm sóc khách hàng + Omnichannel (Zalo OA/Facebook Messenger) | `/cham-soc`, `/cham-soc/hop-thu`, `/cham-soc/ket-noi` | ChannelAccount/Conversation/Message | **0 test file cho `lib/channels/`** | KEEP | Kỹ thuật tốt (webhook signature verify thật, OAuth Zalo, token rotation) nhưng **chính BAN-GIAO.md tự flag công thức ký webhook Zalo (mac) là chưa xác minh với traffic thật** (cạm bẫy #19) và giờ xác nhận thêm: chưa có test nào bảo vệ code này — ưu tiên viết test trước khi salvage. |
| L-C11 | Lập kế hoạch nội bộ (Plan/PlanTask, 2 cấp, AI soạn nháp) | `/ke-hoach` | Plan:1247, PlanTask:1265 (tự tham chiếu, giới hạn 2 cấp **chỉ ở server action, không ở schema**) | `plans.test.ts`, `plan-ai.test.ts` | KEEP | Tiền thân trực tiếp của `ZWorkspaceTask` — so sánh: Plan/PlanTask có hierarchy+reorder+AI draft, `ZWorkspaceTask` (V2) hiện chưa có gì trong 3 thứ đó (xem L-V06). |
| L-C12 | Today Workqueue ("Việc cần làm hôm nay") | `/viec-hom-nay` | `lib/workqueue.ts` (gộp FollowUp/Appointment/Customer/debt) | — | KEEP | **Đây chính là prototype tốt nhất hiện có cho "Today" (North Star UX Employee)** — salvage nguyên triết lý suy ra việc từ dữ liệu sẵn có, không cần schema mới. |
| L-C13 | App shell / sidebar / mobile bottom-nav / "Tất cả" drawer | toàn bộ `(app)/**` | `app-shell.tsx` (527 dòng) | — | KEEP | Branding hiện đúng quy định BAN-GIAO ("Trung tâm..." / "BVĐK Hồng Phúc", dòng 304-305/318/412 — không có "Zenith" ở đây). Role-priority mobile nav logic đáng salvage nguyên. |
| L-C14 | Command Palette production (Ctrl+K, RBAC-aware) | mọi trang, `command-palette.tsx` | `lib/search-actions.ts`, `lib/quick-starts.ts` | — | KEEP | Lọc kết quả theo đúng nav RBAC thật của user (`resolveReachableHref`) — pattern tốt, salvage. |
| L-C15 | Trợ lý AI nội bộ (Legacy Assistant, `/tro-ly`) | `/tro-ly` (ADMIN+SHAREHOLDER only) | AssistantConversation/Message/Approval schema:1051-1115; `tro-ly/agent.ts` (1251 dòng) | `attendance-intent.test.ts`, `conversations.test.ts`, `two-person-approval.itest.ts` | KEEP | **Đây là AI runtime user-facing THẬT DUY NHẤT hiện nay** (xem mục AI Runtime bên dưới) — agent registry đọc/ghi case/attendance/payroll/payment-request có preview+approval+audit thật, dùng thật trong production (CHANGELOG ghi nhận bug tìm thấy qua phiên ADMIN thật). Có 1 dead capability nhỏ (`create_project_task` — khai báo nhưng LLM không được dạy dùng, không có dispatcher) — dọn khi migrate. |

## Lớp 2 — "Zenith Operating Framework V2" (multi-tenant)

| Legacy ID | Capability | Data Models (evidence) | Tests | Decision | Ghi chú |
|---|---|---|---|---|---|
| L-V01 | ZProject ("Company" tổng quát) | schema:1504-1536; `ZProjectType`{INTERNAL_CLINIC,DISTRIBUTION,PARTNERSHIP,SERVICE,OTHER}; `ZProjectMember`:1610 | `v2-project-lifecycle.test.ts`, `v2-project-capabilities.test.ts`, `v2-project-templates.test.ts`, `v2-write-denial.itest.ts` | ADAPT (split Company/Project) | **XÁC NHẬN đúng như audit**: ZProject đóng vai company+branch+project+workspace+tenant. **Nhưng có lỗ hổng thật, trích dẫn nguyên văn** — `v2-access.ts` dòng 12-27 (`requireProjectAccess`): `user.role === "ADMIN"` (role global của HỆ THỐNG CLINIC) → bỏ qua hoàn toàn kiểm tra `ZProjectMember`, thấy MỌI project của MỌI "tenant" mô phỏng; `v2-global-console-policy.ts` dòng 3-5 (`canOpenGlobalProjectConsole`) cũng chỉ `return role === "ADMIN"`. **Đây chính là điều ADR-003 phải tránh tuyệt đối** — không có khái niệm "ADMIN của riêng 1 Company", chỉ có 1 role toàn cục bypass mọi ranh giới. Ngược lại: pattern `bypassTenantFilter` ở `v2-tenant-extension.ts:35` là escape hatch có chủ đích, có tài liệu, chỉ dùng cho GLOBAL admin aggregate query, KHÔNG phải bypass ngầm — khác bản chất với 2 chỗ trên. |
| L-V02 | ZProjectMember + preset permissions | schema:1610 | QA role smoke (ADMIN/MANAGER/SHAREHOLDER/COLLABORATOR/RECEPTION/DOCTOR) | ADAPT → CompanyMembership | Có **cross-tenant negative test thật chạy trên QA DB thật**: `v2-write-denial.itest.ts` dòng ~136 — "thành viên company A không thể ghi sang company B", kèm case DRAFT/ARCHIVED company chặn ghi, revoked-membership chặn ghi, và 1 control case xác nhận ADMIN vẫn ghi được company mình active (loại false-positive). **Đây là bằng chứng mạnh nhất cho thấy phần "membership-based isolation" (khác với ADMIN-bypass ở L-V01) đã được kiểm chứng nghiêm túc — salvage nguyên approach viết negative test kiểu này cho Company isolation ở Phần 3.** |
| L-V03 | ZOrganizationUnit / ZProjectPosition | schema:1627, 1647 | **Không có test file riêng** | REWRITE | Chỉ có 1 trang xem read-only (`/du-an/[id]/to-chuc`, đã đọc toàn bộ page.tsx — không có form/mutation nào); code DUY NHẤT tạo dữ liệu là `v2-demo-actions.ts` (ADMIN demo seed 1 unit "SALES" + 1 position "SALES_MANAGER" hard-code). Chưa có CRUD thật cho ai dùng. |
| L-V04 | ZProjectAssignment | schema:1662-1675 | không có | **RETIRE** | **Dead schema xác nhận qua grep**: không có file `lib/`, `app/`, component nào tham chiếu ngoài code Prisma client tự sinh. Không migrate/salvage — chỉ ghi nhận ý tưởng (link Membership↔Position) cho thiết kế mới. |
| L-V05 | ZWorkspaceCustomer/Appointment/Sale/LedgerEntry/PaymentReconciliation/PayrollRun/PayrollLine | schema:1728-1893, mọi model có `projectId` bắt buộc + `@@unique([projectId,code])` | `v2-payroll-calculation.test.ts`, `v2-payroll-policy.test.ts`, `v2-payroll-lifecycle.itest.ts`, `v2-project-debt-tools.itest.ts`, `v2-multi-tenant-security.test.ts`, `v2-write-denial.itest.ts` | ADAPT (chuyển sang companyId) | Mọi write action (`v2-customer-actions.ts`, `v2-appointment-actions.ts`, `v2-sale-actions.ts`, `v2-ledger-actions.ts`, `v2-payroll-actions.ts`) gọi `requireProjectCapability` trước khi ghi + mọi query filter `where: {projectId}` — không phát hiện leakage pattern nào trong các file đã đọc trực tiếp. |
| L-V06 | ZWorkspaceTask | schema:1916-1938 | chỉ gián tiếp qua `v2-write-denial.itest.ts` | ADAPT | Mỏng hơn nhiều so với legacy Plan/PlanTask (L-C11): chỉ có `createWorkspaceTaskAction` + `updateWorkspaceTaskStatusAction`, KHÔNG có update title/description, xoá, reorder, hay hierarchy. Khi xây Work Core Phần 4, lấy CẢ HAI làm input — đừng chỉ port ZWorkspaceTask. |
| L-V07 | ZMechanism (rule engine hoa hồng/chiết khấu) | ZMechanismDefinition:1939, ZMechanismVersion:1956 | `v2-mechanism-test.test.ts`, `v2-rule-engine.test.ts` | DEFER | DRAFT-only theo thiết kế, chưa nối vào payroll/sale thật — guardrail tốt, giữ nguyên triết lý khi salvage (không để cơ chế mới tự động áp dụng ngay). |
| L-V08 | ZAiAgent (GLOBAL/CHILD) + ZAiJob dispatcher/worker | schema:1538 (ZAiJob), 1578 (ZAiAgent) | `v2-ai-job-lifecycle.itest.ts` (8/8), `v2-ai-job-engine.test.ts`, `v2-ai-job-contract.test.ts`, `v2-child-agent-resume-jobs.itest.ts`, `v2-global-controls-child.itest.ts` | KEEP (đổi GLOBAL→ECOSYSTEM, CHILD→COMPANY dần) | **Backend cực đầy đủ** (policy, idempotency theo `[requestedById]`, approval, verify — 4/4 write action có verify branch riêng, audit, `scripts/ai-job-worker.ts` polling worker thật chạy trong `docker-entrypoint.sh` production) **nhưng CONFIRMED zero front door**: grep toàn bộ `web/src/app` không có route/component nào gọi `enqueueAiJobAction` — khớp với ledger nội bộ dự án `.task-memory/multi-company-ai-2026-08-27/07_task_ledger.md` mục MC-24 (status BLOCKED) và `VERSION.md` (bản 29/08, mới nhất, tự ghi "chưa có UI nào tạo/duyệt AI job của tầng V2"). **Đây là xác nhận độc lập, hiện tại (không phải audit cũ) cho đúng phát hiện quan trọng nhất của audit lịch sử.** |
| L-V09 | Declared-vs-implemented tool drift (bug pattern, không phải 1 bug đơn) | `v2-project-actions.ts:124-131` (toolAllowlist) vs `v2-ai-job-engine.ts` (dispatchJobTool) | — | (bài học kiến trúc) | `get_project_payroll_preview` nằm trong toolAllowlist mặc định của mọi CHILD agent mới nhưng **không có branch xử lý** trong dispatcher → sẽ throw `UNSUPPORTED_JOB_TOOL_ACTION` nếu gọi. Đây là **bug thứ ba cùng loại** — 2 bug anh em (`get_project_sales_summary`, `get_project_debt_summary`) đã được vá trước đó (MC-23) nhưng pattern lặp lại vì **không có test nào assert "mọi tool trong toolAllowlist đều có dispatcher branch."** → **Phần 8 (AI Runtime) bắt buộc có 1 test cấu trúc kiểu này** (enumerate allowlist, assert dispatcher coverage) — đừng lặp lại lớp lỗi này. |
| L-V10 | Two-person approval (L5) | `AssistantApproval.status` PENDING→PENDING_SECOND→APPROVED (schema:1090-1115); `ZAiJob` PENDING_APPROVAL chặn cùng-người-duyệt khi `riskLevel===L5` (`v2-ai-job-actions.ts:235-237`) | `two-person-approval.itest.ts` | KEEP | Chỉ `delete_customer` có code path L5 thật; các loại L5 khác (chấm dứt nhân sự, đổi quyền, deploy) được PHÂN LOẠI nhưng "chưa có code path thật nên chưa cần workflow" (VERSION.md dòng 90) — tức chưa implement, không phải đã implement mà thiếu kiểm thử. Migration two-person mới apply QA. |
| L-V11 | AI Training Studio V3 | ZAgentProfile/ZTrainingDataset/ZTrainingExample/ZPromptVersion/ZEvaluationRun (schema:2005-2083) | không có (chỉ demo seed) | DEFER | Trang `/he-thong/ai-dao-tao` 43 dòng, không có form/action nào (grep xác nhận) — đúng là MVP dashboard/counts như tài liệu tự mô tả. |

## Lớp 3 — Nền tảng dùng chung (Platform)

| Legacy ID | Capability | Decision | Ghi chú |
|---|---|---|---|
| L-P01 | Auth (JWT `jose`, cookie `zsession`, bcrypt cost 12, TOTP 2FA) | KEEP | |
| L-P02 | RBAC clinic — `permissions.ts` (`userCan`, dòng 115-133) | ADAPT | Trích dẫn thật: **không có** nhánh `if role===ADMIN return true` tổng quát — ADMIN chỉ có quyền qua `DEFAULTS[key]`/`grant` như mọi role khác. Khác hẳn kiểu bypass tuyệt đối thấy ở V2 (L-V01) — RBAC clinic tự nó là mẫu tốt, vấn đề nằm ở lớp V2 phía trên nó. |
| L-P03 | Audit log (AuditLog, append-only + trigger chặn UPDATE/DELETE) | KEEP | Indexed theo entity/action/actorId (migration `20260828230000_tenant_scoped_uniques_and_audit_indexes`). |
| L-P04 | Mã hoá SĐT AES-256-GCM + reveal có audit | KEEP | Không copy giá trị khoá — chỉ salvage pattern code. |
| L-P05 | Vitest 2-lane (unit `*.test.ts` không cần DB / integration `*.itest.ts` cần QA Postgres thật) | KEEP | **95 `*.test.ts` + 17 `*.itest.ts` dưới `web/src`, 0 `*.spec.ts`.** Coverage lệch: 90/95 unit test tập trung vào pure/business-math (`lib/`, `lib/__tests__/`); chỉ 4 unit test dưới `src/app`; **20/21 file `*-actions.ts` (Server Action — đường ghi thật) KHÔNG có test riêng**; `lib/channels/` (Zalo/Facebook) có 0 test. Salvage triết lý 2-lane, nhưng đừng salvage tỷ lệ coverage này — Phần mới cần balance lại theo Test Pyramid (XLIV Master Prompt). |
| L-P06 | QA harness multi-company (`qa:seed/verify:multi-company`, `qa:walkthrough:auth`, `qa:write-denial`) | KEEP | An toàn dựa vào regex heuristic chặn DB URL giống production (`/clinic\|production\|trungtam\|hongphuc/i`) — không phải hard allowlist, nhưng chưa phát hiện lạm dụng. Không wired vào CI (chạy tay theo README). Đây là nền rất tốt để salvage cho test suite Company-isolation của Tapdoanytedalinhvuc. |
| L-P07 | Backup (`pg_dump` + ảnh + status JSON) | ADAPT | |

## Bug/gap cụ thể phát hiện MỚI (không có trong audit lịch sử, xác nhận hiện tại 2026-08-30)

1. **Hai Command Palette đè lên nhau** — `components/v2-command-palette.tsx` (333 dòng, mount không điều kiện ở `(app)/layout.tsx`) đăng ký listener Ctrl/Cmd+K RIÊNG, độc lập với `app-shell.tsx`'s CommandPalette → bấm Ctrl+K mở **2 modal chồng nhau** cho mọi user đã đăng nhập, mọi trang.
2. **`/phe-duyet` vẫn gãy** — entry "Trung Tâm Phê Duyệt Hệ Thống" trong V2 command palette (dòng 114) trỏ `/phe-duyet`, route này không tồn tại trong route tree lẫn `permissions.ts` MODULES. Audit cũ đã từng phát hiện; **git blame xác nhận route này được (tái) thêm bởi commit 26625ac ngày 2026-08-28** — tức đây là regression mới, không phải nợ kỹ thuật cũ chưa dọn.
3. **Rò rỉ thương hiệu "ZenithTasks"** — footer của V2 command palette (dòng 327) in chữ "ZenithTasks Universal Command Center" thẳng ra UI — vi phạm trực tiếp quy tắc chính BAN-GIAO.md mục 0 ("KHÔNG dùng 'Zenith'... trong giao diện").
4. **V2 command palette không dùng RBAC nav thật** — item list hard-code tĩnh, không lọc qua `resolveReachableHref` như palette chính → rủi ro tiếp tục sinh thêm link gãy/không đúng quyền như `/phe-duyet`.
5. Sidebar hiện mục "Dự án" cho MỌI ADMIN/MANAGER kể cả khi `ENABLE_ZENITH_V2` tắt (dẫn tới trang "tính năng đang khoá") — không phải lỗi, nhưng là dead-end UX cần tránh lặp lại (ẩn hẳn mục khi module chưa sẵn sàng, thay vì hiện rồi khoá).

## Bài học salvage cho kiến trúc mới (áp dụng ngay từ Phần 2)

- **"Declared capability ≠ working capability"** phải có test cấu trúc tự động (L-V09), không chỉ code review bằng mắt.
- **Không có khái niệm "ADMIN của riêng 1 Company"** là gốc rễ của lỗ hổng L-V01 — Phần 3 (Identity/Membership) phải thiết kế sao cho không role toàn cục nào tự động bypass Company boundary; quyền cross-company chỉ qua Ecosystem/Founder membership tường minh.
- Pattern `bypassTenantFilter` (có tài liệu, scoped, chỉ dùng cho aggregate GLOBAL query) là cách LÀM ĐÚNG một escape hatch — khác về chất với `user.role === "ADMIN"` rải rác nhiều nơi. Salvage đúng pattern này, không salvage pattern kia.
- `v2-write-denial.itest.ts` (chạy trên QA DB thật, có regex chặn URL giống production) là khuôn mẫu tốt cho toàn bộ negative-test suite của Company isolation ở Phần 3.
- Doc-hierarchy: đừng lặp lại tình trạng nhiều "nguồn sự thật" (VERSION.md/CHANGELOG.md/BAN-GIAO.md/docs/INDEX.md/docs/PROJECT-HANDOFF...) cập nhật lệch ngày nhau — đây chính là lý do `docs/project/SESSION_PROTOCOL.md` của repo mới giữ tối thiểu số file "MASTER".

## Chưa xác minh (UNKNOWN — cần Phần 2/3 xác minh lại bằng DB/source thật, không suy đoán thêm)

- Trạng thái migrate thật của production ZenithTasks (xem mục "Mâu thuẫn tài liệu quan trọng" ở đầu file) — cần `prisma migrate status` thật hoặc xác nhận trực tiếp từ chủ dự án, không chỉ đọc tài liệu mâu thuẫn nhau.
- Toàn bộ 72 migration chưa được đọc dòng-theo-dòng (chỉ đọc tên + tổng hợp qua CHANGELOG).
