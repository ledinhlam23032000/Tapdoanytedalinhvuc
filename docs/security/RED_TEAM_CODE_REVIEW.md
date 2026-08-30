# Red-team Code Review — Phần 3

Theo Master Prompt mục CLXVIII: trước khi hoàn tất Phần 3, giao một
reviewer cố tình tìm cách vượt Company boundary từ **code thật** (không
phải docs) — route, server actions, repositories, permission resolver,
Company selector, membership endpoints, lifecycle actions. Thực hiện bằng 1
subagent đọc toàn bộ source code liên quan (schema, permission/authorization
layer, domain service, actions, toàn bộ `src/app`, và chính test suite hiện
có) rồi trả lời đủ 10 câu hỏi tự đặt dựa theo mục CLXIX Master Prompt.

**Kết quả: PASS.** Không dựng được bất kỳ cách vượt Company boundary nào.

## 10 câu hỏi + kết luận

| # | Câu hỏi | Kết luận | Mức độ |
|---|---|---|---|
| 1 | companyId/ecosystemId từ client có được tin mà không xác minh lại? | NO — actorId luôn từ session cookie, companyId/ecosystemId luôn re-verify qua DB mỗi lần gọi | — |
| 2 | Có permission check dạng so sánh role trực tiếp NGOÀI resolver/presets không? | Có 1 chỗ (`members/page.tsx` — chỉ quyết định hiện/ẩn UI option), gate thật vẫn ở server (`requireOwnerToGrantOwner`) | NONE (đã hardening thêm — xem dưới) |
| 3 | Server Action có bỏ qua re-check nếu gọi trực tiếp với companyId/membershipId khác? | Không — mọi function domain service tự re-derive + re-check độc lập mỗi lần gọi | — |
| 4 | Company-code routing có thể lộ Company khác nếu trùng code giữa 2 Ecosystem? | Không leak (mỗi candidate tự re-authorize độc lập) — chỉ có UX không xác định thứ tự nếu actor hợp lệ ở cả 2 | P2 (đã sửa — thêm `orderBy`) |
| 5 | Session/JWT có lỗ hổng cho user bị suspend/xoá vẫn hoạt động? | Không — `getCurrentActor()` đọc lại `User.status` từ DB mỗi request | — |
| 6 | "Chỉ Owner cấp Owner" / "last owner protection" / "không tự đổi role mình" có bị bỏ sót ở path nào? | Không — grep xác nhận chỉ 2 nơi ghi `CompanyMembership.rolePreset`/`.status`, cả 2 đều qua đủ 3 rule | — |
| 7 | Audit log có thể bị skip khi state change vẫn xảy ra? | Không — mọi write quan trọng bọc `db.$transaction` cùng `recordAudit` | — (1 ghi chú nhỏ: audit login nằm ngoài transaction vì không có state row nào khác cần đồng bộ) |
| 8 | Login có leak tồn tại email qua timing/response? Có chặn SUSPENDED? | Không leak (dummy-hash compare + 1 thông báo chung); SUSPENDED bị chặn đúng | — |
| 9 | Có chỗ nào fetch resource bằng ID trần rồi dùng luôn không xác minh companyId? | Không — cả 3 chỗ fetch-by-id đều có check `.companyId === authorizedCompanyId` ngay sau | — |
| 10 | `bootstrap-founder.ts` có rủi ro tạo Founder thứ 2/lộ secret khi chạy lại? | Không — idempotent qua `Ecosystem.code` unique, password chỉ qua `hashPassword`, không log secret | — |

## Đã sửa sau review (2 hardening nhỏ, không phải lỗ hổng thật)

1. **`resolveCompanyContextByCodeForActor`** — thêm `orderBy: { createdAt:
   "asc" }` để routing theo `code` xác định (deterministic) thay vì phụ
   thuộc thứ tự trả về ngẫu nhiên của DB, cho trường hợp hiếm một actor hợp
   lệ ở nhiều Company trùng code khác Ecosystem. Không phải rủi ro
   tenant-isolation (đã xác nhận qua review) — chỉ là hardening UX.
2. **`canGrantOwnerRole()`** (mới, `src/lib/permissions/registry.ts`) — tách
   logic "chỉ Owner cấp được Owner" thành 1 hàm dùng chung giữa server
   (`company-service.ts`) và UI (`members/page.tsx`), thay vì lặp lại
   `rolePreset === "OWNER"` ở 2 nơi có nguy cơ lệch nhau về sau.

## Không tìm thấy (đã chủ động tìm, không có)

- `role === "ADMIN"` bypass hoặc tương đương.
- `getAllCompanies()`/`findMany({})` không lọc.
- Thuật ngữ drift ("workspace tenant", "clinic root product"...).
- Bất kỳ chỗ nào fetch resource theo ID rồi dùng ngay không kiểm tra lại
  company scope.

Tham chiếu: `docs/security/AUTHORIZATION_MODEL.md` (thiết kế),
`src/lib/__tests__/tenant-isolation.itest.ts` (24 test tự động, chạy được
mỗi lần `npm run qa:tenant-isolation`).
