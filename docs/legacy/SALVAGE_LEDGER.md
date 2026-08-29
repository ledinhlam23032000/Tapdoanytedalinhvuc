# Salvage Ledger

Đi kèm `LEGACY_CAPABILITY_MATRIX.md`. File này trả lời: **cái gì được phép
mang sang, cách nào, và tuyệt đối không được mang gì.**

## Tuyệt đối KHÔNG copy (secrets — chỉ ghi path, không mở/không quote nội dung)

Xác nhận có tồn tại trong `ZenithTasks` (path only, chưa từng mở):

- `.env`, `.env.backup-v2-20260824-141952`
- `PHONE_ENC_KEY-20260629-122122.txt` (repo root)
- Bản sao trùng của toàn bộ cây thư mục dưới `_qa-latest-candidate/` và
  `worktrees/*/` — đây là checkout cũ/song song, KHÔNG phải nguồn để khảo cổ
  (có thể chứa state cũ hơn `web/` chính); nếu bất kỳ agent nào sau này đọc
  nhầm từ các thư mục này, phải đối chiếu lại với `web/` chính trước khi kết
  luận.
- `windows/Cai-AI-Key.bat` / `.ps1` — tên có "Key", chưa xác minh là script
  cài đặt hay chứa key thật; giữ nguyên nguyên tắc không mở cho tới khi cần.
- `.env.example` (cả root và `web/`) — không sai khi mở (không phải secret
  thật), nhưng do quy tắc an toàn của lần khảo cổ này chưa được mở; nếu cần
  tham khảo cấu trúc biến môi trường, đọc lại có chủ đích ở Phần 3 khi làm
  Auth, không suy đoán nội dung ở đây.

Không bao giờ commit các file trên (hoặc giá trị của chúng) vào
`Tapdoanytedalinhvuc`. `.env.example` của repo mới được viết mới từ đầu, chỉ
liệt kê TÊN biến cần thiết, không chứa giá trị thật nào từ ZenithTasks.

## Pattern kỹ thuật đáng salvage nguyên (code pattern, không phải file copy)

| Pattern | Nguồn | Áp dụng ở đâu trong Tapdoanytedalinhvuc |
|---|---|---|
| Prisma lazy client qua Proxy (`db.ts`) — build không cần `DATABASE_URL` | `web/src/lib/db.ts` | Đã áp dụng ngay ở Phần 1 bootstrap (`src/lib/db.ts`). |
| AI job engine: idempotencyKey, approval, **verify step** (đọc lại DB sau khi ghi để xác nhận trước khi đánh SUCCEEDED), audit, polling worker | `v2-ai-job-engine.ts`, `scripts/ai-job-worker.ts` | Phần 8 (AI Runtime) — đừng viết lại từ đầu, đây là phần kỹ thuật trưởng thành nhất của ZenithTasks. |
| Cross-tenant negative-test harness chạy trên QA DB thật, có regex chặn URL giống production | `web/src/lib/v2-write-denial.itest.ts`, `web/scripts/qa/*` | Phần 3 (Company isolation test suite) — copy cấu trúc test, không copy dữ liệu. |
| Domain facade / bridge migration (đọc model cũ qua interface mới trước khi đổi vật lý) — đề xuất trong audit Phiên 2, phù hợp cả với phát hiện thật rằng đổi tên bảng hàng loạt rất rủi ro | audit doc mục 14-16 (Phiên 2/4) | Phần 2 (Migration Contracts) — dùng làm chiến lược mặc định khi chuyển `ZProject`→`Company`+`Project`. |
| "Preview → Approve → Execute → Verify → Audit" cho chứng từ thanh toán (`PaymentRequest`) | `ke-toan/de-nghi-thanh-toan` | Phần 8 (Decision Inbox) — UI pattern tốt nhất hiện có cho High-Risk Action Principle. |
| Today Workqueue: suy việc từ dữ liệu sẵn có, không cần schema/cron riêng | `lib/workqueue.ts` | Phần 9 (Employee "Today") — salvage triết lý, viết lại interface `WorkSignalProvider` tổng quát hơn (đúng như audit Phiên 4 mục 35 đề xuất) thay vì hard-code từng loại tín hiệu. |
| RBAC single-source-of-truth (`permissions.ts` MODULES array vừa gate server vừa build nav) | `lib/permissions.ts` | Phần 3 — tránh lặp lại lỗi "V2 command palette hard-code nav riêng, không qua RBAC" (xem Capability Matrix mục Bug mới #4). |
| Test 2-lane: unit (`*.test.ts`, không cần DB) tách khỏi integration (`*.itest.ts`, cần Postgres thật, `fileParallelism:false`) | `vitest.config.ts` / `vitest.integration.config.ts` | Đã note trong `docs/project/CURRENT_STATE.md` — Tapdoanytedalinhvuc dùng cùng convention ngay từ đầu. |
| Toán tiền nguyên tử qua `$transaction` + lock (`withCaseLock`) | `lib/financial-summary.ts` | Phần 6 (Finance/Payroll) — bất kỳ thao tác ghi tiền nào cũng phải theo mẫu này. |
| Modal/Dropdown PHẢI render qua Portal ra `document.body`, không render tại chỗ trong khối có `overflow`/`sticky` | `components/ui/dropdown-portal.tsx`, `components/ui/modal.tsx` (cạm bẫy #16, #17 trong BAN-GIAO.md — đã tốn nhiều công sức mới phát hiện) | Áp dụng ngay từ component UI đầu tiên có modal/dropdown ở Phần 9 — đây là bài học trả giá đắt, đừng lặp lại. |
| Server Action lưu dữ liệu dùng hook kiểu `useFormAction` (tắt pending ngay khi action trả về, `router.refresh()` chạy nền) thay vì `useActionState` + `revalidatePath` trong action | `lib/use-form-action.ts` (cạm bẫy #3 BAN-GIAO.md) | Salvage nguyên pattern khi viết form layer Phần 4 trở đi. |

## Bài học KHÔNG được lặp lại (đã trả giá ở ZenithTasks)

1. **Không để 1 role toàn cục bypass mọi tenant boundary** (L-V01 trong
   Capability Matrix) — thiết kế Company Membership ở Phần 3 phải chặn ngay
   từ đầu, không để lại "tạm thời" như V2 đã làm.
2. **"Declared capability ≠ working capability"** phải có test cấu trúc tự
   động kiểm tra mọi tool/allowlist đều có handler thật (L-V09) — không chỉ
   dựa vào review bằng mắt.
3. **Không mount 2 component cùng bắt 1 global keyboard shortcut** (bug Ctrl+K
   kép, xem Capability Matrix mục Bug mới #1) — khi thêm command
   palette/global shortcut mới, luôn kiểm tra có listener nào khác đã đăng ký
   chưa.
4. **Không thêm nav entry trỏ route chưa tồn tại** (`/phe-duyet`, Bug mới #2)
   — đây là quy tắc C11 trong Product Constitution ("feature chưa end-to-end
   thì chưa DONE"), ZenithTasks đã vi phạm ít nhất 2 lần (audit cũ + lại tái
   diễn 28/08).
5. **Không để nhiều tài liệu "nguồn sự thật" cập nhật lệch ngày nhau**
   (BAN-GIAO.md 24/08 vs CHANGELOG.md/VERSION.md 28-29/08 kể hai câu chuyện
   sản phẩm khác nhau) — đây là lý do trực tiếp Master Prompt yêu cầu tối
   thiểu hoá số file "MASTER" (`docs/project/SESSION_PROTOCOL.md` mục Source
   of Truth Hierarchy).
6. **Không rollout logic tính tiền mới khi logic cũ đang có bug đã biết mà
   chưa fix xong** (double-revenue-count khi 1 người vừa là consultant vừa
   doctor) — hoàn tất `CaseRevenueAllocation` migration trước khi salvage
   công thức hoa hồng sang Company scope.

## Migration wave đề xuất (tham khảo từ audit Phiên 2 & 4 — Phần 2 sẽ quyết định chính thức)

Không thực thi ở Phiên 1. Ghi lại để Phần 2 không phải suy nghĩ lại từ đầu:

`Task → Organization → Customer/Appointment → Sales → Finance → Payroll →
Real Project → Clinic Adapter → Proactive AI`. Lý do thứ tự: rủi ro tài
chính/y tế tăng dần, và Task/Org là nơi đã có cả 2 phiên bản (legacy
Plan/PlanTask + V2 ZWorkspaceTask/ZOrganizationUnit) để đối chiếu trước khi
đụng tới tiền.
