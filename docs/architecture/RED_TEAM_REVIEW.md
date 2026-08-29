# Red-team & Simplicity Review — Phần 2

Theo Master Prompt mục CXXVI–CXXVIII: trước khi chốt Phần 2, giao review đối
kháng cố tình tìm cách phá kiến trúc + review đơn giản hoá cố tình tìm
over-engineering. Thực hiện bằng 2 subagent độc lập (không đọc bài của nhau),
mỗi agent tự đọc toàn bộ 7-8 file docs Phần 2 + Legacy Capability Matrix rồi
trả lời có trích dẫn nguyên văn — không dùng ý kiến chung chung.

## Red Team (tenant/security) — 8 câu hỏi bắt buộc (mục CXXVII)

| # | Câu hỏi | Kết luận | Mức độ |
|---|---|---|---|
| 1 | Company A có thể đọc B? | PARTIALLY_UNCLEAR — nguyên tắc đúng, cơ chế enforcement kết cấu (RLS/query layer chung) chưa chốt | P2 — để Phần 3 |
| 2 | AI có override Company boundary? | PARTIALLY_UNCLEAR → **đã sửa**: "permission" cho Ecosystem AI ghi Company B nay yêu cầu CompanyMembership tường minh, không chỉ role Ecosystem-tier | **P1 — đã sửa** |
| 3 | Relation nối chéo Company? | PARTIALLY_UNCLEAR → **đã sửa**: composite FK/DB constraint bắt buộc (không chỉ "cân nhắc") cho Finance + Healthcare | **P1 — đã sửa** |
| 4 | Project lén thành Company? | NO_MITIGATED — ADR-008 + Domain Model nhất quán, không có gap | — |
| 5 | Branch bị biến thành tenant? | NO_MITIGATED — ADR-010 chặn rõ; 1 điểm nhất quán nhỏ (branchId?/departmentId? vs orgUnitId?) **đã sửa** | P2 — đã sửa |
| 6 | Global admin bypass quay lại? | PARTIALLY_UNCLEAR → **đã sửa**: `ECOSYSTEM_ADMIN` nay có ràng buộc tường minh y hệt FOUNDER, không tự cấp quyền Company nào | **P1 — đã sửa** |
| 7 | Healthcare kéo Core về Clinic? | NO_MITIGATED — ranh giới nhất quán ở 4 tài liệu, không có gap | — |
| 8 | Duplicate source of truth? | Work engine: NO_MITIGATED (đã hợp nhất). Revenue cho Payroll: PARTIALLY_UNCLEAR → **đã sửa**: bắt buộc derive từ LedgerEntry/Sale canonical, ghi rõ trong Domain Model | P2 — đã sửa |

## Simplicity Review — 5 câu hỏi bắt buộc (mục CXXVIII)

| # | Câu hỏi | Kết luận | Mức độ |
|---|---|---|---|
| 1 | Generic engine/ScopeRef không có use case? | Có gap: `Agent.scopeType` polymorphic 4 chiều nhưng chỉ 2 chiều có ví dụ, mâu thuẫn với Data Ownership | **P2 — đã sửa** (trim còn ECOSYSTEM\|COMPANY) |
| 2 | Config table chưa cần thiết? | Có gap: "Feature configuration primitives" không định nghĩa ở đâu | **P2 — đã sửa** (xoá khỏi Platform list) |
| 3 | Giải vấn đề chưa có? | Có gap: `Company.type` pre-bake AESTHETICS/DISTRIBUTION/SERVICE/RETAIL dù chỉ có 1 Company HEALTHCARE thật | **P2 — đã sửa** (trim còn GENERAL\|HEALTHCARE\|OTHER) |
| 4 | Under-specified/nullable mơ hồ? | Có gap: `Customer.projectId?` mơ hồ (cột thật hay qua join table?); `Company.status DRAFT?` chưa dứt điểm | **P1 — đã sửa** (Customer bỏ cột projectId; DRAFT chốt là có) |
| 5 | Entity dư thừa? | PARTIALLY_UNCLEAR: Position/Assignment thiếu near-term justification cụ thể (tiền thân legacy là dead code) | **P2 — đã sửa** (thêm ví dụ cụ thể: kiêm nhiệm + lịch sử chuyển vị trí ở Hồng Phúc) |

## Tổng kết

- 3 vấn đề mức **P1** (đều liên quan trực tiếp tới nguy cơ tái tạo lỗ hổng
  ADMIN-bypass thật của ZenithTasks, dưới hình dạng mới: AI ghi xuyên
  Company, `ECOSYSTEM_ADMIN` tên gần giống "ADMIN", và composite FK bị nói
  mềm thành "cân nhắc") — **đã sửa toàn bộ** trong `DOMAIN_MODEL.md`,
  `TENANT_INVARIANTS.md`, `SECURITY_BOUNDARIES.md`.
- 5 vấn đề mức **P2** (premature scope polymorphism, config surface không
  định nghĩa, pre-built vertical taxonomy, entity thiếu justification, 1 điểm
  không nhất quán field naming) — **đã sửa toàn bộ**.
- 0 vấn đề mức **P0**. Không có HARD BLOCK.
- Bốn phần được cả hai reviewer xác nhận vững chắc, không cần sửa: Project ≠
  Company (ADR-008), Branch ≠ tenant (ADR-010), Healthcare vertical boundary
  (ADR-004), Work Core hợp nhất một engine (Law XXXIV).

**Kết luận:** Phần 2 đạt Definition of Done (mục CL) sau khi áp dụng các sửa
đổi trên. Sẵn sàng chuyển Part 3.
