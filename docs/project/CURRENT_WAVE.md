# Current Wave

**Phần 7 — Healthcare Vertical: HOÀN TẤT.** Implementation thật: Prisma
schema 12 model mới (`MedicalCase`/`ClinicalConsultation`+Addendum+Screening/
`Procedure`+MaterialUsage/`ConsentTemplate`+`ConsentRecord`/`ClinicalPhoto`/
`MedicalFollowUp`/`CompanyMembershipPack`, 4 migration — 1 tạo muộn sau khi
phát hiện schema drift), 8 domain service (7 entity + `procedure-readiness.ts`
thuần), Server Action (27), UI (5 route + tab Customer + upload ảnh thật),
159 integration test PASS, adversarial code review **4 agent** (3 P0 race
condition thật tìm thấy và đã vá + 1 P1 rò PHI), browser journey thật xác
nhận PHI redaction, fresh-DB test (10 migration) — xem
`docs/checkpoints/LATEST.md`.

**Bài học quy trình quan trọng nhất của Phần 7** (khác Phần 3-6): review
chạy CHỈ SAU KHI phần lớn code đã viết, không phải theo từng bước. Kết quả
là 3 P0 race condition + 1 schema drift (migration thiếu dù `migrate status`
báo "up to date") lẽ ra có thể bắt sớm và rẻ hơn nếu review incremental theo
đúng chu trình Phần 3-6. **Phần 8 PHẢI quay lại review incremental** — xem
`PROJECT_STATE.json` mục `next`.

**Tiếp theo: Phần 8 — AI Runtime + Digital COO + Ecosystem AI + Company AI +
Decision Inbox + Safe Execution.**

Trước khi bắt đầu Phần 8, đọc đúng đoạn tương ứng trong
`MASTER PROMPT — TAPDOANYTEDALINHVUC.docx` (dùng
`pandoc -t markdown "MASTER PROMPT — TAPDOANYTEDALINHVUC.docx" -o master_prompt.md`
rồi `grep -n "PART 8\|PHẦN 9"` để định vị range — không đọc lại toàn bộ file
docx, chỉ đoạn Phần 8).

## Input đã sẵn sàng cho Phần 8

- `WorkItem` (Phần 4) là điểm neo tự nhiên cho bất kỳ hành động AI nào cần
  tạo việc/nhắc việc — KHÔNG tạo task engine thứ hai cho AI (cùng tinh thần
  ADR-014/ADR-045 đã áp dụng nhất quán từ Phần 4).
- `ApprovalRequest` (Phần 6, ADR-028) — nếu Safe Execution cần một hành động
  AI đề xuất phải có người duyệt trước khi thực thi, DÙNG LẠI primitive này,
  không tạo model duyệt thứ 2 (đã dùng đúng ở Payroll/Inventory Phần 6; Phần
  7 xác nhận KHÔNG cần dùng vì không có tình huống phù hợp — Phần 8 rất có
  thể sẽ cần, vì đây chính là domain "AI hành động thay người").
- `AuditEvent` (Phần 3) — mọi hành động AI viết dữ liệu phải audit trong
  CÙNG transaction với thay đổi đó, đúng pattern đã dùng xuyên suốt Phần 3-7.
- **Bài học PHI/logging quan trọng nhất từ Phần 7** — không log nội dung
  nhạy cảm (chẩn đoán, PII, nội dung tài chính) vào bất kỳ đâu AI có thể đọc
  lại mà không qua permission check. Nếu Digital COO/AI đọc dữ liệu
  Healthcare/Finance, PHẢI tôn trọng đúng permission gate hiện có — KHÔNG
  tạo đường tắt "AI có toàn quyền đọc" (bất biến CXXX/CXXXI: cấm AI/Founder
  tự động = READ ALL PHI).
- **Bài học concurrency quan trọng nhất từ Phần 6+7** — mọi hàm domain có
  pattern "đọc trạng thái/số lượng → ghi" PHẢI khoá dòng bằng
  `SELECT...FOR UPDATE` trong `db.$transaction`, và PHẢI áp dụng cho MỌI
  hàm ghi trên 1 entity, không chỉ hàm "chính". Nếu Phần 8 có hàng đợi lệnh
  AI (Decision Inbox) mà nhiều actor/nhiều AI job có thể cùng xử lý 1 mục,
  áp dụng khoá ngay từ đầu.
- **Bài học schema/DB drift từ Phần 7** — sau MỌI thay đổi `schema.prisma`,
  chạy `npx prisma migrate dev` VÀ `npm run test:integration` ngay, đừng chỉ
  tin `npx tsc --noEmit`/`migrate status`.
- **Bài học review incremental** — chạy adversarial review sau mỗi bước lớn
  của Phần 8 (đặc biệt trước khi implement "Safe Execution" — đây là domain
  rủi ro cao nhất từ trước tới giờ vì AI được phép GHI dữ liệu thay người),
  không dồn lại cuối Phần.

## Việc CHƯA làm ở Phần 7 (đúng phạm vi, không phải thiếu sót)

AI Runtime/Digital COO/proactive suggestions, dashboard/reporting engine
tổng hợp toàn Ecosystem, Zalo/SMS, payment integration thật, email
invitation service, role builder UI, break-glass access, user
impersonation — mọi mục deferred Phần 3-6 vẫn giữ nguyên phạm vi chưa làm.
