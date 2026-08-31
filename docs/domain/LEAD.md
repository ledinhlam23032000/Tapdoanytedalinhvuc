# Lead (Phần 5)

## Quyết định: Lead là entity thật (ADR-017)

Mục IX-X Master Prompt bắt buộc chốt "Lead riêng" hay "Customer +
lifecycle" bằng bằng chứng, không suy đoán. Bằng chứng thật:
`docs/legacy/LEGACY_CAPABILITY_MATRIX.md` dòng L-C04 — ZenithTasks có
`Customer` VÀ `Lead` là 2 model production tách biệt thật
(`schema.prisma:402-445` và `:464`), có cổng khách công khai
(`/khach-tham-khao`), có test riêng (`leads.test.ts`). Đây chính là "khối
lượng lead thật, chưa xác minh, chưa phải khách hàng" mà mục IX yêu cầu.

## Vòng đời

`NEW → CONTACTED → QUALIFIED → CONVERTED` (hoặc `→ LOST` bất kỳ lúc nào
trước CONVERTED). `CONVERTED` là trạng thái cuối — **không xoá Lead sau khi
convert** (mục XIII, giữ lịch sử).

## Convert — 1 transaction (mục XII)

1. Kiểm tra Lead chưa `CONVERTED`/`LOST`.
2. Dedup theo `phoneHash` trong cùng Company — nếu đã có Customer trùng SĐT,
   **tái dùng** Customer đó thay vì tạo mới.
3. Nếu chưa có, tạo `Customer` mới, giữ nguyên `name`/`phoneCiphertext`/
   `phoneHash`/`email`/`sourceId`/`ownerUserId` từ Lead.
4. Đánh dấu Lead `CONVERTED` + `convertedCustomerId` + `convertedAt`.
5. Audit `LEAD_CONVERTED`.
6. Tạo 1 `WorkItem` follow-up ("Liên hệ khách hàng mới chuyển đổi") giao
   cho `ownerUserId` của Lead (nếu có) — chứng minh chuỗi Lead → Customer →
   Work hoạt động thật, không phải optional bỏ qua ở Phần 5 vì chi phí thấp.

## Mã hoá SĐT

Cùng pattern với Customer (ADR-023) — `phoneCiphertext`/`phoneHash`, không
lưu plaintext.

## Quyền

`lead.view`/`lead.create` — mọi role có CRM cơ bản (MEMBER trở lên).
`lead.assign` — chỉ MANAGER trở lên (đổi người phụ trách Lead, cùng tinh
thần `customer.assign`). `lead.convert` — MEMBER trở lên (người đang làm
việc trực tiếp với Lead tự convert được, không cần escalate lên Manager —
convert không rủi ro hơn tạo Lead ban đầu).

## Không có trong Phần 5

Lead Merge/dedup riêng (dedup chỉ chạy tại thời điểm convert, nhắm vào
Customer — không xây dedup Lead-với-Lead độc lập, tránh trùng lặp logic
không cần thiết). Lead scoring AI (Phần 8).
