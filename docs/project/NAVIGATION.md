# NAVIGATION — đọc file này TRƯỚC khi grep/read bất cứ gì

Mục đích: **cắt token lãng phí vào việc tìm lại thứ đã biết**. Qua Phần 3-6,
khoản đốt token lớn nhất không phải viết code — mà là mỗi phiên lại `grep`
rồi `Read` cả file để tìm lại cùng một hàm/ADR/section.

Phần dưới marker `AUTO` **tự sinh** bằng `npm run nav` — chạy lại cuối mỗi
Phần, không bao giờ stale. Đừng sửa tay phần đó.

## Cần gì → đi đâu (bảng quyết định)

| Cần | Đi thẳng tới | Đừng làm |
|---|---|---|
| Đang làm tới đâu, tiếp theo gì | `PROJECT_STATE.json` (`phase`/`next`/`doNotRedo`) → `docs/checkpoints/LATEST.md` mục NEXT | Đọc lại chat cũ, đọc lại toàn bộ docs |
| Lệnh build/test/run, stack | `docs/project/CURRENT_STATE.md` mục "Lệnh quan trọng" | Đoán từ `package.json` |
| Một quyết định kiến trúc đã chốt chưa? | Bảng ADR bên dưới → nhảy đúng dòng trong `DECISIONS.md` | Đọc cả `DECISIONS.md` (775 dòng) |
| Hàm domain nào có sẵn, ở đâu | Bảng "Domain service & Server Action" bên dưới | `grep` khắp `src/lib/domain/` |
| Model/enum Prisma + dòng | Bảng "Prisma" bên dưới | Đọc cả `schema.prisma` (1178 dòng) |
| Permission key đã tồn tại chưa | Danh sách "Permission" bên dưới | Đọc `registry.ts` |
| Quy tắc bất biến của 1 domain | `docs/domain/<TÊN>.md` — mỗi domain đúng 1 file | Đọc lại code service để suy ra quy tắc |
| Đoạn Master Prompt của Phần N | `docs/legacy/partN_master_prompt_section.md` (gitignored, có sẵn trên máy) | `pandoc` lại cả DOCX 912KB |
| Lỗi môi trường lặp lại (cwd reset, cache 404, confirm bị cancel) | Memory `project-tapdoan-dev-gotchas` | Debug lại từ đầu |

## Kỷ luật token khi thao tác (áp dụng mặc định, không cần nhắc)

**Bash** — luôn giới hạn output. Output rác đốt token thật: một lần
`git add -A` từng in 74 dòng warning CRLF vô ích.
- `git add -A 2>/dev/null` · `git commit -q` · `git push -q` · `git status --short`
- Mọi lệnh dài: `... 2>&1 | tail -20` (không bao giờ để trôi cả nghìn dòng)
- `npm run test 2>&1 | tail -12` — chỉ cần dòng tổng kết

**Browser test** — thứ đốt token nhiều nhất.
- `get_page_text` rẻ hơn `screenshot` khoảng **4 lần** → mặc định dùng nó để
  xác nhận trạng thái. Chỉ `screenshot` khi (a) cần toạ độ để click, hoặc
  (b) cần bằng chứng thị giác về layout.
- `preview_logs` LUÔN đặt `lines: 3-5` — xác nhận action chạy chỉ cần thấy
  đúng dòng `ƒ someAction(...)`.
- Xác nhận một submit thành công bằng `preview_logs` (rẻ), không bằng
  screenshot.

**Grep/Read**
- `Grep` với `head_limit`, và `output_mode: "files_with_matches"` khi chỉ
  cần biết file nào.
- Sau khi grep ra số dòng → `Read` với `offset`/`limit`, không đọc cả file.
- File > 400 dòng: không bao giờ Read trọn vẹn nếu chỉ cần 1 hàm.

## Công thức `rg` sẵn dùng (thay cho việc đọc file)

Index bên dưới **cố ý KHÔNG chứa danh sách export** — `rg` làm việc đó rẻ
hơn và không bao giờ stale. Dùng thẳng:

```bash
rg -n "^export (async )?function <tên>" src/          # hàm ở đâu
rg -n "^export" src/lib/domain/<file>.ts              # file này có gì
rg -n "<tên hàm>" src/lib/actions src/app --type ts   # ai đang gọi
rg -l "<model>" src/lib/domain                        # domain nào chạm model
rg -n "^  (it|describe)\(" src/lib/__tests__/<f>.itest.ts  # test phủ gì
```

Ngân sách: `NAVIGATION.md` phải ≤ 4000 token — `npm run nav` **tự fail nếu
vượt**. Nếu fail, cắt bớt index chứ đừng nới ngân sách: một index đắt hơn
thứ nó thay thế là index vô dụng (bản đầu từng nặng 12k token vì nhét cả
danh sách export).

**Subagent/Workflow**
- Mỗi agent khởi động lạnh và phải tự tìm lại context → **luôn nhét đường
  dẫn cụ thể + số dòng vào prompt**, đừng bảo nó "tìm trong repo".
- Trỏ nó tới `NAVIGATION.md` và `docs/domain/*.md` thay vì để nó tự khám phá.

## Bố cục repo (ổn định từ Phần 3, không đổi)

```
PROJECT_STATE.json              trạng thái máy đọc được — nguồn sự thật về tiến độ
docs/project/                   SESSION_PROTOCOL · CURRENT_STATE · CURRENT_WAVE · NAVIGATION(đây) · MASTER_ROADMAP
docs/checkpoints/LATEST.md      checkpoint MỚI NHẤT (cũ nằm trong git log)
docs/architecture/              DECISIONS(ADR) · TARGET_ARCHITECTURE · DOMAIN_MODEL · DATA_OWNERSHIP · TENANT_INVARIANTS · SECURITY_BOUNDARIES · LEGACY_TO_TARGET_MAP
docs/domain/                    1 file/domain — quy tắc bất biến, đọc TRƯỚC khi sửa domain đó
docs/security/                  AUTHORIZATION_MODEL · RED_TEAM_CODE_REVIEW_PART*
docs/legacy/                    LEGACY_CAPABILITY_MATRIX · SALVAGE_LEDGER · part*_master_prompt_section(gitignored)
src/lib/domain/                 domain service + module tính thuần (*-calc.ts, có unit test riêng)
src/lib/actions/                Server Action — thin wrapper, chỉ trả {id} hoặc void
src/lib/permissions/            registry · presets · resolver
src/lib/__tests__/              tenant-isolation-part*.itest.ts (cần Postgres thật)
src/app/c/[code]/               UI theo Company
scripts/                        bootstrap-founder · gen-nav-index · _scratch-* (tạm, xoá ngay sau dùng)
```

<!-- AUTO:START -->
<!-- SINH TU DONG boi scripts/gen-nav-index.ts — dung sua tay, chay `npm run nav` -->

### 50 ADR — `docs/architecture/DECISIONS.md:<dòng>`

`:5` ADR-001 — Greenfield target repository
`:18` ADR-002 — Modular monolith
`:31` ADR-003 — Company is the tenant, not Project
`:46` ADR-004 — Healthcare/Clinic is a vertical
`:59` ADR-005 — Legacy salvage strategy: Greenfield architecture × Brownfield salvage
`:72` ADR-006 — Stack: giữ Next.js + Prisma + PostgreSQL
`:88` ADR-007 — Ecosystem boundary, không phải "GLOBAL = toàn database"
`:103` ADR-008 — Project nằm trong Company, không nullable, không mini-ERP
`:119` ADR-009 — Identity tách khỏi Membership/Role/Permission
`:138` ADR-010 — Organization (Branch/Department/Team) luôn nằm trong Company
`:152` ADR-011 — Migration greenfield qua import/cutover, không sửa trực tiếp DB production của ZenithTasks
`:172` ADR-012 — Company code unique trong phạm vi Ecosystem, không global
`:189` ADR-013 — Position là template cấp Company, không gắn cứng OrganizationUnit
`:206` ADR-014 — Một Work Core duy nhất (WorkItem), không tách theo nguồn gốc
`:222` ADR-015 — Work visibility: MEMBER/VIEWER thấy việc của mình, MANAGER trở lên thấy toàn Company
`:239` ADR-016 — Không implement Milestone ở Phần 4
`:253` ADR-017 — Lead là entity thật, tách khỏi Customer (không dùng Customer+lifecycle)
`:275` ADR-018 — Customer là optional trên Appointment và Sale
`:292` ADR-019 — Không implement Sales Opportunity ở Phần 5
`:309` ADR-020 — Không implement Customer Merge ở Phần 5
`:327` ADR-021 — Sale discount là số tiền cố định trên từng dòng, không port Mechanism engine
`:351` ADR-022 — CRM/Appointment/Sales visibility là Company-wide theo permission, KHÔNG theo ownerUserId
`:376` ADR-023 — Customer.phone mã hoá tại rest, không có cơ chế "reveal có audit" riêng ở Phần 5
`:404` ADR-024 — LedgerEntry: bản ghi tài chính canonical, thuộc Company, bất biến (Void + correction entry, không sửa/xoá)
`:439` ADR-025 — Payment (tiền vào từ Sale) và Expense (tiền ra của Company) là 2 entity tách biệt; Sale ≠ Payment ≠ Ledger
`:473` ADR-026 — Receivable/Công nợ là giá trị derive, không lưu bảng riêng ở Phần 6
`:495` ADR-027 — Payroll: một engine đích duy nhất (PayrollProfile + PayrollRun + PayrollItem), gộp toàn bộ 3 hệ legacy, snapshot bất biến sau Finalize
`:532` ADR-028 — ApprovalRequest: một primitive two-person-approval dùng chung, mô phỏng theo `AssistantApproval` (đã production-tested), không theo `ZWorkspacePayrollRun`
`:574` ADR-029 — Phạm vi bắt buộc two-person approval ở Phần 6: chỉ `PayrollRun.finalize` và Inventory `ADJUSTMENT`; các hành động rủi ro khác dùng single-approver + reason + audit
`:603` ADR-030 — Commission: `CommissionRule` Company-scoped với 3 loại đóng, không port rule engine tổng quát; allocation tường minh để tránh double-count
`:645` ADR-031 — Inventory: `StockMovement` là nguồn sự thật duy nhất, `StockBalance` luôn derive; không xây cost/valuation ở Phần 6
`:689` ADR-032 — Tiền ở Phần 6: tiếp tục `Decimal(18,2)` VND, amount không âm + chiều qua entity/type, làm tròn nguyên VND; Server Action không bao giờ trả thẳng object chứa `Decimal`
`:717` ADR-033 — Không xây multi-currency/FX engine ở Phần 6; tái dùng `Company.currency` có sẵn từ Phần 3
`:735` ADR-034 — Idempotency key bắt buộc cho command tiền/kho rủi ro cao
`:755` ADR-035 — Không xây AccountsPayable/Invoice kế toán/PurchaseOrder/Supplier/BankReconciliation/Tax/ShareholderDistribution/CostCenter/Company-level-Budgeting ở Phần 6
`:777` ADR-036 — Healthcare là vertical phụ thuộc MỘT CHIỀU vào Core, đặt tại `src/lib/domain/healthcare/`
`:800` ADR-037 — `Customer` là identity DUY NHẤT của bệnh nhân; KHÔNG tạo `HealthcareProfile` ở Phần 7
`:822` ADR-038 — `MedicalCase.companyId` NOT NULL và là nguồn scoping trực tiếp; CẤM suy Company qua `Customer`
`:844` ADR-039 — Bản ghi lâm sàng đã FINAL là bất biến; sửa CHỈ qua addendum
`:867` ADR-040 — KHÔNG cascade delete vào lịch sử lâm sàng; dùng Restrict + archive
`:886` ADR-041 — File lâm sàng: metadata trong DB, binary ngoài DB, truy cập qua server proxy có permission check (KHÔNG signed URL ở Phần 7)
`:913` ADR-042 — `ConsentRecord` là bản ghi riêng có snapshot nội dung + version, có REVOKED; KHÔNG phải boolean
`:937` ADR-043 — Vật tư thủ thuật đi qua `issueStock()` của Inventory; idempotent theo `(sourceType, sourceId)`
`:961` ADR-044 — Precondition của Procedure theo policy per `procedureType`; readiness thuần deterministic
`:978` ADR-045 — Không có task engine thứ hai; follow-up lâm sàng sinh `WorkItem` của Work Core
`:998` ADR-046 — Vai trò chuyên môn KHÔNG nằm trên `User`; quyền đến từ permission pack trên `CompanyMembership`
`:1020` ADR-047 — Module enablement qua bảng `CompanyModule`; `CompanyType` chỉ gợi ý, KHÔNG đổi schema
`:1040` ADR-048 — "Chưa ghi nhận" KHÁC "ghi nhận là không"; cấm giá trị âm tính mặc định
`:1060` ADR-049 — Phần 7 KHÔNG migrate dữ liệu lâm sàng thật; chỉ fixture synthetic
`:1077` ADR-050 — `MedicalCase` KHÔNG có cột tổng tiền; commercial summary luôn derived từ Sale/Finance

### Prisma `prisma/schema.prisma` — 32 model, 38 enum

**Model** User`:29` · Ecosystem`:84` · EcosystemMembership`:111` · Company`:142` · CompanyMembership`:199` · AuditEvent`:218` · OrganizationUnit`:266` · Position`:299` · Assignment`:319` · WorkItem`:356` · Project`:406` · ProjectMembership`:440` · CustomerSource`:471` · Lead`:495` · Customer`:538` · CustomerInteraction`:584` · Appointment`:609` · CatalogItem`:643` · Sale`:668` · SaleLine`:705` · Payment`:772` · Expense`:817` · LedgerEntry`:868` · PayrollProfile`:905` · PayrollRun`:930` · PayrollItem`:958` · ApprovalRequest`:996` · CommissionRule`:1038` · CommissionCalculation`:1062` · InventoryLocation`:1092` · InventoryItem`:1109` · StockMovement`:1155`

**Enum** UserStatus`:23` · EcosystemStatus`:78` · EcosystemRolePreset`:99` · MembershipStatus`:106` · CompanyType`:129` · CompanyStatus`:135` · CompanyRolePreset`:191` · OrgUnitType`:253` · ArchivableStatus`:261` · AssignmentStatus`:314` · WorkItemStatus`:342` · WorkItemPriority`:349` · ProjectStatus`:397` · ProjectRolePreset`:434` · LeadStatus`:487` · CustomerStatus`:520` · CustomerJourneyStage`:528` · CustomerInteractionType`:573` · AppointmentStatus`:601` · CatalogItemType`:638` · SaleStatus`:662` · PaymentMethod`:759` · PaymentStatus`:767` · ExpenseCategory`:798` · ExpenseSourceType`:807` · ExpenseStatus`:812` · LedgerEntryType`:846` · LedgerSourceType`:855` · LedgerEntryStatus`:863` · PayrollPayType`:901` · PayrollRunStatus`:922` · ApprovalActionType`:978` · ApprovalRequestStatus`:983` · CommissionRuleType`:1026` · CommissionRuleStatus`:1032` · InventoryLocationType`:1086` · StockMovementType`:1136` · StockMovementSourceType`:1145`

### 60 permission key — `src/lib/permissions/registry.ts`

ecosystem.view · ecosystem.manage · ecosystem.membership.manage · ecosystem.company.create · ecosystem.company.lifecycle · company.view · company.manage · company.members.view · company.members.manage · organization.view · organization.manage · people.view · people.assign · work.view · work.create · work.update · work.assign · work.complete · work.manage · project.view · project.create · project.manage · project.archive · customer.view · customer.create · customer.update · customer.archive · customer.assign · customer.interaction.create · lead.view · lead.create · lead.assign · lead.convert · appointment.view · appointment.create · appointment.update · appointment.manage · sales.view · sales.create · sales.update · sales.confirm · sales.cancel · catalog.view · catalog.manage · finance.view · finance.payment.create · finance.payment.void · finance.expense.create · finance.expense.void · finance.correction.create · payroll.view · payroll.manage · commission.view · commission.manage · inventory.view · inventory.receive · inventory.issue · inventory.transfer · inventory.adjust · inventory.manage

### Doc phải cập nhật mỗi Phần — section + dòng để chèn đúng chỗ

**`docs/architecture/TARGET_ARCHITECTURE.md`** Cập nhật Phần 6 (Finance + Payroll + Commission + Inventory — IMPLEMENTED)`:3` · Cập nhật Phần 5 (CRM + Sales + Appointment + Customer Operations — IMPLEMENTED)`:21` · Cập nhật Phần 4 (Organization + Work Core + Project — IMPLEMENTED)`:32` · Cập nhật Phần 2 (Target Domain Architecture — HOÀN TẤT)`:44` · Nội dung gốc (Phiên 1 — hướng đi, chưa phải schema chi tiết)`:64` · Product boundary`:70` · Ecosystem boundary`:77` · Company boundary`:84` · Org Unit meaning`:91` · Project meaning`:96` · Core domains`:103` · Business modules (bật theo nhu cầu Company)`:109` · Vertical domains`:114` · AI position`:121` · Approval position`:127` · Audit position`:135` · Legacy Clinic đi đâu`:143` · Parity sẽ đạt được như thế nào`:151` · Legacy data sẽ migrate như thế nào (hướng, chưa thực thi)`:159` · Stack`:168`
**`docs/architecture/DOMAIN_MODEL.md`** Cập nhật Phần 6 — Finance/Payroll/Commission/Inventory đã implement thật`:3` · Cập nhật Phần 5 — CRM/Lead/Appointment/Sales đã implement thật`:17` · Cập nhật Phần 4 — Organization/Project/Work Core đã implement thật`:29` · Sơ đồ tổng quan`:48` · Platform (không phải domain nghiệp vụ)`:80` · Identity`:94` · Ecosystem`:110` · Company — first-class tenant`:158` · Organization — nơi con người thuộc về`:208` · Project — nơi công việc có vòng đời diễn ra`:262` · Work Core — một engine duy nhất`:298` · Generic Business Domains (thuộc Company)`:325` · Healthcare Vertical (extension, không phải core)`:369` · AI Domain (architecture only — runtime đầy đủ ở Phần 8)`:380` · Approval / Audit — cross-cutting, không unify vật lý sớm`:410` · Trả lời các câu hỏi bắt buộc (Master Prompt mục CI)`:421` · 10 Acceptance Scenario (Master Prompt CXXXV–CXLIV) — đã review qua model trên`:439`
**`docs/architecture/DATA_OWNERSHIP.md`** Cập nhật Phần 4`:33` · Cập nhật Phần 5`:40` · Cập nhật Phần 6`:49` · Ghi chú UNKNOWN (không có ở core entity quan trọng — quality gate CXXX)`:72`
**`docs/architecture/TENANT_INVARIANTS.md`** Nguyên tắc nền`:7` · Threat model tối thiểu (mục CIV)`:38` · Acceptance test bắt buộc (ánh xạ 1-1 vào test thật ở Phần 3)`:54` · Cập nhật Phần 4 — mở rộng acceptance test sang Organization/Work/Project`:94` · Cập nhật Phần 5 — mở rộng sang Customer/Lead/Appointment/Sales`:110` · Cập nhật Phần 6 — mở rộng sang Finance/Payroll/Commission/Inventory`:125` · Không lặp lại (đối chiếu trực tiếp bằng chứng từ Legacy Capability Matrix)`:144`
**`docs/architecture/SECURITY_BOUNDARIES.md`** Ranh giới bắt buộc chứng minh được (quality gate — Master Prompt mục CXXXI)`:7` · Identity vs Permission (Platform boundary)`:20` · AI Safety Boundary`:51` · Audit Boundary`:80` · Secrets Boundary`:93` · Platform Operator`:103` · Cập nhật Phần 5 — CRM/Sales/Appointment permission thật`:112` · Cập nhật Phần 6 — Finance/Payroll/Commission/Inventory permission thật`:126` · Red-team review`:148`
**`docs/architecture/LEGACY_TO_TARGET_MAP.md`** Cập nhật Phần 4 — trạng thái implement thật của các dòng Organization/Work`:40` · Cập nhật Phần 5 — Legacy Capability Matrix rows (mục CCLXIX)`:54` · Cập nhật Phần 6 — Legacy Capability Matrix rows`:71` · Legacy Role Map (bổ sung Phần 3 — mục CIII-CVII)`:83` · UNKNOWN cần migration tooling thật xử lý (Phần 10, không đoán ở đây)`:107`
**`docs/legacy/SALVAGE_LEDGER.md`** Security comparison — kết quả implement Phần 3 (mục CCXXXVIII)`:6` · Cập nhật Phần 4`:22` · Cập nhật Phần 5`:41` · Cập nhật Phần 6`:53` · Tuyệt đối KHÔNG copy (secrets — chỉ ghi path, không mở/không quote nội dung)`:66` · Pattern kỹ thuật đáng salvage nguyên (code pattern, không phải file copy)`:88` · Bài học KHÔNG được lặp lại (đã trả giá ở ZenithTasks)`:104` · Migration wave đề xuất (tham khảo từ audit Phiên 2 & 4 — Phần 2 sẽ quyết định chính thức)`:130`
**`docs/security/AUTHORIZATION_MODEL.md`** Identity`:9` · Session`:19` · Ecosystem Membership → Company Membership`:27` · Role preset → Permission (static mapping)`:41` · "Inheritance" Ecosystem → Company — quyết định quan trọng nhất Phần 3`:62` · Quyết định bổ sung khi implement (chưa có trong Phần 2, chốt ở đây)`:97` · Audit`:116` · Điều đã cố tình KHÔNG làm ở Phần 3 (đúng phạm vi)`:124` · Cập nhật Phần 5 — CRM/Sales/Appointment dùng nguyên cơ chế Phần 3`:131` · Cập nhật Phần 6 — Finance/Payroll/Commission/Inventory dùng nguyên cơ chế Phần 3`:147`

<!-- AUTO:END -->
