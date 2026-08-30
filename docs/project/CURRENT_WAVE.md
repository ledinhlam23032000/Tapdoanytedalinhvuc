# Current Wave

**Phần 4 — Organization + Work Core + Project Foundation: HOÀN TẤT.**
Implementation thật: Prisma schema (`OrganizationUnit`/`Position`/
`Assignment`/`WorkItem`/`Project`/`ProjectMembership`), 3 domain service
+ Server Action wrapper, UI (`Hôm nay`/`Công việc`/`Cơ cấu tổ chức`/`Dự án`),
53 integration test PASS, adversarial code review PASS (1 P1 tìm thấy và đã
vá, 3 P2 đã sửa), 3 browser journey thật (Employee/Manager/Project Owner) —
xem `docs/checkpoints/LATEST.md`.

**Tiếp theo: Phần 5 — CRM + Sales + Generic Operations.**

Trước khi bắt đầu Phần 5, đọc đúng đoạn tương ứng trong
`MASTER PROMPT — TAPDOANYTEDALINHVUC.docx` (dùng
`pandoc -t markdown "MASTER PROMPT — TAPDOANYTEDALINHVUC.docx" -o master_prompt.md`
rồi `grep -n "PART 5\|PHẦN 6"` để định vị range — không đọc lại toàn bộ file
docx, chỉ đoạn Phần 5).

## Input đã sẵn sàng cho Phần 5

- `docs/architecture/DATA_OWNERSHIP.md` dòng CRM/Sales — Customer/Appointment/
  Sale đã có ownership scope (`companyId*`, `orgUnitId?`, `projectId?`) chốt
  từ Phần 2, Phần 5 build thật trên nền đó.
- `src/lib/domain/scope-guards.ts` — assert cross-company FK dùng chung, Phần
  5 nên tiếp tục pattern này cho `Customer`/`Appointment`/`Sale` thay vì viết
  lại logic riêng.
- `src/lib/domain/work-service.ts` — nếu Sale/Appointment cần sinh WorkItem
  tự động (nhắc gọi lại khách, follow-up), dùng lại `createWorkItem()` có
  sẵn, KHÔNG tạo engine việc thứ 2 (ADR-014 vẫn áp dụng).
- `docs/architecture/LEGACY_TO_TARGET_MAP.md` dòng `Customer`/
  `ZWorkspaceCustomer`/`Appointment`/`ZWorkspaceAppointment`/`ZWorkspaceSale`
  — đã có Decision (KEEP_CONCEPT/MIGRATE_DATA/REMAP), Phần 5 chỉ cần build
  physical model + service theo đúng Decision đã chốt, không quyết định lại.
- `src/lib/permissions/registry.ts` — `RESERVED_PERMISSION_PREFIXES` đã có
  `"customer."` — bỏ khỏi danh sách reserved khi Phần 5 thêm permission thật
  tương ứng (mục CCXXVI: chỉ implement check khi domain đã có).

## Việc CHƯA làm ở Phần 4 (đúng phạm vi, không phải thiếu sót)

Customer/Appointment/Sale/Finance/Payroll/Inventory/Healthcare — mới có ở
`DATA_OWNERSHIP.md`/`DOMAIN_MODEL.md` conceptual, CHƯA có trong
`prisma/schema.prisma`. Milestone/Checklist model riêng cho Project — cố
tình không tạo (ADR-016, Work Core là đủ, thêm khi có bằng chứng cần).
OrganizationUnit move/reparent (đổi `parentId` sau khi tạo) — chỉ có
tạo/archive, chưa có sửa cây; chưa có bằng chứng thật cần ngay, thêm ở Phần
5+ nếu Company Hồng Phúc thật sự cần tái cấu trúc phòng ban.
