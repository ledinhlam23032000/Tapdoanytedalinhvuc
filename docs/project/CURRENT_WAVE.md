# Current Wave

**Phần 1 — Product Genesis + Repository Archaeology + Project Memory: HOÀN
TẤT** (15 bước theo Master Prompt mục LXXVI đã thực hiện đủ, xem
`docs/checkpoints/LATEST.md`).

**Tiếp theo: Phần 2 — Target Domain Architecture + Data Ownership + Tenant
Boundaries + Migration Contracts.**

Trước khi bắt đầu Phần 2, đọc đúng đoạn tương ứng trong
`MASTER PROMPT — TAPDOANYTEDALINHVUC.docx` (bắt đầu từ dòng ~3615, tiêu đề
"MASTER PROMPT --- PHẦN 2/10", kết thúc trước "PART 3" ở dòng ~7794) — KHÔNG
cần đọc lại Phần 1 (đã chưng cất đủ vào `docs/`). File gốc đã convert sẵn ra
`AppData\Local\Temp\claude\...\scratchpad\master_prompt.md` trong phiên tạo
checkpoint này; nếu phiên sau không còn file đó, convert lại bằng
`pandoc -t markdown "MASTER PROMPT — TAPDOANYTEDALINHVUC.docx" -o master_prompt.md`
rồi đọc đúng dải dòng trên (dùng `grep -n` để định vị lại nếu số dòng lệch
do version doc khác).

Phần 2 đã có sẵn rất nhiều input chất lượng cao để không phải thiết kế từ
đầu — xem trước khi thiết kế:

- `docs/legacy/LEGACY_CAPABILITY_MATRIX.md` — đặc biệt mục "⚠️ Mâu thuẫn tài
  liệu quan trọng" (cần xác minh lại trạng thái migrate production thật của
  ZenithTasks) và L-V01 (lỗ hổng ADMIN-bypass cụ thể cần tránh).
- `docs/legacy/SALVAGE_LEDGER.md` — pattern đáng giữ + bài học không lặp lại
  + migration wave đề xuất tham khảo.
- Audit doc gốc (`tổng nhận xét dự án của chúng ta.docx`) Phiên 2/4 đã có một
  bản thiết kế domain model khá chi tiết (Ecosystem/Company/OrgUnit/Position/
  Project, bridge migration 8 giai đoạn) — dùng làm tham khảo, nhưng
  MASTER PROMPT Phần 2 mới là nguồn quyết định cuối.
