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

## ADR-017 — Lead là entity thật, tách khỏi Customer (không dùng Customer+lifecycle)

**Quyết định:** Implement `Lead` như một model Prisma riêng biệt, với luồng
Lead → (qualify) → convert → `Customer`. Không dồn Lead vào một field
lifecycle trên chính `Customer`.

**Vì sao:** Master Prompt Phần 5 mục IX-X bắt buộc chốt quyết định này bằng
evidence, không suy đoán. Bằng chứng thật từ khảo cổ Phần 1
(`docs/legacy/LEGACY_CAPABILITY_MATRIX.md` dòng L-C04): ZenithTasks có
`Customer` VÀ `Lead` là 2 model tách biệt thật trong production
(`schema.prisma:402-445` Customer, `:464` Lead), có cổng khách công khai
(`/khach-tham-khao`), có test riêng (`leads.test.ts`). Đây chính xác là
"bằng chứng khối lượng lead thật, chưa xác minh, chưa phải khách hàng"
mà mục IX yêu cầu trước khi chọn "LEAD RIÊNG" thay vì "CUSTOMER +
LIFECYCLE". Không tìm thấy entity "Opportunity" nào tương ứng trong toàn bộ
khảo cổ (xem ADR-019) — khác biệt rõ với Lead.

**Hệ quả:** `Lead` không bao giờ bị xoá sau khi convert (giữ lịch sử, mục
XIII). Conversion là 1 transaction: tạo/tái dùng `Customer`, giữ nguyên
`sourceId`/`ownerUserId`, đánh dấu Lead `CONVERTED`, ghi audit
(`LEAD_CONVERTED`). `docs/domain/LEAD.md` mô tả chi tiết.

## ADR-018 — Customer là optional trên Appointment và Sale

**Quyết định:** `Appointment.customerId` và `Sale.customerId` đều nullable.

**Vì sao:** Mục XLIV/LXXX Master Prompt đặt câu hỏi trực tiếp, để mở, yêu
cầu quyết định dựa trên product requirement thay vì giả định chung. Company
generic (không riêng y tế) hoàn toàn có thể dùng Appointment cho mục đích
nội bộ (họp, demo nội bộ) hoặc Sale walk-in không cần định danh khách ngay
lúc bán — bắt buộc `customerId` sẽ chặn các use case hợp lệ này mà không có
bằng chứng thật nào yêu cầu chặn. Nhất quán với chính nguyên tắc "không áp
đặt giả định generic không có bằng chứng" lặp lại nhiều lần trong Phần 5.

**Hệ quả:** UI tạo Appointment/Sale luôn hiển thị chọn khách hàng nhưng
không bắt buộc submit. Nếu một Company cụ thể (vd Bệnh viện Hồng Phúc) cần
bắt buộc customer, thực hiện ở tầng validation Company-cấu-hình sau này
(chưa cần ở Phần 5), không sửa lại schema.

## ADR-019 — Không implement Sales Opportunity ở Phần 5

**Quyết định:** Không tạo model `SalesOpportunity`. `Customer.journeyStage`
+ `Sale` là đủ để trả lời "khách đang ở đâu" và "đã mua gì".

**Vì sao:** Mục XXXIX-XLI đánh dấu Opportunity là OPTIONAL, yêu cầu kiểm tra
legacy trước khi build. Khảo cổ Phần 1 xác nhận: `grep -i opportunity` trên
toàn bộ `LEGACY_CAPABILITY_MATRIX.md` và `LEGACY_TO_TARGET_MAP.md` — **0
kết quả**. Không một khách hàng thật, một dòng code, hay một test nào của
ZenithTasks nhắc tới khái niệm "cơ hội bán hàng chưa chốt" tách rời khỏi
Customer/Sale. Xây Opportunity lúc này đúng dạng "CRM enterprise ceremony"
mục XXXIX tự cảnh báo.

**Hệ quả:** Nếu sau này có Company thật cần theo dõi "deal trị giá X đang
đàm phán, chưa chốt", thêm `SalesOpportunity` lúc đó kèm ADR mới — không
pre-bake trước.

## ADR-020 — Không implement Customer Merge ở Phần 5

**Quyết định:** Không xây tính năng gộp 2 Customer trùng lặp. Trùng lặp chỉ
cảnh báo (duplicate-warning UX theo `normalizedPhone`), không tự động/thủ
công gộp.

**Vì sao:** Mục XIX chỉ yêu cầu Merge "nếu legacy thực sự có duplicate
nhiều". Khảo cổ Phần 1 không định lượng được khối lượng duplicate thật của
Customer legacy (không có số liệu cụ thể trong `LEGACY_CAPABILITY_MATRIX.md`
dòng L-C04) — không đủ bằng chứng để build một tính năng có rủi ro dữ liệu
cao (gộp sai = mất lịch sử). Đúng nguyên tắc "không xây trước khi có bằng
chứng cần" đã áp dụng nhất quán từ Phần 2.

**Hệ quả:** Trùng `normalizedPhone` trong cùng Company chỉ hiện cảnh báo
"Có thể khách hàng này đã tồn tại" khi tạo Customer mới — nhân viên tự
quyết định tạo tiếp hay dùng lại record cũ. Thêm Merge thật khi có bằng
chứng khối lượng cụ thể từ Company đang vận hành.

## ADR-021 — Sale discount là số tiền cố định trên từng dòng, không port Mechanism engine

**Quyết định:** `SaleLine.discountAmount` là số tiền VND cố định do người
tạo Sale nhập trực tiếp trên từng dòng. Không port `ZMechanismDefinition`/
`ZMechanismVersion` (rule engine hoa hồng/chiết khấu) của ZenithTasks vào
Phần 5.

**Vì sao:** Mục LXXVII/LXXVIII/CCXLIV yêu cầu kiểm tra legacy trước khi
quyết định có discount rule nào cần giữ, và cấm tuyệt đối tự động port
Mechanism engine. Khảo cổ Phần 1 (`LEGACY_TO_TARGET_MAP.md` dòng
`ZMechanismDefinition`/`ZMechanismVersion`) đã xác nhận: engine này ở
ZenithTasks **DRAFT-only theo thiết kế, chưa từng nối vào Sale/Payroll
thật** — không phải logic nghiệp vụ đã chứng minh, mà là guardrail chưa
kích hoạt. Port một engine chưa từng chạy thật vào Sale mới đúng dạng
"xây trước khi có bằng chứng cần" — vi phạm chính nguyên tắc CLAUDE.md.
Hoa hồng thật (bác sĩ 8%/10%, tư vấn viên theo bậc — L-C07) vẫn là tài sản
quý, nhưng thuộc phạm vi Payroll Phần 6, không phải Sales Phần 5 (mục
LXXIX: Sale chỉ giữ dữ liệu attribution, không tự tính hoa hồng).

**Hệ quả:** Sale/SaleLine giữ đủ dữ liệu attribution (`salespersonUserId`,
`unitPrice`, `discountAmount`, `lineTotal`) để Phần 6 tính hoa hồng sau này
mà không cần sửa schema Sales. Nếu Mechanism engine thật sự cần, salvage lại
ở Phần 6 kèm bằng chứng nối vào Payroll cụ thể.

## ADR-022 — CRM/Appointment/Sales visibility là Company-wide theo permission, KHÔNG theo ownerUserId

**Quyết định:** `customer.view`/`appointment.view`/`sales.view` cấp quyền
xem **toàn bộ** record của Company — KHÔNG lọc theo `ownerUserId`/
`assignedUserId`/`salespersonUserId`. Owner/assignee/salesperson chỉ là dữ
liệu thuộc tính nghiệp vụ (ai đang phụ trách), không phải ranh giới truy
cập. Đây KHÔNG phải cùng pattern với `WorkItem` (ADR-015).

**Vì sao:** Mục CLVI nói thẳng, không mập mờ: *"customer.ownerUserId does
not by itself define a security boundary — the permission system decides
visibility."* Đây là chỉ dẫn ngược hẳn với ADR-015 (nơi MEMBER chỉ thấy
`WorkItem` của chính mình) — và có lý do nghiệp vụ rõ ràng: lễ tân cần trả
lời điện thoại cho BẤT KỲ khách nào gọi tới, không chỉ khách "của mình";
nhân viên bán hàng cần thấy toàn bộ khách/lịch hẹn để tránh liên hệ trùng 1
khách 2 lần. Mục CLIV/CLV chỉ cho phép UNIT-based filter là khả năng tương
lai tuỳ chọn ("nếu có bằng chứng thật"), không phải hành vi mặc định hạn
chế như Work Core.

**Hệ quả:** `getCustomerList`/`getAppointments`/`getSales` trả về toàn bộ
record của Company cho bất kỳ actor nào có đúng `.view` permission — không
có `scopeFilter` kiểu `getCompanyWork()`. UI có thể cho lọc "của tôi" như 1
filter tiện lợi (query param client chọn), không phải security boundary
server áp đặt. Nếu sau này có Company thật cần giới hạn theo Unit/Team,
thêm UNIT-level filter kèm ADR mới — không pre-bake.

## ADR-023 — Customer.phone mã hoá tại rest, không có cơ chế "reveal có audit" riêng ở Phần 5

**Quyết định:** `Customer` lưu `phoneCiphertext` (AES-256-GCM) +
`phoneHash` (SHA-256 của số đã chuẩn hoá, dùng để tra trùng) thay vì lưu số
điện thoại dạng plaintext. Không xây cơ chế ẩn-số-mặc-định + nút "hiện số"
có audit riêng như legacy.

**Vì sao:** `docs/architecture/DATA_OWNERSHIP.md` (Phần 2) đã chốt Customer
PII ở mức **Cao**, và khảo cổ Phần 1 xác nhận ZenithTasks có pattern mã hoá
SĐT AES-256-GCM thật đang chạy production (L-P04, L-C04
`phoneEnc`/`phoneHash`) — đáng salvage nguyên pattern (không copy code/khoá)
để chống lộ PII qua backup/dump DB thô. Tuy nhiên bản thân văn bản Phần 5 (đã
đọc toàn bộ, không chỉ suy đoán) **không** yêu cầu thêm cơ chế "reveal có
audit" — chỉ yêu cầu (mục CLVIII/CLIX) không log số đầy đủ và audit metadata
dùng ID thay vì dump nguyên Customer. Quyền xem Customer (qua
`customer.view` + Company scope, đã audit ở tầng CompanyMembership) đã là
lớp kiểm soát truy cập cho việc dùng số điện thoại hàng ngày (gọi khách) —
thêm 1 lớp "reveal audit" riêng nữa là over-engineering không có yêu cầu cụ
thể trong chính Phần 5.

**Hệ quả:** `src/lib/crypto/phone.ts` cung cấp `normalizePhone`,
`hashPhone`, `encryptPhone`/`decryptPhone`. Mọi đọc Customer hợp lệ (đã qua
`customer.view` + Company scope) tự động thấy số đã giải mã — không có bước
"reveal" riêng. Nếu sau này có yêu cầu compliance cụ thể (vd audit trail chi
tiết hơn cho việc xem PII), thêm khi có bằng chứng, không pre-bake.

# Phần 6 — Finance + Payment + Receivable + Ledger + Payroll + Commission + Inventory

## ADR-024 — LedgerEntry: bản ghi tài chính canonical, thuộc Company, bất biến (Void + correction entry, không sửa/xoá)

**Quyết định:** Tạo `LedgerEntry` làm nguồn sự thật tài chính duy nhất
(canonical financial history) của Company. Field bắt buộc: `companyId`,
`type` (enum kiểm soát nhưng không over-enum: `SALE_RECEIPT`, `EXPENSE`,
`SALARY_PAYMENT`, `COMMISSION_PAYMENT`, `REFUND`, `ADJUSTMENT`, `OTHER`),
`amount` (Decimal, luôn **không âm** — chiều tiền suy ra từ `type`, không
dùng số có dấu, xem ADR-032), `occurredAt` (currency derive từ
`Company.currency`, xem ADR-033), `sourceType` +
`sourceId` (discriminated reference tới `SALE`/`PAYMENT`/`EXPENSE`/
`PAYROLL_RUN`/`MANUAL` — không dùng generic polymorphic object graph),
`status` (`POSTED`/`VOID`), `voidedAt`/`voidedByUserId`/`voidReason`,
`correctionOfEntryId` (self-FK nullable — entry này sửa entry nào, entry
sửa lỗi luôn là **entry mới**, không patch entry cũ), `createdByUserId`,
`createdAt`. Attribution optional: `organizationUnitId`, `projectId`,
`customerId`.

**Vì sao:** Mục IX/X/XXI/XXII yêu cầu rõ: `companyId` bắt buộc là owner
chính (KHÔNG `projectId`), ghi đè/sửa trực tiếp bị cấm, correction phải là
entry mới. Khảo cổ xác nhận cụ thể: `ZWorkspaceLedgerEntry`
(`schema.prisma:1805`, repo legacy) đã có đúng pattern
`status`(POSTED/VOIDED)+`voidedAt`+`voidReason` — chứng minh void-based
immutability khả thi — nhưng **owner là `projectId`, không có `companyId`**,
tức mắc đúng lỗi "Company ≠ Project" mà ADR-003 của chính repo target đã ghi
nhận là sai lầm lớn nhất của ZenithTasks; và **không có field liên kết
correction entry nào** (chỉ Void, chưa có Correction-là-entry-mới thật).
`CashTransaction` (`schema.prisma:902`) salvage được category taxonomy
nhưng bị xoá cứng qua `deleteCashTransaction` (BAN-GIAO.md mục 7) — vi phạm
trực tiếp bất biến, phải discard hành vi này.

**Hệ quả:** Không có double-entry accounting, không chart of accounts, chỉ
1 dòng `LedgerEntry` mỗi giao dịch tiền (operational finance, không phải
ERP kế toán — mục VIII). Mọi ghi tiền (Payment/Expense/Payroll payout) đều
tạo đúng 1 `LedgerEntry` trong cùng transaction DB.

## ADR-025 — Payment (tiền vào từ Sale) và Expense (tiền ra của Company) là 2 entity tách biệt; Sale ≠ Payment ≠ Ledger

**Quyết định:** `Payment` chỉ đại diện tiền **vào** gắn với một `Sale`
(companyId, saleId, customerId suy từ Sale, amount, method, occurredAt,
reference?, status POSTED/VOID, voidedAt/voidedByUserId/voidReason,
createdByUserId). `Expense` đại diện tiền **ra** của Company (companyId,
category — enum đóng: `RENT`/`MARKETING`/`SALARY`/`SUPPLIES`/`UTILITIES`/
`OTHER`, amount, occurredAt, organizationUnitId?/projectId? attribution,
sourceType/sourceId khi phát sinh tự động từ Payroll). Cả hai đều tạo đúng
1 `LedgerEntry` (ADR-024) trong cùng `$transaction`. Trả lương/hoa hồng khi
Payroll finalize+pay tái dùng `Expense` (category=`SALARY`,
sourceType=`PAYROLL_RUN`) — **không** tạo model thanh toán song song (đúng
mục LVI "tái dùng Payment/Expense đã có").

**Vì sao:** Mục VI cấm dùng 1 bảng Sale đại diện cả Sale/Payment/Ledger.
Khảo cổ cho thấy chính legacy đã trộn 2 khái niệm Payment và Expense/Ledger
vào 1 bảng `CashTransaction` (field `category` kiểu Rent/Marketing/Salary
nằm chung với field `method` kiểu thanh toán) — đúng cái bẫy mục XXXVI đang
cảnh báo tách ra. Toàn bộ mục XVI-XX (partial/overpayment/refund/void) chỉ
nói về Payment gắn Sale/receivable, không nhắc Expense — xác nhận Payment
nên là entity **1 chiều, gắn Sale**, đơn giản hơn thiết kế "Payment có field
`direction`" (tránh luôn rủi ro "ambiguous signed amount" mục CIX nêu).
Legacy `Payment` thật (`schema.prisma:674`) **xoá được trực tiếp** (audit
action `DELETE_PAYMENT`/`UPDATE_PAYMENT` theo BAN-GIAO.md mục 9) — vi phạm
trực tiếp nguyên tắc Void-not-delete của Phần 6, PHẢI discard hành vi này,
chỉ salvage shape field (case-linked, method, paidAt→occurredAt,
receivedBy→createdByUserId, `clientNonce` chống double-submit → tiền lệ
tốt cho idempotency, xem ADR-034).

**Hệ quả:** `PaymentAllocation` (Payment trả nhiều Sale cùng lúc) **không**
build ở Phần 6 — không có bằng chứng nghiệp vụ đa-Sale-1-Payment (mục XVI
"không overmodel"); `Payment.saleId` là đủ. Nếu sau này cần, thêm bảng
allocation kèm ADR mới.

## ADR-026 — Receivable/Công nợ là giá trị derive, không lưu bảng riêng ở Phần 6

**Quyết định:** Công nợ khách hàng = `Sale.totalAmount − Σ Payment.amount
(status POSTED) của Sale đó`, tính on-the-fly qua hàm domain thuần
(`getCustomerReceivable`), **không** có bảng `Receivable` lưu trữ.

**Vì sao:** Mục VII cho phép rõ "không lưu outstanding như source-of-truth
nếu derive đáng tin; có thể cache/read-model nếu performance cần". Khảo cổ
xác nhận legacy đã làm ĐÚNG pattern này từ lâu: legacy **không có** model
Debt/Receivable riêng (grep xác nhận không tồn tại) — `CaseRecord` (đóng
vai Sale) có field cache `debtAmount = max(net−paid, 0)` được tính lại
**nguyên tử** qua `recalc(caseId)` trong `lib/financial-summary.ts`, chạy
dưới `withCaseLock` (`$transaction` + `SELECT ... FOR UPDATE`, theo
BAN-GIAO.md mục 9) — đây chính là "cached-derived-value + transactional
recalc under row lock" mà mục VII gợi ý, đã chứng minh hoạt động thật.
Salvage đúng pattern này (derive trước, cache/lock sau nếu cần), không xây
bảng Receivable riêng ngay từ đầu (YAGNI — quy mô Phần 6 MVP chưa cần).

**Hệ quả:** `Receivable write-off` (mục XLI) không build (defer, đúng
"chỉ làm khi thật cần"). Nếu khối lượng dữ liệu multi-company sau này chứng
minh cần cache, thêm field/bảng cache kèm ADR mới — không pre-bake.

## ADR-027 — Payroll: một engine đích duy nhất (PayrollProfile + PayrollRun + PayrollItem), gộp toàn bộ 3 hệ legacy, snapshot bất biến sau Finalize

**Quyết định:** `PayrollProfile` (companyId, userId, baseSalary,
effectiveFrom, effectiveTo? — **không bao giờ overwrite tại chỗ**, đổi
lương = tạo dòng mới đóng dòng cũ). `PayrollRun` (companyId, periodStart,
periodEnd, status: `DRAFT`→`CALCULATED`→`APPROVED`→`FINALIZED`/`VOIDED`,
approvedByUserId/approvedAt, finalizedByUserId/finalizedAt,
voidedByUserId/voidedAt/voidReason). `PayrollItem` (payrollRunId, userId,
baseAmount, commissionAmount, bonusAmount, deductionAmount, netAmount,
`calculationSnapshot` Json **bắt buộc** — đóng băng input/công thức tại
thời điểm tính, không bao giờ đọc lại `PayrollProfile`/`CommissionRule`
hiện tại để tính lại lịch sử). Sau `FINALIZED`: không mutate ngược, correction
= `PayrollRun` bổ sung mới tham chiếu run gốc (đúng nguyên tắc
Ledger-immutable/correction-là-entry-mới áp dụng xuyên suốt Phần 6, không
chỉ riêng LedgerEntry).

**Vì sao:** Mục CLXVIII đòi hỏi rõ "One target Payroll engine only". Khảo
cổ xác nhận **3 hệ payroll khác nhau, không tương thích** cùng tồn tại
trong legacy: (1) `PayrollEntry` (schema.prisma:373, production thật) —
flat 1-dòng/tháng, `commission` **nhập tay**, sửa được bất kỳ lúc nào tới
khi khoá kỳ kế toán, không có run/batch/snapshot — vi phạm trực tiếp
LIII/LIV; (2) `ZWorkspacePayrollRun`/`Line` (schema.prisma:1856, V2
DRAFT-only, chưa từng apply migration vào production DB theo CLAUDE.md
legacy mục 14) — CÓ đúng kiến trúc run+line tách bạch,
`snapshot`(Json, bắt buộc) đúng tinh thần LI, nhưng owned by `projectId`
(sai Company≠Project) — salvage kiến trúc, migrate ownership; (3)
`ZMechanismDefinition`/`Version` (schema.prisma:1939, rule engine JSON
DRAFT-only, chưa từng nối settlement thật) — không dùng làm nền tính lương
(xem ADR-030 riêng cho Commission). `User.baseSalary` (field phẳng, không
lịch sử) là đúng lỗ hổng mục XLVIII cảnh báo — discard, bắt buộc
`PayrollProfile` effective-dated.

**Hệ quả:** `payType` chỉ hỗ trợ `MONTHLY` ở Phần 6 (không có bằng chứng
legacy dùng HOURLY/khác). Payslip UI (mục LIX) optional, có thể hoãn nếu
scope lớn. Không build recruitment/performance review/leave system (mục
XLVI).

## ADR-028 — ApprovalRequest: một primitive two-person-approval dùng chung, mô phỏng theo `AssistantApproval` (đã production-tested), không theo `ZWorkspacePayrollRun`

**Quyết định:** Xây MỘT entity `ApprovalRequest` (companyId, actionType
enum đóng, targetType/targetId, requestedByUserId, reason, status:
`PENDING`→`PENDING_SECOND`→`APPROVED`/`REJECTED`/`EXPIRED`,
`firstApprovedByUserId`/`firstApprovedAt`, `resolvedAt`) dùng chung cho MỌI
hành động rủi ro cao cần 2 người duyệt ở Phần 6 (xem danh sách cụ thể ở
ADR-029). Bất biến bắt buộc: người thực hiện bước chuyển
`PENDING_SECOND`→`APPROVED` PHẢI khác `firstApprovedByUserId`.

**Vì sao:** Tự tay khảo cổ và **verify độc lập bằng grep thật** (không chỉ
tin theo tóm tắt) vào `C:\Users\PC\ZenithTasks`, xác nhận có ĐÚNG 2 cơ chế
two-person-approval độc lập trong legacy, và chỉ 1 trong 2 đã thật sự chạy
production có test PASS: **(1)** `AssistantApproval`
(`schema.prisma:1090`, migration `20260829220000_assistant_two_person_approval`)
— dùng pattern status-driven: enum `AssistantApprovalStatus` có
`PENDING`/`PENDING_SECOND`/`APPROVED`/`REJECTED`/`EXPIRED`, MỘT field
`firstApprovedById`/`firstApprovedAt` (không phải 2 field riêng), guard tại
`web/src/app/(app)/tro-ly/agent.ts:1013`:
`if (approval.status === "PENDING_SECOND" && approval.firstApprovedById === user.id) return planError(...)`
— chặn đúng người vừa duyệt lần 1 tự duyệt lần 2. Có test tích hợp thật
`web/src/app/(app)/tro-ly/two-person-approval.itest.ts` chạy đủ kịch bản
PENDING→duyệt 1→PENDING_SECOND→tự duyệt bị từ chối→người khác duyệt→thực
thi thật+AuditLog, PASS (check doc MC-21). **(2)** `ZWorkspacePayrollRun`
(`schema.prisma:1856`) dùng pattern 2 field riêng
`approvedById`/`secondApprovedById` + hàm
`hasTwoDistinctPayrollApprovals()` (`v2-payroll-policy.ts`) — kiến trúc
tương đương nhưng thuộc layer V2 **chưa từng apply migration vào DB
production** (CLAUDE.md legacy mục 14). Vì (1) là cơ chế duy nhất đã kiểm
chứng chiến trường thật (production feature, real test PASS), Phần 6 dùng
pattern status-driven của (1) làm primitive chung, thay vì pattern
2-field-riêng của (2) — đúng mục CCXXXIII "dùng chung 1 shared foundation,
không tạo approval engine thứ 2", và đúng nguyên tắc CLXX/CLXXI "source
code + test thật thắng lời kể/tài liệu cũ" (tài liệu quản trị cũ của chính
legacy nói "two-person duyệt chưa được nối" — nhưng đó là mô tả LỖI THỜI,
migration+test thật cho thấy nó ĐÃ được nối xong).

**Hệ quả:** Không tạo bảng approval riêng cho từng domain (Payroll có
`ApprovalRequest` riêng, Inventory có cái khác) — dùng chung 1 bảng, phân
biệt qua `actionType`. Part 8 (Decision Inbox) sau này có thể thay thế/mở
rộng primitive này, không phải xây lại từ đầu.

## ADR-029 — Phạm vi bắt buộc two-person approval ở Phần 6: chỉ `PayrollRun.finalize` và Inventory `ADJUSTMENT`; các hành động rủi ro khác dùng single-approver + reason + audit

**Quyết định:** Chỉ 2 hành động bắt buộc qua `ApprovalRequest` 2 người:
(1) `PayrollRun` chuyển `APPROVED`→`FINALIZED`; (2) mọi `StockMovement`
`type=ADJUSTMENT_IN`/`ADJUSTMENT_OUT`. Các hành động rủi ro khác — Payment void, Ledger manual
correction, Commission manual override — chỉ cần permission tương ứng +
`reason` bắt buộc + audit, **không** bắt buộc 2 người duyệt.

**Vì sao:** Mục XXIX nói rõ "không áp dụng two-person cho mọi Payment
nhỏ". Khảo cổ cho thấy chính legacy CŨNG chỉ dùng two-person cho đúng 2 loại
hành động thảm hoạ nhất — Payroll finalize (`ZWorkspacePayrollRun`) và hành
động L5 AI-dispatcher (xoá Customer qua `AssistantApproval`) — mọi hành
động tài chính khác của legacy (`PaymentRequest`, "giấy đề nghị thanh
toán") chỉ dùng **1 approver** (`approverId` đơn), đã chạy production thật
ổn định. Inventory Adjustment được thêm vào danh sách bắt buộc 2 người vì
đây là con đường DUY NHẤT một người có thể tự ý "gõ số tồn kho mới" (khác
IN/OUT/TRANSFER vốn luôn có nguồn gốc từ Sale/nhập kho có evidence) — mục
LXXXIII liệt kê "large adjustment" là VERY HIGH RISK, và vì không có
threshold "large" nào được business chứng minh (mục CCLXIV "chỉ dùng
threshold configurable/business-proven"), quyết định an toàn hơn là bắt
buộc 2 người cho **mọi** Adjustment thay vì bịa một ngưỡng số tiền/tồn kho
tuỳ tiện.

**Hệ quả:** `finance.payment.void`, `finance.correction.create`,
`commission.override.manual` chỉ cần 1 permission phù hợp + lý do bắt buộc.
Nếu Company thật sau này chứng minh cần 2 người cho void/correction ở
ngưỡng lớn, thêm `actionType` mới vào `ApprovalRequest` kèm ADR — không
pre-bake ngưỡng số tiền chưa có bằng chứng.

## ADR-030 — Commission: `CommissionRule` Company-scoped với 3 loại đóng, không port rule engine tổng quát; allocation tường minh để tránh double-count

**Quyết định:** `CommissionRule` (companyId, name, type đóng:
`PERCENTAGE_OF_SALE`/`FIXED_PER_ITEM`/`TIERED_THRESHOLD`, config Json theo
đúng shape của từng type — không phải DSL tự do, status
`DRAFT`/`ACTIVE`/`RETIRED`, effectiveFrom/effectiveTo). Khi tính hoa hồng
cho 1 Sale, mỗi người đóng góp (contributor) + vai trò tạo **1 dòng**
`CommissionCalculation` (saleId, payrollItemId?, userId, role, ruleId,
allocationBps, amount, snapshot Json) — `allocationBps` của tất cả dòng
cùng 1 Sale **không được vượt quá tổng dự kiến** (kiểm tra tường minh bằng
unit test, không dựa vào 2 field boolean độc lập cộng dồn ngầm định).

**Vì sao:** Đây là fix trực tiếp cho **lỗi thật đã xảy ra trong production
legacy** — `FINANCE-DEFINITIONS.md` (root repo legacy) ghi nhận rõ: khi 1
người vừa là consultant vừa là doctor của cùng 1 case, `getStaffPerformance()`
cộng CẢ `consultRevenue` LẪN `doctorRevenue` một cách độc lập → double-count
(case 48.000.000đ hiện ra 96.000.000đ). File này cũng định nghĩa sẵn quy
tắc phân bổ đúng (coordination-based allocation, tổng % phải =100%, phần dư
rounding gán cho assignment cuối theo thứ tự ổn định) kèm bộ test case cụ
thể (case 60/40 → 28.8M/19.2M; case 3 người 33.33/33.33/33.34% → tổng khớp
tuyệt đối) — `Salvage Ledger` mục "Bài học không được lặp lại" đã ghi nhận
bài học này từ Phần 1, yêu cầu tường minh "hoàn tất `CaseRevenueAllocation`
migration trước khi salvage công thức hoa hồng". Về kiến trúc rule: mục
LXII/LXIII tạo fork rõ — không build universal rules engine ngay, nhưng cần
entity cấu hình được. Khảo cổ xác nhận `commission.ts` (calculator ĐANG
CHẠY THẬT, có unit test) chỉ là công thức % cứng theo vai trò của RIÊNG 1
phòng khám thẩm mỹ — không tái dùng được cho đa ngành/đa Company của
Tapdoanytedalinhvuc; `ZMechanismDefinition`/`Version` là rule engine JSON
tổng quát nhưng **chưa từng nối vào settlement thật** (DRAFT-only xuyên
suốt) — không đủ điều kiện làm nền. 3 type đóng (percentage/fixed/tiered)
là điểm cân bằng: Company-configurable (khác `commission.ts` hard-code)
nhưng không phải DSL tự do (khác `ZMechanismVersion.ruleSpec`).

**Hệ quả:** Không port công thức 8%/10%/100k/4% của legacy (đặc thù 1
phòng khám). Commission KHÔNG tự động ghi `PayrollItem.commissionAmount` —
chỉ là **gợi ý** hiển thị, người có quyền phải xác nhận trước khi
`PayrollRun` chuyển `CALCULATED` (tiền lệ thật: legacy đã TỪNG có auto-%
rồi chủ động bỏ để chuyển về nhập tay+gợi ý vì lý do niềm tin/kiểm soát —
`commission.ts` chỉ "Dùng số này", không tự ghi đè `PayrollEntry.commission`
— bài học áp dụng nguyên cho Phần 6, đúng tinh thần CODE COMPUTES nhưng con
người vẫn xác nhận trước khi ghi sổ chính thức).

## ADR-031 — Inventory: `StockMovement` là nguồn sự thật duy nhất, `StockBalance` luôn derive; không xây cost/valuation ở Phần 6

**Quyết định:** `InventoryItem` (companyId, catalogItemId? — optional link
về `CatalogItem` Phần 5, sku?, name, unit, trackStock, status).
`InventoryLocation` (companyId, name, type: `WAREHOUSE`/`BRANCH`/`STORAGE`,
organizationUnitId?). `StockMovement` (companyId, inventoryItemId,
locationId, type: `IN`/`OUT`/`ADJUSTMENT_IN`/`ADJUSTMENT_OUT`/`TRANSFER_IN`/
`TRANSFER_OUT` (2 type riêng cho Adjustment — cùng lý do TRANSFER tách
IN/OUT, vì quantity luôn dương nên chiều giảm tồn kho cần type riêng),
quantity **luôn dương** — chiều suy từ `type`, sourceType/sourceId, reason?
bắt buộc khi `ADJUSTMENT_IN`/`ADJUSTMENT_OUT`, `idempotencyKey` unique per
Company — bắt buộc
cho `TRANSFER` để ghép cặp OUT+IN nguyên tử và chặn duplicate-transfer,
actorUserId). Số dư tồn kho **không phải cột lưu trữ** — luôn tính qua
`SUM(quantity theo dấu suy từ type)` tại thời điểm đọc. Âm kho bị chặn mặc
định; chỉ vượt qua được nếu actor có permission
`inventory.adjust.negativeOverride` + `reason` bắt buộc + audit. Chuyển kho
cross-company: chặn cứng (companyId 2 đầu Location phải khớp).

**Vì sao:** Mục LXXVIII cấm cột số lượng editable trực tiếp làm
source-of-truth — khảo cổ xác nhận CHÍNH XÁC đây là anti-pattern legacy
đang mắc: `Material.stock` (`schema.prisma:547`) là cột Decimal **mutable**
được `addMaterial()` (`ho-so/actions.ts:843-900`) update trực tiếp
(`decrement`) SONG SONG với ghi `StockMovement` trong cùng transaction —
dual-write, không phải derive-từ-movement. Phải discard cấu trúc này dù
phần "SELECT...FOR UPDATE + chặn âm kho" của nó đáng salvage (giữ nguyên ý
tưởng lock+guard, áp dụng lên transaction ghi Movement thay vì ghi cột
cache). Về valuation: `Material.avgCost` + `lib/inventory-cost.ts`
(weighted-average cost, có test) **có thật và đang chạy production** — xung
đột trực tiếp với mục XC "không build FIFO/LIFO/weighted-cost trừ khi cần".
Không có bằng chứng nghiệp vụ cụ thể nào của Tapdoanytedalinhvuc (đa ngành,
không riêng 1 phòng khám) đòi hỏi giá vốn ngay ở Phần 6 — quyết định KHÔNG
port valuation, ưu tiên chỉ dẫn tường minh của Master Prompt hơn parity với
1 tính năng legacy cụ thể (mục CLXXI "source code thắng" áp dụng cho việc
XÁC NHẬN cái gì tồn tại, không phải quyết định cái gì PHẢI build — bản thân
Master Prompt mới là nguồn quyết định scope). `Warehouse`/multi-location:
KHÔNG tồn tại trong legacy (1 phòng khám = 1 địa điểm) — thiết kế mới hoàn
toàn cho Phần 6, không phải migration.

**Hệ quả:** Không có Supplier/PurchaseOrder (mục XCIII/XCIV, legacy cũng
chưa từng có). `TRANSFER_IN`/`TRANSFER_OUT` là 2 type riêng (không gộp
thành cặp IN/OUT thường) để lịch sử tự mô tả rõ và `idempotencyKey` có chỗ
neo rõ ràng cho cặp giao dịch.

## ADR-032 — Tiền ở Phần 6: tiếp tục `Decimal(18,2)` VND, amount không âm + chiều qua entity/type, làm tròn nguyên VND; Server Action không bao giờ trả thẳng object chứa `Decimal`

**Quyết định:** Mọi field tiền dùng `Decimal @db.Decimal(18,2)` (kế thừa
convention Phần 5), luôn lưu giá trị **không âm**; chiều thu/chi suy ra từ
entity (`Payment`=vào, `Expense`=ra) hoặc `type` (`LedgerEntry`,
`StockMovement`), không dùng số có dấu. Làm tròn số nguyên VND kiểu
round-half-up (`Math.round`, đúng convention `sale-totals.ts` Phần 5).
**Bắt buộc**: mọi hàm trong `src/lib/actions/*.ts` liên quan Phần 6 không
được trả thẳng object Prisma chứa field `Decimal` qua boundary Server
Action → Client Component — chỉ trả field client thực sự dùng (thường chỉ
`{ id }`) hoặc convert `Decimal`→`number` tường minh trước khi trả.

**Vì sao:** Mục CIX/CX/CCXLVI đặt ra đúng những câu hỏi Phần 5 đã thực sự
gặp phải: Phần 5 có **bug thật đã xảy ra** — `confirmSaleAction`/
`cancelSaleAction` (`sales-actions.ts`) trả thẳng object Prisma Sale chứa
`Decimal` qua Server Action, gây lỗi console "Only plain objects can be
passed..." mỗi lần gọi (đã sửa, xem `RED_TEAM_CODE_REVIEW_PART5.md` và
checkpoint Phần 5). Phần 6 có MẬT ĐỘ field `Decimal` cao hơn hẳn Phần 5
(Payment/Expense/LedgerEntry/PayrollItem/CommissionCalculation/StockMovement
đều có ít nhất 1 field tiền/số lượng) — rủi ro lặp lại bug này cao hơn
nhiều nếu không chốt quy tắc tường minh ngay từ đầu thay vì để tới lúc
browser-test mới phát hiện.

**Hệ quả:** `docs/domain/*.md` Phần 6 phải nhắc lại quy tắc này ở đầu mỗi
file liên quan tiền. Mọi domain service Phần 6 export hàm tính thuần
(`calculateXxx`) tách khỏi Prisma, có unit test riêng — đúng pattern
`sale-totals.ts` đã chứng minh đúng ở Phần 5.

## ADR-033 — Không xây multi-currency/FX engine ở Phần 6; tái dùng `Company.currency` có sẵn từ Phần 3

**Quyết định:** Mọi amount ở Phần 6 giả định cùng currency với
`Company.currency` (field đã tồn tại từ Phần 3, `String @default("VND")`)
— không thêm field currency mới ở cấp entity. Không xây FX conversion,
không field `foreignAmount`/conversion policy.

**Vì sao:** Mục CV/CVI cho phép rõ "trừ khi thật sự cần" — không có Company
thật nào trong hệ thống hiện tại (Company Hồng Phúc, dữ liệu dev) cần đa
tiền tệ, và khảo cổ không tìm thấy legacy có currency field nào (legacy
`CashTransaction`/`Payment` không có `currency`). `Company.currency` đã có
sẵn từ Phần 3 nên không cần migration schema mới cho việc này; chỉ cần
KHÔNG xây engine convert (đắt, chưa có nhu cầu).

**Hệ quả:** `LedgerEntry` không cần field `currency` riêng (derive từ
`Company.currency` qua `companyId`), không có UI chọn tiền tệ khác cho bất
kỳ entity Phần 6 nào.

## ADR-034 — Idempotency key bắt buộc cho command tiền/kho rủi ro cao

**Quyết định:** `recordPayment`, `transferStock`, `adjustStock`,
`finalizePayroll` (và tương đương) nhận `idempotencyKey` do caller cung
cấp (hoặc tự sinh ổn định từ input tại tầng action nếu UI chưa gửi được);
DB có unique constraint `[companyId, idempotencyKey]` (hoặc tương đương)
trên bảng liên quan để chặn double-post khi client retry/network lặp.

**Vì sao:** Mục CXIII-CXVII yêu cầu tường minh idempotency + double-posting
+ duplicate-payment + payroll-double-finalize + inventory-double-deduction
guard. Legacy có tiền lệ salvage được: `Payment.clientNonce`
(`schema.prisma:674`, unique) chống double-submit; `CommissionPayout` có
unique kép `[name, month]` VÀ `[collaboratorId, month]` chống chi trùng hoa
hồng cùng kỳ — cả 2 đều là bằng chứng thật cho pattern "unique constraint
theo entity+period/request" hiệu quả trong production.

**Hệ quả:** Test bắt buộc (mục CXCVII/CCXIII "TEST — DUPLICATE POST"/
"TEST — TRANSFER") phải retry cùng idempotencyKey và assert không tạo bản
ghi thứ 2.

## ADR-035 — Không xây AccountsPayable/Invoice kế toán/PurchaseOrder/Supplier/BankReconciliation/Tax/ShareholderDistribution/CostCenter/Company-level-Budgeting ở Phần 6

**Quyết định:** Không tạo model/engine cho: hoá đơn kế toán (Invoice, có số
+ trạng thái riêng), Accounts Payable (vendor), Purchase Order, Supplier,
đối soát ngân hàng, khai/nộp thuế, phân phối lợi nhuận cổ đông, cost center,
ngân sách cấp Company (Project budget nếu đã có ở Phần khác thì giữ nguyên,
không mở rộng).

**Vì sao:** Mục CL-CLXVI liệt kê các hạng mục này với điều kiện "defer trừ
khi legacy dùng/yêu cầu" — khảo cổ xác nhận **legacy KHÔNG có bất kỳ model
nào trong nhóm này** (grep `Invoice`/`AccountsPayable`/`Payable`/
`PurchaseOrder`/`Supplier`/`Loan`/`Capital`/`ShareholderDistribution`/
`CostCenter` trong `schema.prisma`: không khớp — "hoá đơn" legacy chỉ là
trang in derive từ `Payment`/`CaseService` sẵn có, "Payable" chỉ là biến
tính toán lồng trong Payroll/Commission, không phải AP ledger). Không có
áp lực parity nào từ legacy, và mục VIII đã cấm tường minh xây ERP kế toán
đầy đủ khi chưa cần.

**Hệ quả:** `docs/architecture/LEGACY_TO_TARGET_MAP.md` ghi các hạng mục
này là DEFER (không phải KEEP_CONCEPT), tránh việc Phần 7+ vô tình coi đây
là việc chưa làm xong của Phần 6.
