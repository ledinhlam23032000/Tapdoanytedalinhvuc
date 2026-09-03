# Master Roadmap — 10 Phần

Roadmap sơ bộ theo Master Prompt (`MASTER PROMPT — TAPDOANYTEDALINHVUC.docx`).
Thứ tự có thể điều chỉnh nếu archaeology cho thấy dependency khác, nhưng
KHÔNG tự thực hiện phần kế tiếp trước khi Phần hiện tại đạt gate. Nguồn chi
tiết đầy đủ của mỗi Phần nằm trong file docx gốc — chỉ đọc lại phần tương ứng
khi bắt đầu Phần đó (token economy).

| Phần | Nội dung | Trạng thái |
|---|---|---|
| 1 | Product Genesis + Repository Archaeology + Project Memory | HOÀN TẤT |
| 2 | Target Domain Architecture + Data Ownership + Tenant Boundaries + Migration Contracts | HOÀN TẤT |
| 3 | Ecosystem + Company + Identity + Membership + Permissions | HOÀN TẤT |
| 4 | Organization + Work Core + Project | HOÀN TẤT |
| 5 | CRM + Sales + Generic Operations | HOÀN TẤT |
| 6 | Finance + Payroll + Commission + Inventory | HOÀN TẤT |
| 7 | Healthcare Vertical + Legacy Clinic Parity | Chưa bắt đầu |
| 8 | AI Runtime + Digital COO + Ecosystem AI + Company AI + Decision Inbox + Safe Execution | Chưa bắt đầu |
| 9 | Founder/Manager/Employee UX + Mission Control + Company Home + Today + Full Integration | Chưa bắt đầu |
| 10 | Migration + Reconciliation + Security Hardening + E2E + Backup/Rollback + Production Readiness | Chưa bắt đầu — có HARD BLOCK bắt buộc trước cutover thật (`CUTOVER_APPROVAL_REQUIRED`) |

## Nguyên tắc roadmap

Roadmap dựa trên **invariant**, không phải feature count. Mỗi Phần phải có:
Invariant → Outcome → Acceptance test. Ví dụ Phần 3: Invariant = "Company
isolation"; Outcome = "Company A không đọc/ghi B"; Acceptance = cross-company
security test.

## Điểm dừng cứng (không tự vượt qua)

- **Cuối Phần 9 → Feature Freeze** trước khi vào Phần 10 (Phần 10 là PROVE
  MODE, không phải feature phase).
- **Production cutover thật** (Phần 10) luôn dừng ở
  `PART_10_PRODUCTION_READY` / `CUTOVER_APPROVAL_REQUIRED`, chờ Founder
  approval tường minh — dù mọi test PASS.
