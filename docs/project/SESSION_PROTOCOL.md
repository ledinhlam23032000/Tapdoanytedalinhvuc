# Session Startup Protocol

Mọi phiên Claude mới (kể cả sau context compaction) bắt đầu bằng đúng thứ tự
này — không đọc lại toàn bộ hai file DOCX gốc trừ khi cần xác minh một quyết
định cụ thể.

1. `git status`, `git log --oneline -10` (cả target và, nếu cần đối chiếu,
   legacy repo).
2. Đọc `CLAUDE.md` (repo root).
3. Đọc `PROJECT_STATE.json`.
4. Đọc `docs/project/CURRENT_STATE.md` và `docs/project/CURRENT_WAVE.md`
   (nếu có).
5. Đọc `docs/checkpoints/LATEST.md`.
6. Nếu task ảnh hưởng kiến trúc: đọc `docs/product/PRODUCT_CONSTITUTION.md`
   và `docs/architecture/TARGET_ARCHITECTURE.md`.
7. Kiểm tra source thực tế (không tin tài liệu mù quáng nếu nghi ngờ đã lỗi
   thời — source code + tests thắng về CURRENT STATE).
8. Xác định task hiện hành theo `docs/project/MASTER_ROADMAP.md` → mục
   "NEXT" trong checkpoint mới nhất.
9. Search-before-create trước khi viết bất kỳ model/service/component mới
   nào (search cả target repo lẫn ZenithTasks).
10. Chỉ quay lại hai file DOCX gốc
    (`MASTER PROMPT — TAPDOANYTEDALINHVUC.docx`,
    `tổng nhận xét dự án của chúng ta.docx`) khi cần xác minh chi tiết một
    quyết định cụ thể chưa được chưng cất đủ vào docs/ ở đây.

## Checkpoint tối thiểu (cuối mỗi wave/phiên dài)

```
DATE/TIME
TARGET HEAD
LEGACY HEAD OBSERVED
PHASE / WAVE
COMPLETED
FILES CHANGED
DECISIONS
TESTS RUN — RESULTS
OPEN RISKS
BLOCKERS
NEXT
DO NOT REDO
```

## Autopilot

Chủ dự án đã pre-authorize long-run autopilot execution cho toàn bộ 10 Phần
trong môi trường local/test (xem LAUNCH PROMPT gốc). Không hỏi lại xác nhận
từng bước nhỏ. Chỉ dừng (HARD BLOCK) khi: thiếu credential cần thiết, cần
hành động irreversible trên production, cần chi phí dịch vụ đáng kể, ambiguity
lớn về dữ liệu tài chính/y tế có thể gây mất dữ liệu, quyết định business/pháp
lý không thể suy luận an toàn, hoặc production cutover cần Founder approval.
Test/lint/build/browser test thất bại KHÔNG phải hard block — tự sửa và tiếp
tục.
