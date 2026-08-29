# Product Constitution — Tapdoanytedalinhvuc

Đây là luật sản phẩm. Mọi quyết định kiến trúc/UX/code phải tuân theo. Nếu một
quyết định mới mâu thuẫn với luật ở đây, luật thắng — trừ khi được sửa qua ADR
mới trong `docs/architecture/DECISIONS.md`.

## Sản phẩm là gì

Một **AI-native multi-company operating system**: lớp vận hành chung cho một
hệ sinh thái nhiều doanh nghiệp, không phải ERP, không phải phần mềm quản lý
một phòng khám, không phải chatbot.

```
FOUNDER → ECOSYSTEM → ECOSYSTEM AI
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
    COMPANY A         COMPANY B         COMPANY C
        │                 │                 │
    COMPANY AI        COMPANY AI        COMPANY AI
        │
People · Money · Customers · Work · Projects
```

Mỗi Company là một thế giới vận hành độc lập: dữ liệu riêng, nhân sự riêng,
tài chính riêng, AI riêng. Company A không mặc định thấy Company B. Ecosystem
AI/AI Tổng mới nhìn xuyên Company theo quyền và policy.

## Sáu mệnh đề domain (không được vi phạm)

1. **Company** là nơi dữ liệu business sống (Customer, Finance, HR, Payroll,
   Inventory, Sales, Work, Appointment...).
2. **Organization** là nơi con người thuộc về (Branch, Department, Team,
   Function).
3. **Project** là nơi một mục tiêu có vòng đời diễn ra. Project **không phải**
   Company.
4. **Module** là năng lực Company có (CRM, Sales, Finance, Payroll, Inventory,
   Healthcare).
5. **AI** là lớp giúp con người vận hành (observe → detect → prioritize →
   explain → propose → execute nếu được phép → verify → report).
6. **Ecosystem** là nơi Founder quan sát và điều phối nhiều Company.

Sai lầm lớn nhất của ZenithTasks (legacy) là để `ZProject` gánh đồng thời vai
Company + Branch + Project + Workspace + Tenant + AI Scope + Finance Scope +
HR Scope. Sản phẩm mới tuyệt đối không lặp lại.

## 20 điều luật (C1–C20)

- **C1** — Company is a first-class tenant.
- **C2** — Project is not Company.
- **C3** — Ecosystem is a first-class Founder boundary.
- **C4** — Healthcare/Clinic is a vertical, not the whole product.
- **C5** — Complexity stays behind the interface.
- **C6** — AI is a primary interface for complex work (không chỉ chatbot).
- **C7** — Founder manages by exception.
- **C8** — Employee starts from work.
- **C9** — One business job should have one primary user journey.
- **C10** — High-risk actions require controlled execution: Plan → Preview →
  Approve → Execute → Verify → Audit → Report.
- **C11** — Feature is not DONE until usable end-to-end (coded + tested +
  reachable + understandable + safe).
- **C12** — Search before create.
- **C13** — Reuse/fix/adapt before duplicating.
- **C14** — Do not create V2/V3/V4 parallel universes inside the new app.
- **C15** — Data ownership must be explicit.
- **C16** — Business facts come from canonical data; AI explains them, AI does
  not invent them.
- **C17** — Backend sophistication must not become frontend burden.
- **C18** — User-facing terminology must use business language (tiếng Việt rõ
  ràng, ít jargon).
- **C19** — Technical administration and business operations are separate
  experiences (Progressive Disclosure: Simple → Detail → Advanced →
  Technical).
- **C20** — The application must become simpler as its internal capability
  grows, not more complex.

## Feature Parity Ledger

Sản phẩm mới phải giữ trọn giá trị nghiệp vụ đã chứng minh của ZenithTasks.
Không được "thiết kế app mới" rồi vô tình bỏ mất nghiệp vụ cũ. Nguồn sự thật:
`docs/legacy/LEGACY_CAPABILITY_MATRIX.md` — mọi capability quan trọng phải có
Decision (KEEP/ADAPT/REWRITE/REPLACE/MERGE/RETIRE/DEFER/UNKNOWN) và lý do.
Không capability quan trọng nào biến mất âm thầm.

## Salvage, không copy

`GREENFIELD ARCHITECTURE × BROWNFIELD SALVAGE`. Kiến trúc mới sạch từ đầu;
logic/test/business rule/migration knowledge tốt của ZenithTasks được kiểm kê,
đánh giá và chuyển hóa — không copy nguyên file, không viết lại từ số 0 những
gì đã chứng minh là đúng.

## Kiến trúc ưu tiên

Modular monolith. Không tự động thêm microservices, Kafka, Kubernetes, event
mesh, plugin SDK, dynamic schema engine, workflow DSL, distributed agent
protocol — trừ khi có bằng chứng rất rõ ràng bắt buộc cần, kèm ADR.

## AI

AI là Digital COO / Chief of Staff, không phải chatbot. Vòng lặp bắt buộc:
OBSERVE → DETECT → PRIORITIZE → EXPLAIN → PROPOSE → APPROVE nếu cần → EXECUTE
→ VERIFY → AUDIT → REPORT. AI Tổng/Ecosystem AI không phải superuser vô hạn —
write vào Company vẫn qua scope/permission/policy/risk/approval/verify/audit.
Operational AI (giúp vận hành business) ≠ AI Operations (vận hành hạ tầng AI
— queue/retry/heartbeat/tool allowlist); người dùng thường chỉ thấy loại đầu.

## North Star UX

Mọi màn hình chính phải trả lời ít nhất một trong ba câu: **KNOW** (cần biết
gì?) / **DO** (cần làm gì?) / **DECIDE** (cần quyết định gì?). Nếu không, xem
lại có nên nằm ở primary UX không.

- Founder: quản trị bằng ngoại lệ — Mission Control ưu tiên EXCEPTIONS →
  DECISIONS → RISKS → OPPORTUNITIES → KPI.
- Company Director/Manager: Company Home = AI Brief + Cần làm + Cần quyết
  định + Cần biết.
- Employee: bắt đầu từ Today/Work Queue, không cần nhớ module nào chứa gì.

## Healthcare là vertical

Không xóa Clinic. Bệnh viện Đa khoa Hồng Phúc trở thành Company đầu tiên với
Healthcare Vertical gắn vào. Nghiệp vụ generic (Customer, Appointment,
Payment, Payroll, Attendance...) hướng về Company Core; nghiệp vụ y tế đặc thù
(MedicalCase, Consultation, Consent, Procedure, ClinicalPhoto, MedicalFollowUp)
giữ trong Healthcare vertical.

## Điều cấm

- Không tạo hai cách làm cùng một việc (nếu flow mới tốt hơn, flow cũ phải
  merge/deprecate).
- Không rewrite ZenithTasks big-bang; không migrate production tùy tiện.
- Không đưa thuật ngữ kỹ thuật (queue, heartbeat, tool allowlist, job ID,
  config version, tenant implementation) lên primary UX.
- Không để AI tự bịa số liệu kinh doanh khi có canonical data.
- Không commit secrets (.env, API key, credentials) vào bất kỳ repo nào.
