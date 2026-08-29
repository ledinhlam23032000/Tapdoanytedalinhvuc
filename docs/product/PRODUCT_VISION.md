# Product Vision — Tapdoanytedalinhvuc

## Vì sao sản phẩm này tồn tại

Chủ dự án bắt đầu từ một phần mềm phục vụ một công ty (ZenithTasks — quản trị
Trung tâm Phẫu thuật Thẩm mỹ / Bệnh viện Đa khoa Hồng Phúc), và muốn nâng cấp
thành một hệ sinh thái nhân rộng: từ công ty mẹ sang nhiều công ty con, mỗi
công ty con có AI riêng hoạt động như một trợ lý giám đốc vận hành số, với
quyền hành động thực sự (không chỉ trả lời) cho các việc rủi ro thấp, và xin
duyệt cho việc rủi ro cao.

Nguyên văn mong muốn của chủ dự án: *"phần mềm vừa đơn giản linh hoạt dễ nhìn
lại vừa phù hợp với người Việt... phần mềm phải là công cụ đồng hành chứ
không phải là gánh nặng với người dùng."*

## Vì sao ZenithTasks (bản cũ) không tiếp tục là target

Audit lịch sử (`tổng nhận xét dự án của chúng ta.docx`, xem
`docs/legacy/SALVAGE_LEDGER.md`) kết luận ZenithTasks mắc "Capability
Sprawl": năng lực kỹ thuật tăng nhanh hơn product coherence. Cụ thể:

- `ZProject` bị dùng để đại diện đồng thời Company + Branch + Project +
  Workspace + Tenant + AI scope + Finance scope + HR scope — sai lệch domain
  lớn nhất.
- Hai "nhân cách" sống chung: Clinic Legacy (CRM/lịch/tài chính/HR bệnh viện)
  và "Zenith Operating Framework V2" (multi-tenant/modules/AI) được ghép cạnh
  nhau thay vì hội tụ thành một kiến trúc thống nhất.
- Backend AI tiến xa hơn UX AI (có ghi nhận: AI Job V2 tồn tại nhưng chưa có
  UI thực sự để người dùng khởi tạo — "năng lực khai báo" ≠ "năng lực hoạt
  động thật").
- Complexity kỹ thuật lộ ra UI (module version, rollback, config proposal,
  tool allowlist...) thay vì ẩn sau AI/business language.

Kết luận: kiến trúc V2 không sai hoàn toàn — nó là "một prototype khá tốt của
Company architecture nhưng đặt nhầm tên và nhầm cấp abstraction". Rất nhiều
giá trị (tenant-scoped data, membership, org tree, position, AI per tenant,
approval, audit, ledger, payroll, task) đáng salvage. Xem chi tiết bằng chứng
trong `docs/legacy/LEGACY_CAPABILITY_MATRIX.md`.

## Vì sao repo mới thay vì tiếp tục sửa ZenithTasks tại chỗ

Quyết định của chủ dự án (ghi trong MASTER PROMPT, ưu tiên cao nhất, override
mọi chỉ thị lịch sử nói ngược lại): xây `Tapdoanytedalinhvuc` là
**GREENFIELD ARCHITECTURE × BROWNFIELD SALVAGE** — kiến trúc domain sạch từ
đầu, nhưng khảo cổ và chuyển hóa toàn bộ giá trị đã chứng minh của
ZenithTasks (thay vì rewrite từ trí nhớ, và thay vì tiếp tục vá một
abstraction đã sai ở gốc).

## Sản phẩm cuối cùng trông như thế nào

- Founder đăng nhập → Mission Control → biết Company nào cần chú ý, quyết
  định nào đang chờ, dùng AI Tổng, quản trị bằng ngoại lệ.
- Company Director/Manager đăng nhập → Company Home → AI Brief, Cần làm, Cần
  quyết định, Cần biết.
- Employee đăng nhập → Today → biết việc tiếp theo, làm việc.
- AI Company: observe → detect → prioritize → propose → execute nếu được
  phép → verify → report.

Không phải "phần mềm có rất nhiều chức năng" — mà là "một trợ lý vận hành
doanh nghiệp có cả hệ thống phần mềm phía sau".
