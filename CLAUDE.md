# CLAUDE.md — Tapdoanytedalinhvuc

@AGENTS.md

Bootstrap memory. Chi tiết đầy đủ nằm trong `docs/` — đọc theo
`docs/project/SESSION_PROTOCOL.md` trước khi làm bất cứ việc gì.

## Đang xây gì

AI-native multi-company operating system: Ecosystem (Founder) → Company
(tenant) → Organization/Project → Modules → AI. Không phải ERP, không phải
chatbot, không phải phần mềm một phòng khám. Chi tiết:
`docs/product/PRODUCT_CONSTITUTION.md`, `docs/product/PRODUCT_VISION.md`.

## Repository

- **Target (product of record):** `Tapdoanytedalinhvuc` — đây, mọi code/docs/
  test/migration mới nằm ở đây.
- **Legacy (read-only archaeology source):** `ZenithTasks`
  (`C:\Users\PC\ZenithTasks` nếu clone local, remote:
  https://github.com/ledinhlam23032000/ZenithTasks). KHÔNG refactor, KHÔNG
  push, KHÔNG sửa business behavior ở đây trừ khi Master Prompt cho phép rõ
  ràng. Chỉ đọc/search/chạy test khi an toàn.

## Invariant tuyệt đối

- Company ≠ Project (sai lầm lớn nhất của ZenithTasks — xem
  `docs/architecture/DECISIONS.md` ADR-003).
- Company A không mặc định thấy/ghi Company B.
- Không tạo V2/V3/V4 song song trong app mới.
- Search before create — luôn search cả hai repo trước khi viết model/
  service/component mới.
- Feature chưa end-to-end (UI → policy → domain → data → verify → user thấy
  kết quả) thì CHƯA DONE.
- Không đụng production trong các Phần sớm. Không commit secrets.

## File phải đọc theo thứ tự khi bắt đầu phiên

`docs/project/SESSION_PROTOCOL.md` (thứ tự đầy đủ) →
`PROJECT_STATE.json` → `docs/project/CURRENT_STATE.md` →
`docs/checkpoints/LATEST.md`.

## Source of truth hierarchy

1. Current source code + tests (target repo) = executable current state.
2. `docs/product/PRODUCT_CONSTITUTION.md` = product truth.
3. `docs/architecture/TARGET_ARCHITECTURE.md` + `DECISIONS.md` = kiến trúc
   đã chốt.
4. `docs/project/MASTER_ROADMAP.md` = execution order.
5. `docs/project/CURRENT_STATE.md` + `docs/checkpoints/LATEST.md` = đang làm
   gì / phiên trước vừa làm gì.
6. `docs/legacy/LEGACY_CAPABILITY_MATRIX.md` = parity/salvage truth.
7. Hai file DOCX gốc = historical/strategic reference — không đọc lại toàn
   bộ mỗi phiên, chỉ tra khi cần xác minh chi tiết cụ thể.

## Lệnh quan trọng

Xem `docs/project/CURRENT_STATE.md` cho stack/lệnh build-test-run hiện tại
(bootstrap kỹ thuật của Phần 1).

## Điều cấm

Xem đầy đủ trong `docs/product/PRODUCT_CONSTITUTION.md` mục "Điều cấm" và
`docs/project/SESSION_PROTOCOL.md` mục Autopilot (danh sách HARD BLOCK).

## Resume sau context compaction / phiên mới

Không bắt đầu lại từ đầu. Chạy `docs/project/SESSION_PROTOCOL.md` rồi tiếp
tục đúng mục "NEXT" trong `docs/checkpoints/LATEST.md`. Repository là bộ nhớ
dài hạn, không phải chat transcript.
