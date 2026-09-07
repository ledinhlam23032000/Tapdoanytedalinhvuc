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
rg -n "^## " docs/architecture/*.md docs/security/AUTHORIZATION_MODEL.md   # chỗ chèn "Cập nhật Phần N"
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

### 51 ADR — `docs/architecture/DECISIONS.md:<dòng>`

`:5` ADR-001 — Greenfield target repository
`:18` ADR-002 — Modular monolith
`:31` ADR-003 — Company is the tenant, not Project
`:46` ADR-004 — Healthcare/Clinic is a vertical
`:59` ADR-005 — Legacy salvage strategy: Greenfield architecture ×…
`:72` ADR-006 — Stack: giữ Next.js + Prisma + PostgreSQL
`:88` ADR-007 — Ecosystem boundary, không phải "GLOBAL = toàn data…
`:103` ADR-008 — Project nằm trong Company, không nullable, không m…
`:119` ADR-009 — Identity tách khỏi Membership/Role/Permission
`:138` ADR-010 — Organization (Branch/Department/Team) luôn nằm tro…
`:152` ADR-011 — Migration greenfield qua import/cutover, không sửa…
`:172` ADR-012 — Company code unique trong phạm vi Ecosystem, không…
`:189` ADR-013 — Position là template cấp Company, không gắn cứng O…
`:206` ADR-014 — Một Work Core duy nhất (WorkItem), không tách theo…
`:222` ADR-015 — Work visibility: MEMBER/VIEWER thấy việc của mình,…
`:239` ADR-016 — Không implement Milestone ở Phần 4
`:253` ADR-017 — Lead là entity thật, tách khỏi Customer (không dùn…
`:275` ADR-018 — Customer là optional trên Appointment và Sale
`:292` ADR-019 — Không implement Sales Opportunity ở Phần 5
`:309` ADR-020 — Không implement Customer Merge ở Phần 5
`:327` ADR-021 — Sale discount là số tiền cố định trên từng dòng, k…
`:351` ADR-022 — CRM/Appointment/Sales visibility là Company-wide t…
`:376` ADR-023 — Customer.phone mã hoá tại rest, không có cơ chế "r…
`:404` ADR-024 — LedgerEntry: bản ghi tài chính canonical, thuộc Co…
`:439` ADR-025 — Payment (tiền vào từ Sale) và Expense (tiền ra của…
`:473` ADR-026 — Receivable/Công nợ là giá trị derive, không lưu bả…
`:495` ADR-027 — Payroll: một engine đích duy nhất (PayrollProfile …
`:532` ADR-028 — ApprovalRequest: một primitive two-person-approval…
`:574` ADR-029 — Phạm vi bắt buộc two-person approval ở Phần 6: chỉ…
`:603` ADR-030 — Commission: CommissionRule Company-scoped với 3 lo…
`:645` ADR-031 — Inventory: StockMovement là nguồn sự thật duy nhất…
`:689` ADR-032 — Tiền ở Phần 6: tiếp tục Decimal(18,2) VND, amount …
`:717` ADR-033 — Không xây multi-currency/FX engine ở Phần 6; tái d…
`:735` ADR-034 — Idempotency key bắt buộc cho command tiền/kho rủi …
`:755` ADR-035 — Không xây AccountsPayable/Invoice kế toán/Purchase…
`:777` ADR-036 — Healthcare là vertical phụ thuộc MỘT CHIỀU vào Cor…
`:800` ADR-037 — Customer là identity DUY NHẤT của bệnh nhân; KHÔNG…
`:822` ADR-038 — MedicalCase.companyId NOT NULL và là nguồn scoping…
`:844` ADR-039 — Bản ghi lâm sàng đã FINAL là bất biến; sửa CHỈ qua…
`:867` ADR-040 — KHÔNG cascade delete vào lịch sử lâm sàng; dùng Re…
`:886` ADR-041 — File lâm sàng: metadata trong DB, binary ngoài DB,…
`:913` ADR-042 — ConsentRecord là bản ghi riêng có snapshot nội dun…
`:937` ADR-043 — Vật tư thủ thuật đi qua issueStock() của Inventory…
`:961` ADR-044 — Precondition của Procedure theo policy per procedu…
`:978` ADR-045 — Không có task engine thứ hai; follow-up lâm sàng s…
`:998` ADR-046 — Vai trò chuyên môn KHÔNG nằm trên User; quyền đến …
`:1020` ADR-047 — Module enablement qua bảng CompanyModule; CompanyT…
`:1040` ADR-048 — "Chưa ghi nhận" KHÁC "ghi nhận là không"; cấm giá …
`:1060` ADR-049 — Phần 7 KHÔNG migrate dữ liệu lâm sàng thật; chỉ fi…
`:1077` ADR-050 — MedicalCase KHÔNG có cột tổng tiền; commercial sum…
`:1101` ADR-051 — Permission pack gắn theo từng CompanyMembership; v…

### Prisma `prisma/schema.prisma` — 45 model, 50 enum

**Model** User`:29` · Ecosystem`:103` · EcosystemMembership`:130` · Company`:161` · CompanyMembership`:231` · AuditEvent`:252` · OrganizationUnit`:300` · Position`:336` · Assignment`:356` · WorkItem`:393` · Project`:445` · ProjectMembership`:479` · CustomerSource`:510` · Lead`:534` · Customer`:577` · CustomerInteraction`:626` · Appointment`:651` · CatalogItem`:687` · Sale`:714` · SaleLine`:751` · Payment`:820` · Expense`:865` · LedgerEntry`:916` · PayrollProfile`:953` · PayrollRun`:978` · PayrollItem`:1006` · ApprovalRequest`:1044` · CommissionRule`:1086` · CommissionCalculation`:1110` · InventoryLocation`:1140` · InventoryItem`:1159` · StockMovement`:1208` · CompanyModule`:1260` · MedicalCase`:1294` · HealthcareAppointmentContext`:1335` · ClinicalConsultation`:1357` · ClinicalConsultationAddendum`:1384` · ClinicalScreeningItem`:1408` · Procedure`:1435` · ProcedureMaterialUsage`:1479` · ConsentTemplate`:1520` · ConsentRecord`:1546` · ClinicalPhoto`:1592` · MedicalFollowUp`:1633` · CompanyMembershipPack`:1672`

**Enum** UserStatus`:23` · EcosystemStatus`:97` · EcosystemRolePreset`:118` · MembershipStatus`:125` · CompanyType`:148` · CompanyStatus`:154` · CompanyRolePreset`:223` · OrgUnitType`:287` · ArchivableStatus`:295` · AssignmentStatus`:351` · WorkItemStatus`:379` · WorkItemPriority`:386` · ProjectStatus`:436` · ProjectRolePreset`:473` · LeadStatus`:526` · CustomerStatus`:559` · CustomerJourneyStage`:567` · CustomerInteractionType`:615` · AppointmentStatus`:643` · CatalogItemType`:682` · SaleStatus`:708` · PaymentMethod`:807` · PaymentStatus`:815` · ExpenseCategory`:846` · ExpenseSourceType`:855` · ExpenseStatus`:860` · LedgerEntryType`:894` · LedgerSourceType`:903` · LedgerEntryStatus`:911` · PayrollPayType`:949` · PayrollRunStatus`:970` · ApprovalActionType`:1026` · ApprovalRequestStatus`:1031` · CommissionRuleType`:1074` · CommissionRuleStatus`:1080` · InventoryLocationType`:1134` · StockMovementType`:1188` · StockMovementSourceType`:1197` · CompanyModuleType`:1254` · MedicalCaseStatus`:1275` · MedicalCaseType`:1283` · ClinicalRecordStatus`:1350` · ScreeningAnswer`:1403` · ProcedureStatus`:1425` · ProcedureMaterialUsageStatus`:1471` · ConsentType`:1503` · ConsentStatus`:1511` · ClinicalPhotoType`:1579` · MedicalFollowUpStatus`:1622` · PermissionPack`:1665`

### 78 permission key — `src/lib/permissions/registry.ts`

ecosystem.view · ecosystem.manage · ecosystem.membership.manage · ecosystem.company.create · ecosystem.company.lifecycle · company.view · company.manage · company.members.view · company.members.manage · organization.view · organization.manage · people.view · people.assign · work.view · work.create · work.update · work.assign · work.complete · work.manage · project.view · project.create · project.manage · project.archive · customer.view · customer.create · customer.update · customer.archive · customer.assign · customer.interaction.create · lead.view · lead.create · lead.assign · lead.convert · appointment.view · appointment.create · appointment.update · appointment.manage · sales.view · sales.create · sales.update · sales.confirm · sales.cancel · catalog.view · catalog.manage · finance.view · finance.payment.create · finance.payment.void · finance.expense.create · finance.expense.void · finance.correction.create · payroll.view · payroll.manage · commission.view · commission.manage · inventory.view · inventory.receive · inventory.issue · inventory.transfer · inventory.adjust · inventory.manage · healthcare.module.manage · healthcare.case.view · healthcare.case.create · healthcare.case.update · healthcare.case.close · healthcare.consultation.view · healthcare.consultation.create · healthcare.consultation.finalize · healthcare.procedure.view · healthcare.procedure.plan · healthcare.procedure.perform · healthcare.consent.view · healthcare.consent.manage · healthcare.photo.view · healthcare.photo.manage · healthcare.followup.view · healthcare.followup.manage · healthcare.template.manage

<!-- AUTO:END -->
