# Architecture Decision Records

Chỉ ghi quyết định lớn, có hậu quả lâu dài. Không ghi quyết định vụn vặt.

## ADR-001 — Greenfield target repository

**Quyết định:** Xây sản phẩm mới trong repo `Tapdoanytedalinhvuc`, không tiếp
tục phát triển feature mới trong `ZenithTasks`.

**Vì sao:** ZenithTasks mắc "Capability Sprawl" — abstraction gốc
(`ZProject` = Company) sai từ tầng domain, tiếp tục vá sẽ tăng chi phí sửa
theo cấp số nhân. Chủ dự án đã xác nhận đây là quyết định execution hiện
hành, override mọi chỉ thị lịch sử nói "tiếp tục cứu ZenithTasks tại chỗ".

**Hệ quả:** ZenithTasks trở thành read-only legacy/archaeology source. Mọi
kiến trúc/code/test/migration mới nằm ở Tapdoanytedalinhvuc.

## ADR-002 — Modular monolith

**Quyết định:** Kiến trúc backend là một modular monolith (một ứng dụng, một
PostgreSQL, ranh giới module rõ trong code), không microservices.

**Vì sao:** ZenithTasks đã chứng minh modular monolith đủ sức vận hành
nghiệp vụ phức tạp (Clinic + multi-tenant V2 + AI). Chưa có bằng chứng nào
đòi hỏi microservices/Kafka/Kubernetes ở giai đoạn này. "Boring
infrastructure + excellent product intelligence."

**Hệ quả:** Không tự ý thêm event mesh, service mesh, plugin SDK, dynamic
schema engine trừ khi có ADR mới kèm bằng chứng cụ thể.

## ADR-003 — Company is the tenant, not Project

**Quyết định:** `Company` là ranh giới tenant cấp một cho mọi dữ liệu
business. `Project` là một entity bên trong Company, có vòng đời riêng,
không sở hữu Customer/Finance/Payroll riêng.

**Vì sao:** Đây là sai lệch domain lớn nhất của ZenithTasks — `ZProject`
từng đóng vai công ty + chi nhánh + đơn vị + dự án + tenant + AI scope +
finance scope + HR scope cùng lúc. Audit lịch sử và Master Prompt đều đồng
nhất kết luận này.

**Hệ quả:** Mọi bản ghi Company-level (Customer, Sale, LedgerEntry,
PayrollRun, WorkItem...) có `companyId` bắt buộc, `projectId` là optional
attribution.

## ADR-004 — Healthcare/Clinic is a vertical

**Quyết định:** Nghiệp vụ Bệnh viện Đa khoa Hồng Phúc trở thành Company đầu
tiên (Company Core + Healthcare Vertical), không phải toàn bộ sản phẩm.

**Vì sao:** Giữ trọn giá trị nghiệp vụ y tế đã chứng minh, đồng thời cho phép
sản phẩm mở rộng sang các loại Company khác (Distribution, Service, Retail)
mà không mang DNA Clinic.

**Hệ quả:** Nghiệp vụ generic (Customer, Appointment, Payroll...) hướng về
Company Core khi migrate; nghiệp vụ y tế đặc thù giữ nguyên trong Healthcare
vertical, không generic hóa thành "Business Object".

## ADR-005 — Legacy salvage strategy: Greenfield architecture × Brownfield salvage

**Quyết định:** Không copy nguyên ZenithTasks rồi đổi tên; không viết lại
toàn bộ từ số 0. Mỗi capability được kiểm kê qua
`docs/legacy/LEGACY_CAPABILITY_MATRIX.md` và salvage có chọn lọc (logic,
test, business rule, schema concept, component, API contract, migration
knowledge, user journey) — không salvage chaos/coupling.

**Vì sao:** ZenithTasks có tài sản nghiệp vụ và kỹ thuật thật (AI job engine
với idempotency/retry/approval/verify/audit, organization tree, position/
assignment, tenant-scoped V2 data) đáng giữ. Viết lại từ trí nhớ sẽ mất giá
trị và lặp lại sai lầm.

## ADR-006 — Stack: giữ Next.js + Prisma + PostgreSQL

**Quyết định:** Repo mới dùng cùng họ stack đã chứng minh ở ZenithTasks:
Next.js (App Router), Prisma ORM + `@prisma/adapter-pg`, PostgreSQL,
TypeScript, Tailwind CSS, Vitest, Zod. Không đổi framework.

**Vì sao:** ZenithTasks/web (Next.js 16.3.0, React 19.2.4, Prisma 7.9.1, `pg`
driver, Tailwind 4, Vitest 4) đã vận hành nghiệp vụ thật (Clinic + multi-
company V2 + AI job engine) ổn định. Đổi stack không mang lại lợi ích rõ
ràng, chỉ tăng chi phí chuyển đổi và rủi ro mất kiến thức migration/testing
đã tích lũy. Rule XXXIX của Master Prompt: không đổi stack chỉ vì muốn "xây
mới cho xịn".

**Hệ quả:** Bootstrap kỹ thuật tối thiểu của Phiên 1 dùng đúng họ công nghệ
này (xem `docs/project/CURRENT_STATE.md`).

## ADR-007 — Ecosystem boundary, không phải "GLOBAL = toàn database"

**Quyết định:** `Ecosystem` là entity platform-level thật (không phải khái
niệm ảo). `GLOBAL` trong mọi ngữ cảnh (AI scope, admin console, aggregate
query) luôn có nghĩa "trong phạm vi một Ecosystem cụ thể", không bao giờ là
"toàn bộ database".

**Vì sao:** Kể cả khi deployment đầu chỉ có 1 Ecosystem, encode cứng
"GLOBAL = whole DB" sẽ chặn đường tới staging ecosystem, demo ecosystem,
SaaS hoá, hoặc một hệ sinh thái thứ hai sau này — đúng bẫy mà ZenithTasks V2
đã mắc phải với `GLOBAL AI`.

**Hệ quả:** Deployment đầu tiên seed đúng 1 `Ecosystem` qua seed/config,
không hard-code ID trong source (mục CXV).

## ADR-008 — Project nằm trong Company, không nullable, không mini-ERP

**Quyết định:** `Project.companyId` bắt buộc (không nullable). Project không
sở hữu Customer/Payroll/Ledger/Sales riêng — chỉ tham chiếu qua attribution.
Cross-company Project (2 Company hợp tác) không giải ở Phần 2, để dành capability
riêng cho tương lai.

**Vì sao:** Làm `companyId` nullable "cho linh hoạt" chính là kiểu ambiguity
đã khiến ZenithTasks lệch hướng (mục LXXV Master Prompt Phần 2). Một Project
sở hữu mini-ERP riêng cũng là nguyên nhân trực tiếp khiến `ZWorkspaceSale/
LedgerEntry/PayrollRun` scoped nhầm theo `projectId` thay vì `companyId`.

**Hệ quả:** Mọi bản ghi Company-level (Customer, Sale, LedgerEntry, WorkItem…)
có `companyId` bắt buộc + `projectId?` optional attribution — không bao giờ
ngược lại.

## ADR-009 — Identity tách khỏi Membership/Role/Permission

**Quyết định:** `User` chỉ chứa platform identity (id, tên, định danh đăng
nhập, credential linkage, status, profile). Role/quyền luôn scoped qua
`EcosystemMembership`/`CompanyMembership`. `Position` (organizational
identity, vd "Bác sĩ Tim mạch") tách khỏi authorization (`permissionPackRef`
riêng).

**Vì sao:** Đây là distinction bắt buộc của Master Prompt Phần 2 (mục
XVIII–XX) và trực tiếp sửa sai lầm đã xảy ra thật ở ZenithTasks: `User.role`
là enum Clinic-global, và code ở `v2-access.ts` dùng `user.role === "ADMIN"`
làm authority tuyệt đối, bypass hoàn toàn kiểm tra membership theo từng
Company (xem Legacy Capability Matrix mục L-V01).

**Hệ quả:** Không route/policy nào trong Tapdoanytedalinhvuc được phép viết
kiểu `if (user.role === "ADMIN") return true` để cấp quyền truy cập một
Company cụ thể. Ecosystem-level access luôn qua `EcosystemMembership` tường
minh.

## ADR-010 — Organization (Branch/Department/Team) luôn nằm trong Company

**Quyết định:** `OrganizationUnit` luôn có `companyId`, có `parentId?` tạo
cây. Branch không mặc định là Company — chỉ tách thành Company độc lập khi
thực sự là legal/operating boundary khác.

**Vì sao:** Ngăn "workspace explosion" (audit lịch sử đã cảnh báo: nếu để
chi nhánh/phòng khám/dự án đều tạo Company ngang hàng, Founder sẽ phải chọn
giữa hàng chục "company" mà phần lớn thực ra chỉ là phòng ban/chi nhánh).

**Hệ quả:** Company switcher chỉ liệt kê Company thật; Branch chỉ là filter/
subscope trong Company context (header "Phạm vi: Toàn công ty / Hải Phòng /
Hà Nội…"), không rebuild toàn bộ AppShell khi đổi Branch.

## ADR-011 — Migration greenfield qua import/cutover, không sửa trực tiếp DB production của ZenithTasks

**Quyết định:** Toàn bộ dữ liệu từ ZenithTasks di chuyển sang
Tapdoanytedalinhvuc theo luồng: LEGACY SOURCE → READ-ONLY EXTRACT →
TRANSFORM → VALIDATE → STAGING IMPORT → PARITY CHECK → REPEATABLE MIGRATION
→ CUTOVER PLAN → PRODUCTION MIGRATION. Không bao giờ để app mới ghi trực
tiếp vào DB production của ZenithTasks, và migration tooling phải tách khỏi
application runtime code (retire được sau cutover).

**Vì sao:** Đây là repo greenfield khác hẳn, không phải refactor tại chỗ —
không có "dual read/write cùng codebase" như audit từng đề xuất cho phương
án sửa ZenithTasks tại chỗ (phương án đó đã bị override). Migration tooling
phải idempotent (mapping/checkpoint/retry/duplicate detection/verification)
vì đây là thao tác một-lần cực kỳ rủi ro với dữ liệu tài chính/y tế thật.

**Hệ quả:** Không viết migration script chạy thẳng ở Phần 2/3. Việc này
thuộc Phần 10, sau khi toàn bộ domain đã ổn định và có parity check rõ ràng
(Customer count, Finance totals, Open debt, Payroll history, Appointments,
Medical cases, Inventory balances, Audit trails — mục LXXXVII).

## ADR-012 — Company code unique trong phạm vi Ecosystem, không global

**Quyết định:** `Company.code` chỉ bắt buộc unique trong cùng một
`ecosystemId` (`@@unique([ecosystemId, code])`), không unique toàn hệ
thống.

**Vì sao:** Master Prompt Phần 2 mục CXII khuyến nghị rõ hướng này trừ khi
có lý do global; không có lý do nào như vậy ở giai đoạn hiện tại (chỉ 1
Ecosystem). Giữ code scoped theo Ecosystem tránh khoá cứng một namespace
toàn cục không cần thiết khi sản phẩm mở rộng nhiều Ecosystem sau này.

**Hệ quả:** Route `/c/[code]` (Phần 3) resolve Company theo code trong phạm
vi các Ecosystem mà actor có quyền truy cập — nếu tương lai có nhiều
Ecosystem trùng code, đây là giới hạn đã biết, chấp nhận defer UX đa
Ecosystem theo đúng mục CXXIV Master Prompt (xem
`src/lib/authorization/company-context.ts`).

## ADR-013 — Position là template cấp Company, không gắn cứng OrganizationUnit

**Quyết định:** `Position` không có field `organizationUnitId`. Một Position
(vd "Trưởng phòng Kinh doanh") là định nghĩa chức danh dùng chung cho cả
Company, có thể áp dụng ở nhiều đơn vị khác nhau. Nơi một người *thực sự*
giữ Position đó (đơn vị nào) nằm ở `Assignment.organizationUnitId`.

**Vì sao:** Master Prompt Phần 4 mục CLXXIII đưa ra 2 model hợp lệ và yêu
cầu chọn 1 kèm ADR. Model "Position gắn Unit" (vd "Trưởng phòng Kinh doanh —
Hải Phòng") sẽ nhân bản Position theo từng đơn vị nếu chức danh lặp lại ở
nhiều chi nhánh — đúng dạng trùng lặp mục CLXXII tự cảnh báo. Model template
tránh nhân bản, và khớp tự nhiên với `Assignment` đã có sẵn field
`organizationUnitId?` để trả lời "ai giữ vị trí gì, ở đâu, từ khi nào".

**Hệ quả:** Tạo Position mới không cần chọn đơn vị. UI hỏi đơn vị khi tạo
*Assignment* (gán người), không phải khi tạo Position.

## ADR-014 — Một Work Core duy nhất (WorkItem), không tách theo nguồn gốc

**Quyết định:** Toàn bộ "việc cần làm" trong Company — dù tạo bởi nhân viên,
gắn với Project, gắn với Organization Unit, hay (tương lai) do AI đề xuất —
đều là một dòng `WorkItem` duy nhất. Không tạo `ProjectTask`, `ClinicTask`,
`AiTask` riêng.

**Vì sao:** Đây chính là lỗi đã xảy ra thật ở ZenithTasks (`Plan`/`PlanTask`
song song với `ZWorkspaceTask` — 2 engine việc không đồng bộ) và Master
Prompt Phần 4 Law XXVI cấm tuyệt đối lặp lại. `Project`/`OrganizationUnit`
chỉ là **attribution** optional trên `WorkItem` (`projectId?`,
`organizationUnitId?`), không phải chủ sở hữu.

**Hệ quả:** Phần 8 (AI) tạo việc qua cùng application command
(`createWorkItem`) mà User dùng — không có pipeline việc riêng cho AI.

## ADR-015 — Work visibility: MEMBER/VIEWER thấy việc của mình, MANAGER trở lên thấy toàn Company

**Quyết định:** Không xây ACL theo từng `WorkItem`. Thay vào đó, tầng query
áp dụng đúng 2 mức nhìn theo `CompanyMembership.rolePreset`: `MEMBER`/
`VIEWER` chỉ thấy `WorkItem` mà họ là `assigneeUserId` hoặc
`createdByUserId`; `MANAGER`/`COMPANY_ADMIN`/`OWNER` thấy toàn bộ Company
(có phân trang).

**Vì sao:** Master Prompt mục LXXXVIII-LXXXIX yêu cầu "không mặc định mọi
Member thấy tất cả Company tasks" nhưng đồng thời cấm "tạo ACL per task
ngay". Hai mức view (SELF / COMPANY) là mức tối giản thoả cả hai ràng buộc,
không cần bảng phân quyền theo từng WorkItem.

**Hệ quả:** "Hôm nay" (Today) luôn tự nhiên là SELF-scoped cho mọi role.
Trang "Công việc" (danh sách đầy đủ) áp dụng rule 2 mức ở trên. Mở rộng mức
UNIT (Manager chỉ thấy Unit của mình) là backlog hợp lệ, chưa cần Phần 4.

## ADR-016 — Không implement Milestone ở Phần 4

**Quyết định:** Không tạo model `ProjectMilestone` ở Phần 4. Tiến độ Project
tính từ tỷ lệ `WorkItem` hoàn thành/tổng số (mục LXXXII cho phép cả 2 cách,
chọn cách không cần model mới).

**Vì sao:** Master Prompt mục CCXXXII (Simplicity Review) tự đặt câu hỏi "Do
we need milestone now?" — chưa có use case cụ thể nào ở Company đầu tiên
(Bệnh viện Đa khoa Hồng Phúc) đòi hỏi mốc project tách rời khỏi task. Thêm
sau khi có nhu cầu thật rẻ hơn nhiều so với gánh một model không dùng.

**Hệ quả:** `docs/domain/PROJECT.md` ghi rõ đây là DEFERRED, không phải bỏ
sót — thêm lại khi Project thật cần mốc tiến độ tách biệt khỏi task.
