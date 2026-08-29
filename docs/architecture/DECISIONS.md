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
