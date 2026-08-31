# Customer (Phần 5)

`Customer` lưu **business relationship data** — tên, SĐT, email, địa chỉ,
nguồn, người phụ trách, ghi chú business, lịch hẹn, tương tác, giao dịch
(mục V). KHÔNG phải Electronic Medical Record — dữ liệu y tế (chẩn đoán, hồ
sơ bệnh án, tiền sử, thủ thuật) thuộc Healthcare Vertical (Phần 7, mục IV).

## Ownership + attribution

`Customer.companyId` bắt buộc. Optional: `sourceId` (CustomerSource),
`ownerUserId` (User, phải cùng Company), `organizationUnitId`. **Không bao
giờ** thuộc Project (mục III).

## Status vs Journey Stage — 2 field tách biệt (mục XXXVII)

- `CustomerStatus` (ACTIVE/INACTIVE/ARCHIVED) — trạng thái vận hành đơn
  giản, không mã hoá hành trình bán hàng.
- `CustomerJourneyStage` (NEW/CONTACTING/ENGAGED/APPOINTED/ACTIVE/
  FOLLOW_UP/INACTIVE) — ví dụ minh hoạ theo đúng mục XXXVI, không phải
  hard-code vĩnh viễn; đổi bộ giai đoạn khác qua ADR mới khi có Company thật
  cần khác.

## Lead → Customer (ADR-017)

Không có "Customer + lifecycle field thay Lead" — `Lead` là entity thật
riêng biệt (bằng chứng: `LEGACY_CAPABILITY_MATRIX.md` L-C04). Xem
`LEAD.md`.

## Trùng lặp (dedup) — cảnh báo, không tự gộp (mục XVI-XIX, ADR-020)

`normalizePhone()` (chuẩn hoá SĐT VN — xử lý +84/0/khoảng trắng/dấu gạch,
KHÔNG xây chuẩn hoá viễn thông quốc tế đầy đủ) → `hashPhone()` (SHA-256, tra
trùng, không đảo ngược được) → so trùng trong CÙNG Company. Trùng chỉ hiện
cảnh báo "Có thể khách hàng này đã tồn tại" (mục CXCIII) — nhân viên tự
quyết định tạo tiếp hay dùng lại. KHÔNG tự động gộp theo tên (mục XVI).
Không có Customer Merge ở Phần 5 (ADR-020) — thêm khi có bằng chứng khối
lượng duplicate thật.

## Mã hoá SĐT tại rest (ADR-023)

`phoneCiphertext` (AES-256-GCM) + `phoneHash` (tra trùng) thay vì lưu
plaintext — `src/lib/crypto/phone.ts`. Không có cơ chế "reveal có audit"
riêng — quyền `customer.view` + Company scope đã là lớp kiểm soát. Không
log SĐT đầy đủ (mục CLVIII); audit metadata chỉ dùng ID, không dump nguyên
Customer (mục CLIX).

## Archive, không xoá (mục XX-XXI)

Có lịch sử (Appointment/Sale/Interaction) → không hard-delete, chỉ archive.
Archived Customer chặn ghi mới (Sale/Appointment) mặc định — phải restore
trước (mục CXLIX-CLII).

## Visibility (ADR-022)

`customer.view` = thấy toàn bộ Company, KHÔNG lọc theo `ownerUserId`. Chỉ
`customer.assign` (Manager trở lên, mục XCVII) mới đổi được người phụ
trách; đổi owner mặc định KHÔNG cascade sang WorkItem đang gán cho customer
đó trừ khi Manager chủ động chọn (mục XCVIII — chưa implement UI chọn cascade
ở Phần 5, ghi nhận là hành vi mặc định an toàn).

## Interaction — append-only (mục XXIX-XXXIII)

`CustomerInteraction` khác `AuditEvent`: Audit trả lời "hệ thống đổi gì",
Interaction trả lời "nhân viên đã tương tác với khách thế nào" (gọi/SMS/
chat/gặp/email/ghi chú). Không có update/delete — tạo interaction mới
(type=NOTE) thay vì sửa đè khi cần "ghi chú nhanh" (mục CI).

## Timeline — derived, không lưu trùng (mục XXXIV)

Customer detail hợp nhất Interaction + Appointment + Sale + WorkItem đang mở
theo thời gian — tính lúc đọc, không có bảng Timeline riêng.
