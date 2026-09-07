# Phần 7 — Digest spec Master Prompt (yêu cầu implement được)

Sinh từ workflow `part7-understand` (14 agent, mỗi agent một dải dòng riêng của
`docs/legacy/part7_master_prompt_section.md` — 6191 dòng, mục CCCLVIII cấm đọc trùng).

**462 yêu cầu · 209 bất biến · 194 quyết định cần ADR · 234 điều cấm/defer.**

Mục đích: implement Phần 7 **không cần mở lại spec 6191 dòng**. `sectionId` để truy nguyên khi cần.

## Bất biến phải enforce bằng code + test

1. VI: Model/feature legacy chưa được gán classification (1 trong 7 nhãn) thì không được migrate — cần cổng kiểm tra (check/test) chặn việc tạo model/service/migration cho item chưa phân loại hoặc nhãn UNKNOWN. `[case-appointment]`
2. VI: Mỗi model/feature legacy chỉ thuộc đúng MỘT nhãn classification (không đa nhãn). `[case-appointment]`
3. VII: Không tồn tại model Healthcare định nghĩa lại capability Core (User, Customer, Appointment, Task/PlanTask, Payment, CashTransaction, Sale, Payroll, Attendance, Inventory, Organization, Audit, Approval, AI execution, Files, Notifications) — Healthcare chỉ tham chiếu Core. `[case-appointment]`
4. X: Không tồn tại model HealthcareCustomer / ClinicCustomer / PatientCustomer trong schema. `[case-appointment]`
5. XI: Tạo Customer không kéo theo tự động tạo MedicalCase — không auto-create, không backfill hàng loạt. `[case-appointment]`
6. XII: Không có bảng identity thứ hai cho bệnh nhân; mọi tham chiếu bệnh nhân đều quy về Customer Core. `[case-appointment]`
7. XIII: HealthcareProfile không chứa lịch sử khám/điều trị (history thuộc MedicalCase và bản ghi lâm sàng). `[case-appointment]`
8. XIV: MedicalCase không mang vai trò Customer record (không lưu danh tính/thông tin liên hệ khách hàng). `[case-appointment]`
9. XV: MedicalCase.companyId NOT NULL và luôn được dùng trực tiếp cho scoping/authorization; cấm suy Company qua customerId -> Customer.companyId. `[case-appointment]`
10. XV/XXIII: Mọi relation của MedicalCase (customerId, primaryClinicianUserId, organizationUnitId) phải Company-valid — cùng companyId với MedicalCase; cần test cross-company reject. `[case-appointment]`
11. XIX: Ràng buộc DB unique(companyId, code) trên MedicalCase khi có code (unique theo Company, không unique toàn cục). `[case-appointment]`
12. XVII: Số lượng giá trị enum status giữ ở mức tối giản (mặc định 5: OPEN, IN_TREATMENT, FOLLOW_UP, CLOSED, CANCELLED) trừ khi nghiệp vụ legacy chứng minh cần thêm. `[case-appointment]`
13. XX: Quan hệ MedicalCase 1 - N Appointment; một Appointment tham chiếu tối đa một MedicalCase. `[case-appointment]`
14. XXI: Không tồn tại model/engine lịch thứ hai (MedicalAppointment) song song với Appointment Core. `[case-appointment]`
15. XXII: HealthcareAppointmentContext chỉ chứa field healthcare-specific, không lặp field thời gian/tài nguyên của Appointment Core; mỗi Appointment có tối đa một context. `[case-appointment]`
16. XXIII: Không có field text tự do lưu tên bác sĩ (kiểu doctorText) trên MedicalCase khi đã có User identity. `[case-appointment]`
17. XXIV: Enum global User Role không chứa DOCTOR, NURSE hay vai trò chuyên môn y tế khác. `[case-appointment]`
18. User core (model User cua Phan 3) khong duoc chua bat ky field healthcare nao (specialty, professional title, license, clinical identifiers) — test schema/Prisma phai fail neu co (XXV). `[consultation-procedure]`
19. Moi ClinicalConsultation phai co companyId va medicalCaseId khac null; khong ton tai consultation ngoai pham vi Company hoac ngoai MedicalCase (XXVII). `[consultation-procedure]`
20. Consultation/Procedure/Consent/Screening deu scoped theo Company: query cross-company bi chan, khong Company nao doc/ghi du lieu lam sang cua Company khac (XXVII, XXXVII, XLII). `[consultation-procedure]`
21. Moi clinical record co author (clinicianUserId), createdAt/updatedAt va sinh audit entry moi lan thay doi (XXIX). `[consultation-procedure]`
22. Clinical record da FINAL/finalized/signed khong duoc overwrite: duong update noi dung goc bi chan, thay doi chi thuc hien qua ADDENDUM (XXX, XXXI). `[consultation-procedure]`
23. Sale va Procedure la hai entity tach biet: khong co rang buoc 1-1 bat buoc, Procedure khong tu dong sinh ra chi vi co Sale, va Sale khong duoc dung lam bang chung cho viec da thuc hien chuyen mon (XXXV, XXXVI). `[consultation-procedure]`
24. Procedure khong duoc chuyen sang IN_PROGRESS/COMPLETED neu preconditions theo procedure type chua thoa (case open, consent, screening, appointment, clinician assigned) — enforce o domain service, co test cho tung to hop (XXXIX). `[consultation-procedure]`
25. Preconditions duoc doc tu policy theo procedure type, khong hard-code chung mot bo dieu kien cho moi procedure (XXXIX). `[consultation-procedure]`
26. Consent ton tai duoi dang record rieng; khong duoc thay the bang boolean/checkbox tren MedicalCase (XLII). `[consultation-procedure]`
27. Procedure tham chieu CatalogItem cua Phan 5 cho phan gia/dich vu; khong ton tai bang gia rieng cho healthcare (XL). `[consultation-procedure]`
28. ConsentRecord.companyId phải khớp companyId của MedicalCase mà nó tham chiếu; không tồn tại ConsentRecord trỏ sang Case của Company khác. `[consent-photo-file]`
29. Mọi truy vấn/đọc/ghi ConsentRecord đều bị ràng buộc bởi Company scope hiện tại — không có đường nào đọc consent cross-company (kể cả role Ecosystem-tier). `[consent-photo-file]`
30. ConsentRecord đã ở trạng thái đã ký là immutable về nội dung và version: cập nhật ConsentTemplate không được làm thay đổi version/nội dung của bất kỳ ConsentRecord đã ký nào. `[consent-photo-file]`
31. ClinicalPhoto.companyId phải khớp companyId của MedicalCase mà nó tham chiếu. `[consent-photo-file]`
32. Mọi truy cập tới file ảnh lâm sàng phải qua đủ 4 lớp: authenticated + Company scope + Healthcare permission + case access; không lớp nào được bỏ qua. `[consent-photo-file]`
33. Không tồn tại endpoint hoặc URL nào cho phép truy cập ảnh lâm sàng mà không cần xác thực (không có public/unauthenticated access). `[consent-photo-file]`
34. Signed URL cho ảnh lâm sàng phải có thời hạn ngắn (short-lived), không phát hành URL vô thời hạn. `[consent-photo-file]`
35. Không có log nào (application/audit/error/request) chứa signed URL hoặc token truy cập file ảnh lâm sàng. `[consent-photo-file]`
36. Xóa ảnh lâm sàng mặc định là archive/void: phải có reason và bản ghi audit; không có hard delete trong luồng thao tác thông thường. `[consent-photo-file]`
37. Customer profile photo và ClinicalPhoto lưu tách biệt — không dùng chung record/model; một ảnh không đồng thời là cả hai. `[consent-photo-file]`
38. Binary của consent document và clinical photo không lưu trong database; DB chỉ giữ metadata + tham chiếu tới File Storage. `[consent-photo-file]`
39. Mot ban ghi material usage khong bao gio lam giam ton kho qua hai lan — idempotency/source uniqueness bat buoc (LXX, spec danh dau 'Critical'). Test: goi issueStock hai lan cung source phai khong tao movement thu hai. `[followup-material]`
40. Moi thay doi ton kho tu healthcare deu di qua command `issueStock(...)` cua Inventory voi `source = ProcedureMaterialUsage`; khong ton tai duong ghi truc tiep vao truong stock (LXIX). Test: khong co code path nao trong Healthcare update quantity ton kho truc tiep. `[followup-material]`
41. Khong ton tai bang/engine ton kho rieng cho healthcare (vd ClinicMaterialStock); so luong ton chi co mot nguon su that la Inventory (LXVI). `[followup-material]`
42. Khong ton tai task engine thu hai: moi viec can nguoi lam deu la `WorkItem` cua Work module; MedicalFollowUp khong mang truong assignment/due kieu task (LIX, LXI). `[followup-material]`
43. `ProcedureMaterialUsage` va `MedicalFollowUp` deu co `companyId` va moi truy van/ghi phai scope theo company — Company A khong doc/ghi duoc du lieu Company B (LX, LXVIII + invariant nen). `[followup-material]`
44. Sua sai material usage chi qua reversal/correction co kiem soat va co audit trail; khong xoa cung hoac sua ngam ban ghi da tru kho (LXXI). `[followup-material]`
45. Cac moc follow-up (Day 1/3/7/Month 1...) khong duoc hard-code trong code product — phai doc tu cau hinh theo procedure (LXII). `[followup-material]`
46. Khong co AI path nao dua ra chan doan y khoa tu dong; red flag chi sinh Work/Signal cho con nguoi xu ly (LXV). `[followup-material]`
47. `inventoryItemId` va `inventoryLocationId` trong ProcedureMaterialUsage phai tro toi InventoryItem/InventoryLocation cua nen (FK that), khong phai chuoi tu do hay catalog rieng (LXVIII, LXXII). `[followup-material]`
48. MedicalCase/Procedure tạo và hoàn tất được khi KHÔNG có Sale/SaleLine liên quan (FK nullable, không có guard bắt buộc). Test: tạo case + procedure + complete procedure trên một Customer chưa từng có Sale nào -> phải thành công. (LXXIII) `[finance-access-permission]`
49. Permission healthcare.* KHÔNG bao giờ implicit-grant finance.* hoặc payroll.*. Test: user chỉ có healthcare.case.view + healthcare.consultation.view gọi API case/customer detail -> response KHÔNG chứa field số tiền/payment amount. (LXXIV, LXXV, LXXVII) `[finance-access-permission]`
50. Reception permission pack KHÔNG chứa quyền đọc nội dung khám chi tiết (healthcare.consultation.view và tương đương). Test: assert nội dung pack + gọi endpoint consultation bằng user reception -> 403. (LXXVI) `[finance-access-permission]`
51. Nurse permission pack KHÔNG chứa bất kỳ permission payroll/finance nào. Test: assert set permission của pack không giao với namespace finance.*/payroll.*. (LXXVII) `[finance-access-permission]`
52. Doctor permission pack KHÔNG chứa quyền company admin. Test: assert pack không chứa quyền quản trị Company; user doctor gọi endpoint quản trị Company -> 403. (LXXVIII) `[finance-access-permission]`
53. MedicalCase.companyId === Customer.companyId; không tồn tại Case gắn Customer khác Company. Enforce ở service + DB constraint; test tạo cross-company -> reject. (LXXXV) `[finance-access-permission]`
54. Mọi thao tác đọc/ghi trên MedicalCase, Consultation, Procedure, Photo, Consent, FollowUp đều yêu cầu CompanyMembership tường minh trên đúng Company của Case - kể cả Founder/Ecosystem-tier và kể cả khi đi qua AI. Test: user Company B (có ecosystem role cao) truy cập Case Company A -> 403. (LXXXVI) `[finance-access-permission]`
55. Photo.companyId === companyId của MedicalCase/Customer chứa nó; phục vụ file/asset cũng kiểm company scope, không chỉ kiểm ở query list. Test: request ảnh của Company A bằng session Company B -> 403. (LXXXVII) `[finance-access-permission]`
56. Material/vật tư tiêu thụ trong Procedure phải cùng companyId với Procedure. Test: ghi nhận vật tư Company B vào Procedure Company A -> reject. (LXXXVIII) `[finance-access-permission]`
57. Ràng buộc cross-company của Appointment (từ Core) vẫn giữ nguyên sau khi tích hợp healthcare. Test regression: các test cross-company Appointment của Phần 3-6 vẫn pass; đường đi mới healthcare -> Appointment cũng bị chặn tương tự. (LXXXIX) `[finance-access-permission]`
58. MedicalCaseMember chỉ tạo được cho User đã có CompanyMembership trên Company của Case; case-team assignment không tự sinh membership và không cấp quyền vượt permission pack. Test: thêm user không có CompanyMembership làm case member -> reject. (LXXXIII, LXXXIV) `[finance-access-permission]`
59. Khi module Healthcare chưa được bật cho một Company, các entity/route healthcare không truy cập được với Company đó. Test: gọi API healthcare trên Company chưa bật module -> từ chối. (XC) `[finance-access-permission]`
60. Bat/tat module Healthcare khong duoc thay doi kien truc tenant: khong doi cach resolve Company context, khong doi rang buoc CompanyMembership, khong noi long cach ly du lieu giua cac Company (XCI). Test: bat module tren Company A khong lam Company B thay/ghi duoc du lieu cua A. `[module-parity-journey]`
61. Company Type khong bao gio anh huong den schema — khong co nhanh code nao doi cau truc model theo company type (XCII). `[module-parity-journey]`
62. Khong co du lieu that (patient, medical photo, diagnosis, finance, payroll) trong dev DB; moi ban ghi lam sang trong fixture deu mang dau hieu synthetic nhan dien duoc (XCIV, XCV). `[module-parity-journey]`
63. Moi capability legacy trong bang phan loai deu co Salvage Decision thuoc {KEEP, ADAPT, REWRITE, MERGE} va co Parity Level thuoc {P0,P1,P2,P3} — khong duoc de trong (XCIX, CI). `[module-parity-journey]`
64. Capability khong duoc tai tao phai co ban ghi RETIRE day du 3 phan: because / replacement / migration handling (C). `[module-parity-journey]`
65. Moi meaningful fact cua legacy phai co destination trong mo hinh target (CIV). `[module-parity-journey]`
66. Dich vu consultation-only phai hoan tat duoc ma khong can procedure, khong can consent, khong can material usage — validation khong duoc bat buoc cac stage khong ap dung (CVI). `[module-parity-journey]`
67. Ham tinh procedure readiness la deterministic: cung input trang thai luon tra ve cung ket qua, khong goi AI, khong dung random/thoi gian hien tai (CVIII). `[module-parity-journey]`
68. Readiness = not ready khi thieu consent bat buoc, va ly do phai duoc liet ke ro rang (CIX). `[module-parity-journey]`
69. CVIII/CIX: Ket qua procedure readiness luon do code deterministic tinh; khong co code path nao cho LLM quyet dinh readiness. Test: cung input -> cung output; consent thieu hoac screening chua xong => readiness = not ready. `[ai-audit-privacy]`
70. CX: Khong ton tai duong ghi nao cho phep AI dat trang thai cho phep/authorize thu thuat; authorization chi do actor nguoi dung co quyen. `[ai-audit-privacy]`
71. CXI: AI khong tu tao diagnosis/indication chinh thuc; moi diagnosis/indication co nguon AI phai di qua buoc clinician xac nhan. `[ai-audit-privacy]`
72. CXII: Moi high-risk clinical write (final diagnosis, procedure indication, procedure completion, consent state, clinical correction) deu co actor + permission check + audit record — khong co truong hop ghi khong audit. `[ai-audit-privacy]`
73. CXIII/CXV: Ban ghi clinical do AI soan luon o trang thai draft cho den khi clinician xac nhan; UI khong duoc hien khuyen nghi AI nhu medical order da chot. `[ai-audit-privacy]`
74. CXVI: AI summary la derived, khong bao gio ghi de len canonical record (Consultation/Procedure/Consent/Screening/Follow-up). `[ai-audit-privacy]`
75. CXVII: Cac su kien consultation finalized, consent signed/voided, procedure performed, clinical photo added/removed, clinical correction, material usage, follow-up closed deu sinh audit event — test bao phu tung su kien. `[ai-audit-privacy]`
76. CXX: Khong ton tai duong sua ban ghi clinical final ma thieu reason/actor/timestamp/trace. `[ai-audit-privacy]`
77. CXXI: Hard delete ban ghi clinical da finalized luon bi tu choi (default deny). `[ai-audit-privacy]`
78. CXXIV/CXXV: Technical log khong bao gio chua diagnosis day du, anh, medical note, du lieu dinh danh — chi ID va metadata an toan. `[ai-audit-privacy]`
79. CXXVI/CXXVIII: Export va download file clinical deu authorize server-side tai thoi diem thao tac, khong dua vao quyen da check luc render trang. `[ai-audit-privacy]`
80. CXXIX/CXXX: Moi ket qua search healthcare deu da qua loc Company scope + healthcare permission; search Ecosystem khong tra noi dung clinical xuyen Company khi thieu quyen healthcare tuong minh. `[ai-audit-privacy]`
81. CXXXI: Role tier Ecosystem (ke ca FOUNDER) khong tu dong cho quyen doc PHI — test: Founder khong co quyen healthcare tuong minh => bi tu choi doc clinical note. `[ai-audit-privacy]`
82. CXXXV/CXXXVI: ID do client gui khong cap quyen; server luon resolve Company/Customer/MedicalCase + permission cua actor truoc khi tra du lieu. `[ai-audit-privacy]`
83. CXXXVII: Cache lien quan clinical luon co Company + permission trong khoa; khong co cache dung chung lam lo PHI giua actor/Company. `[ai-audit-privacy]`
84. CXXXVIII: Khong ton tai URL cong khai (public CDN) tra ve anh clinical. `[ai-audit-privacy]`
85. Cross-company deny tuyệt đối trên mọi entity Healthcare: customer, medical case, clinician, appointment, procedure, consent, photo, inventory item (CXLIII, CXLIV, CLIV, CLVIII, CLXII, CLXVI, CLXXII, CLXXXIII). `[tests]`
86. Mọi ID truyền từ client đều phải được xác thực thuộc đúng Company trong context trước khi đọc/ghi — ma trận 9 loại ID ở CLXXXIII đều deny. `[tests]`
87. Company không bật module Healthcare thì không có navigation Healthcare VÀ direct route Healthcare cũng bị deny (CXLI). `[tests]`
88. History/audit của MedicalCase tồn tại sau khi close/archive — không bị xóa (CXLV). `[tests]`
89. Consultation đã finalize là bất biến: chỉ thay đổi qua controlled/addendum, bản gốc còn nguyên (CXLVIII). `[tests]`
90. Consent lưu snapshot template + version tại thời điểm ký; sửa template sau này không đổi consent đã ký (CLXI). `[tests]`
91. Void consent luôn kèm reason + audit record (CLXIII). `[tests]`
92. Clinical photo luôn là private file; truy cập trực tiếp URL bởi user không có quyền phải thất bại (CLXIV, CLXV). `[tests]`
93. Hoàn tất Work/task follow-up không bao giờ tự sinh clinical assessment/outcome (CLXX). `[tests]`
94. Mỗi lần Procedure sử dụng vật tư chỉ trừ kho đúng một lần; complete Procedure hai lần không tạo double side-effect (CLIX, CLXXI). `[tests]`
95. Tồn kho không bao giờ âm một cách âm thầm — mọi thiếu hụt phải theo Inventory policy và hiển thị/ghi nhận rõ (CLXXIII). `[tests]`
96. Reversal vật tư khôi phục đúng tồn kho và để lại audit (CLXXIV). `[tests]`
97. Thay đổi giá Sale không làm thay đổi clinical record đã ghi (CLXXV). `[tests]`
98. Company suspended: 0 clinical write mới (CLXXVII). Company archived: 0 clinical operation (CLXXVIII). `[tests]`
99. Thu hồi membership / kết thúc position / đổi professional permission có hiệu lực ngay — session cũ không giữ được quyền (CLXXIX, CLXXX, CLXXXI). `[tests]`
100. Mọi quyết định authorization được enforce ở server action, không phụ thuộc việc UI ẩn control (CLXXXII). `[tests]`
101. Phân tách quyền Finance ↔ Clinical: doctor không có finance permission không đọc được Finance data; finance user không có healthcare permission không đọc được medical note; clinical staff không sửa được payment nếu thiếu permission (CLI, CLII, CLXXVI). `[tests]`
102. CLXXXIX: Tab 'Hồ sơ chuyên môn' trên Customer detail chỉ tồn tại khi (Healthcare module enabled) VÀ (user có permission); thiếu một trong hai thì không render ra DOM. `[ux-integration-migration]`
103. CXC: Không tồn tại bảng/route danh bạ bệnh nhân riêng — mọi truy vấn bệnh nhân đi qua Customer Core. `[ux-integration-migration]`
104. CXCII: Mọi việc phát sinh từ workflow lâm sàng đều là WorkItem của Work Core; không tồn tại entity/engine ClinicalTask song song. `[ux-integration-migration]`
105. CXCIV: Today chỉ trả về item actionable, không trả về toàn bộ hồ sơ bệnh án. `[ux-integration-migration]`
106. CXCV: Nếu có Procedure trong ngày thiếu Consent thì Today của staff có quyền phải xuất hiện cảnh báo 'Cần hoàn thiện hồ sơ trước thủ thuật'; staff không có quyền thì không thấy. `[ux-integration-migration]`
107. CXCVI: 5 healthcare signal phải được tính deterministic (thuần rule/query), không phụ thuộc output LLM. `[ux-integration-migration]`
108. CC: Chuỗi 'Vertical Package', 'Healthcare Context Entity', 'ScopeRef', 'Module Adapter' không xuất hiện trong bất kỳ UI copy nào dành cho nhân viên y tế. `[ux-integration-migration]`
109. CCV: Autosave chỉ ghi trạng thái DRAFT; không có code path nào để autosave chuyển bản ghi sang finalized. `[ux-integration-migration]`
110. CCVI: Toàn bộ validation lâm sàng phải được enforce ở server; bypass client không tạo được bản ghi không hợp lệ. `[ux-integration-migration]`
111. CCVII+CCVIII: Field lâm sàng chưa ghi nhận phải trả về/hiển thị 'Unknown / not recorded'; cấm sinh giá trị âm tính mặc định (ví dụ 'No allergy'). Absence of record ≠ negative finding, phải phân biệt được ở cả model, API và UI. `[ux-integration-migration]`
112. CCXII: Query timeline phải lọc theo quyền ở server; user không được phép thấy record nào thì record đó không có mặt trong payload trả về. `[ux-integration-migration]`
113. CCXIII: Mọi request ảnh/thumbnail lâm sàng đều đi qua kiểm tra quyền, header cache không được public; không có URL public bền vững cho ảnh lâm sàng. `[ux-integration-migration]`
114. CCXV: Upload file lâm sàng bị từ chối nếu sai type/size thật; xác định type không chỉ dựa vào extension. `[ux-integration-migration]`
115. CCXVII: Storage path/tên file không chứa tên bệnh nhân; dùng opaque ID. `[ux-integration-migration]`
116. CCXVIII: Không tồn tại code mã hóa tự chế cho dữ liệu lâm sàng. `[ux-integration-migration]`
117. CCXX: Trong Phần 7 không có script/migration nào import dữ liệu lâm sàng legacy thật vào target. `[ux-integration-migration]`
118. CCXXIII: Bản ghi Consent sau migrate giữ nguyên version/content evidence, dates, signer, files và các quan hệ — kiểm chứng bằng test parity. `[ux-integration-migration]`
119. CCXXIV+CCXXXVI: Ảnh sau migrate giữ nguyên file nguồn, type, case, capture date, before/after semantics; toàn vẹn xác minh bằng checksum file. `[ux-integration-migration]`
120. CCXXVI: Import Procedure lịch sử không kích hoạt side effect của workflow lâm sàng (không trừ kho, không sinh WorkItem, không đổi trạng thái dây chuyền). `[ux-integration-migration]`
121. CCXXIX: Không có foreign key/mapping nào đưa legacy Customer/Payment vào bảng Healthcare. `[ux-integration-migration]`
122. CCXXXI+CCXXXIII: Mọi tham chiếu chéo khi migrate đi qua bảng ID mapping; Customer ID map phải tồn tại trước khi import Case; không giả định target ID = source ID. `[ux-integration-migration]`
123. CCX: AI summary luôn kèm link tới source record và không bao giờ được ghi đè/thay thế dữ liệu gốc. `[ux-integration-migration]`
124. Khong ton tai chuyen trang thai lam sang bat hop le: moi transition ngoai ma tran hop le bi tu choi bang business error (CCXL). `[parity-commands-constraints]`
125. Ban ghi lam sang da finalize la bat bien: moi sua doi tra ve CLINICAL_RECORD_FINALIZED, chi duoc bo sung qua addendum (CCXLI, CCLX). `[parity-commands-constraints]`
126. Moi su kien lam sang trong yeu deu sinh ban ghi audit truy nguoc duoc voi actor + company + resource + action (CCXLII, CCLVIII, CCXCVIII). `[parity-commands-constraints]`
127. File lam sang luon private va moi truy cap phai qua permission check server-side; biet fileId khong du de tai (CCXLIII, CCLIII, CCLXIII). `[parity-commands-constraints]`
128. Company A khong bao gio thay du lieu Company B qua bat ky kenh nao: query, search, export, file, cache (CCXLIV, CCLI, CCLII, CCLIII, CCLIV). `[parity-commands-constraints]`
129. Role tier Ecosystem khong tu dong cap quyen ghi vao mot Company cu the; phai co CompanyMembership tuong minh (CCXLV). `[parity-commands-constraints]`
130. Khong user nao tu nang quyen cua chinh minh (CCXLVI). `[parity-commands-constraints]`
131. Quyen chi den tu permission key tuong minh, khong bao gio suy ra tu ten Position/title (CCXLVII, CCXLVIII). `[parity-commands-constraints]`
132. User suspended khong con bat ky truy cap lam sang nao (CCXLIX). `[parity-commands-constraints]`
133. Server action khong bao gio tin companyId/scope gui tu client; company scope luon resolve tu session (CCLV, CCLXXVII). `[parity-commands-constraints]`
134. Moi ghi du lieu healthcare di qua domain command trong danh sach CCLVII; khong co CRUD tuy y tren model lam sang. `[parity-commands-constraints]`
135. Moi command nhay cam chay du 9 buoc pipeline dung thu tu: Actor -> Company scope -> Healthcare permission -> Resource scope -> State validation -> Business validation -> Transaction -> Audit -> Verify (CCLVIII). `[parity-commands-constraints]`
136. Moi lan ghi material usage tao dung mot inventory movement (idempotent, khong nhan doi khi retry) (CCLXIV). `[parity-commands-constraints]`
137. Consent luon co version + evidence khi duoc tao (CCLXII). `[parity-commands-constraints]`
138. UI khong bao gio hien ma loi noi bo (Prisma code, stack trace, ten bang/cot) (CCLXVI). `[parity-commands-constraints]`
139. Truy van MedicalCase luon co dieu kien companyId; khong ton tai 'get all cases' unscoped (CCLXXVIII). `[parity-commands-constraints]`
140. Khong ton tai ban ghi lam sang mo coi: moi quan he co FK tuong minh (CCLXXXII). `[parity-commands-constraints]`
141. Xoa khong bao gio lan truyen (cascade) vao lich su lam sang; dung Restrict/archive (CCLXXXIII, CCLXXXIV). `[parity-commands-constraints]`
142. Archive Customer khong lam mat lich su healthcare cua ho (CCLXXXV). `[parity-commands-constraints]`
143. MedicalCase khong bao gio scope theo Project (CCXCIII, CCXCIV). `[parity-commands-constraints]`
144. Khong model lam sang nao chua du lieu luong (CCXCVI). `[parity-commands-constraints]`
145. Khong ton tai model thanh toan rieng cho lam sang; billing dung core Finance (CCXCV). `[parity-commands-constraints]`
146. Branch chi la bo loc, khong bao gio thay the company boundary (CCXCII). `[parity-commands-constraints]`
147. Tin hieu cho AI (Phan 8) chi la deterministic operational signals, tinh duoc tu du lieu + rule (CCLXXIII). `[parity-commands-constraints]`
148. CCCXVII: Allergy khong bao gio default false — trang thai 'chua ghi nhan' phai khac 'da ghi nhan khong di ung'; test phai chan viec render/tra ve 'khong di ung' khi thuc te la unknown. `[deferred-aesthetics-traceability]`
149. CCCXVIII + CCCXIX: Moi canh bao lam sang va moi validation safety-critical phai deterministic (pure function tren du lieu da ghi), khong LLM — test cung input phai cho cung output. `[deferred-aesthetics-traceability]`
150. CCCXXII: Anh lam sang goc bat bien — khong co code path nao ghi de/sua file goc; ban dan xuat luon tham chieu ve original va original van doc lai duoc. `[deferred-aesthetics-traceability]`
151. CCCXXVI + CCCXXVII: Khong ep 1:1 — 1 Sale co the co N Procedure, 1 Case co the co N Sale; schema khong duoc co unique constraint chan cac quan he nay. `[deferred-aesthetics-traceability]`
152. CCCXXVIII: Case commercial summary luon derived tu Sales/Finance; khong ton tai cot tong luu san tren Case. `[deferred-aesthetics-traceability]`
153. CCCXXV + CCCXXXI: Healthcare khong so huu ban sao du lieu thuong mai hay ton kho — goi dich vu chi o Sales/Catalog, lot/stock chi o Inventory. `[deferred-aesthetics-traceability]`
154. CCCXXXIV: Moi truy van InventoryLot bi rang buoc theo Company hien tai; khong role Ecosystem-tier nao bypass duoc. `[deferred-aesthetics-traceability]`
155. CCCI + CCCII: Test khong bao gio gui message that ra ngoai / toi benh nhan that. `[deferred-aesthetics-traceability]`
156. CCCIII: Ban in consent luon khop version noi dung da luu tai thoi diem ky, khong doi khi template thay doi. `[deferred-aesthetics-traceability]`
157. CCCXXIX: Khong ton tai phep tinh profit/margin cua procedure suy ra tu vat tu khi chua co cost accounting. `[deferred-aesthetics-traceability]`
158. CCCXXXIII: Expiry alert tinh bang rule deterministic tren expiryDate trong Inventory. `[deferred-aesthetics-traceability]`
159. Không đọc/ghi dữ liệu production thật trong Phần 7; mọi công việc migration chỉ chạy trên schema + source + fixture synthetic (CCCXLVI). `[legacy-rules-agents-arch]`
160. Migration adapter (LegacyClinicReader / TargetHealthcareImporter) không bao giờ được cấu hình trỏ tới connection production (CCCXLVIII). `[legacy-rules-agents-arch]`
161. Code công cụ migration nằm ngoài runtime; runtime app không được import module migration (CCCXLIX). `[legacy-rules-agents-arch]`
162. Fresh DB test phải PASS: từ DB rỗng → migrate → seed healthcare synthetic → test → build (CCCLI). `[legacy-rules-agents-arch]`
163. Parity test: với fixture legacy synthetic tương đương, output target bảo toàn đầy đủ facts của legacy (CCCLII). `[legacy-rules-agents-arch]`
164. Không truy cập được record lâm sàng qua đoán ID, URL file trực tiếp, search, API, cached response, export, hay gọi trực tiếp server action khi không có quyền (CCCLIII). `[legacy-rules-agents-arch]`
165. Record lâm sàng của Company khác / Ecosystem khác không bao giờ đọc/ghi được — enforce ở mọi entrypoint kể cả file URL, export và server action (CCCLIII). `[legacy-rules-agents-arch]`
166. Không finalize được hai lần trên cùng một đối tượng (CCCLIV). `[legacy-rules-agents-arch]`
167. Clinical note đã final là bất biến — không sửa được (CCCLIV). `[legacy-rules-agents-arch]`
168. Không thực hiện/ghi nhận được procedure khi chưa có consent hợp lệ (CCCLIV). `[legacy-rules-agents-arch]`
169. Không issue trùng cùng một lô vật tư (material double issue bị chặn) (CCCLIV). `[legacy-rules-agents-arch]`
170. Version của consent không bao giờ bị mất — luôn truy nguyên được version đã ký (CCCLIV). `[legacy-rules-agents-arch]`
171. Clinical photo không thể bị hoán đổi quan hệ (gán sang bệnh nhân/ca khác) (CCCLIV). `[legacy-rules-agents-arch]`
172. Không đóng được case khi state không hợp lệ (CCCLIV). `[legacy-rules-agents-arch]`
173. Không có event store / event sourcing cho domain lâm sàng: state hiện tại luôn đọc trực tiếp từ bảng Prisma, không tái tạo từ chuỗi event (CCCLXIX). `[orchestration-events-reports]`
174. Không có dependency tới Kafka hoặc message broker ngoài trong codebase Phần 7; healthcare module giao tiếp in-process (CCCLXX). `[orchestration-events-reports]`
175. Không tồn tại bảng/định nghĩa form metadata động dùng để render form runtime (CCCLXXI, CCCLXXII). `[orchestration-events-reports]`
176. Bản Consent/clinical template đã được sử dụng (đã ký/đã áp dụng) là immutable; bản ghi sử dụng luôn trỏ tới đúng templateVersion tại thời điểm đó (CCCLXXIII). `[orchestration-events-reports]`
177. Founder/Ecosystem summary không trả về PHI chi tiết và không cấp quyền đọc dữ liệu lâm sàng chi tiết của Company nếu thiếu CompanyMembership tường minh (CCCLXXVIII). `[orchestration-events-reports]`
178. Company manager summary mặc định không chứa clinical note chi tiết; chỉ trả về khi có permission lâm sàng tường minh (CCCLXXIX). `[orchestration-events-reports]`
179. Không có bất kỳ điều kiện hard-code theo tên role (vd `role === 'DOCTOR'`) trong nav, layout, page hay API handler — mọi phân nhánh dựa trên permission đã resolve (CCCLXXXIV). `[orchestration-events-reports]`
180. Migration legacy role không tạo global role/enum role trên User; mọi quyền phải đến từ CompanyMembership + Position + permission pack trên đúng Company (CCCLXXXV). `[orchestration-events-reports]`
181. TELESALE không bao giờ được cấp permission dữ liệu lâm sàng theo mặc định (CCCLXXXVII). `[orchestration-events-reports]`
182. Permission quản lý (Company/Unit) không tự động bao hàm permission đọc dữ liệu lâm sàng (CCCLXXXIX). `[orchestration-events-reports]`
183. Legacy ADMIN không bao giờ tự động trở thành Founder/Ecosystem-tier trong migration (CCCXC). `[orchestration-events-reports]`
184. SHAREHOLDER không mang bất kỳ permission Healthcare nào (CCCXCI). `[orchestration-events-reports]`
185. COLLABORATOR không mặc định có CompanyMembership nội bộ hay permission lâm sàng (CCCXCII). `[orchestration-events-reports]`
186. CCCXCVI/CDLX.6 — Khong ro ri PHI qua bien Company; moi truy van healthcare phai scope theo companyId va co security test cross-company. `[roles-tail]`
187. CCCXCVII/CDLXIII — Ban ghi lam sang da finalize khong bi sua/xoa ngam; moi thay doi lich su phai traceable qua audit. `[roles-tail]`
188. CDLX.2 — Final clinical records phai truy vet duoc (traceable). `[roles-tail]`
189. CCCXCIX — Kien truc migration anh lam sang khong duoc lam mat file. `[roles-tail]`
190. CD — Draft tu van dai khong bien mat trong luong save binh thuong. `[roles-tail]`
191. CDLX.3/CDLXII#8/CDVI/CDXLVII — Clinical photo la private: khong ton tai duong download truc tiep bo qua kiem tra quyen; phai co file security test. `[roles-tail]`
192. CDLX.4 — PHI khong duoc ghi vao log. `[roles-tail]`
193. CDLX.5 — Tan cong bang ID truc tiep (IDOR) phai bi tu choi. `[roles-tail]`
194. CDLX.7/CDXLVI — Bien gioi permission duoc giu; khong leo thang quyen. `[roles-tail]`
195. CDLX.8 — Hanh dong nhay cam phai duoc audit. `[roles-tail]`
196. CDLX.9/CDLXIII — Tru vat tu thu thuat phai idempotent (khong double deduction). `[roles-tail]`
197. CDLX.10/CDLXII#15 — AI khong duoc tu chan doan hay finalize clinical record; khong vuot qua tham quyen lam sang cua con nguoi. `[roles-tail]`
198. CDLXII#7/CDXXXV — MedicalCase (va toan bo entity healthcare) thuoc so huu COMPANY, ownership tuong minh. `[roles-tail]`
199. CDLXII#10 — Doctor khong con la global User role. `[roles-tail]`
200. CDLXII#11 — Reception khong duoc doc toan bo clinical note chi vi ten role. `[roles-tail]`
201. CDLIII/CDLXII#12 — Core khong phu thuoc MedicalCase; Healthcare khong tro thanh Product Core. `[roles-tail]`
202. CDLII/CDXV/CDLXII#13 — Company thong thuong dung duoc app ma khong thay/khong can biet Healthcare; CRM/Sales/Finance van chay khi khong bat Healthcare. `[roles-tail]`
203. CDXX — Khong ton tai model trung lap Core: ClinicCustomer, MedicalAppointment, ClinicPayment, ClinicPayroll, ClinicInventory, ClinicTask. `[roles-tail]`
204. CDXIX/CDL — Migration tu fresh DB phai PASS. `[roles-tail]`
205. CDLI — Regression Phan 3-6 phai PASS sau khi them Healthcare. `[roles-tail]`
206. CDLIV/CDLV — List/timeline khong load toan bo anh/blob; list page chi dung thumbnail + metadata. `[roles-tail]`
207. CDXLIII — typecheck + lint + build PASS. `[roles-tail]`
208. CDLXIII — Quan he patient-case phai dung (khong gan sai case cho benh nhan). `[roles-tail]`
209. CDII — Capability chi tinh la DONE khi clinician cham toi duoc qua UI (backend-only khong tinh). `[roles-tail]`

## Quyết định cần ADR riêng (spec cố ý để mở)

1. VIII: Chốt tên model thật cho từng Healthcare-specific entity dựa trên source legacy (MedicalCase, CaseRecord, ClinicalConsultation, ClinicalScreening, DoctorIndication, Procedure, Consent, ClinicalPhoto, MedicalFollowUp, HealthcareMaterialUsage, ClinicalNote, ProcedureOutcome, ComplicationFollowUp) — spec chỉ nêu ví dụ, tên phải truy vết được về legacy. `[case-appointment]`
2. VIII: Quyết định model nào biểu diễn Diagnosis / Treatment episode (tách model riêng hay là thuộc tính/bản ghi con của MedicalCase) — spec chỉ nói 'Diagnosis-related record'. `[case-appointment]`
3. IX: Quyết định có tách Aesthetics thành package riêng hay giữ chung trong Healthcare/Aesthetics Vertical — spec nói 'không nhất thiết tạo separate package ngay'. `[case-appointment]`
4. X: Xác định tiêu chí 'Customer Core đã đủ' — điều kiện nào mới cho phép cân nhắc mở rộng ngoài Customer Core. `[case-appointment]`
5. XI: Định nghĩa điều kiện nghiệp vụ tường minh khi nào một Customer sinh HealthcareProfile / MedicalCase. `[case-appointment]`
6. XII: Chọn hướng hiện thực khái niệm Patient — (a) HealthcareProfile liên kết Customer, hay (b) Customer + healthcare role/context (spec dùng từ 'cân nhắc'). `[case-appointment]`
7. XIII: Quyết định có tạo HealthcareProfile hay không (chỉ tạo khi có use case thật) và chốt tập basicMedicalMetadata cụ thể + có dùng medicalIdentifier hay không. `[case-appointment]`
8. XIII: Chốt ranh giới dữ liệu 'ổn định xuyên Case' thuộc profile vs dữ liệu lịch sử thuộc MedicalCase. `[case-appointment]`
9. XV: Quyết định customerId của MedicalCase là bắt buộc hay optional ('bắt buộc nếu business phù hợp'). `[case-appointment]`
10. XVI: Chốt danh sách field cuối cùng của MedicalCase (code, caseType, primaryClinicianUserId, organizationUnitId là optional trong spec) sau khi đối chiếu legacy, thay vì copy schema legacy. `[case-appointment]`
11. XVII: Chốt tập giá trị enum status cuối cùng — dùng tập tối giản 5 giá trị hay theo source legacy thực tế. `[case-appointment]`
12. XVIII: Chốt tập giá trị enum caseType cuối cùng dựa trên legacy, và có giữ giá trị OTHER hay không. `[case-appointment]`
13. XIX: Quyết định Company nào/nghiệp vụ nào cần mã hồ sơ (code) và cơ chế sinh mã. `[case-appointment]`
14. XX: Chốt luồng 'Appointment mở Case mới' vs 'Appointment liên kết Case có sẵn' — ai kích hoạt, ở bước nào. `[case-appointment]`
15. XXI/XXII: Quyết định có cần HealthcareAppointmentContext hay không, và tập field healthcare-specific cuối cùng (appointmentPurpose, specialty, clinicalStatus đều optional trong spec). `[case-appointment]`
16. XXIII: Chốt cách biểu diễn vai trò bác sĩ qua Assignment/Position của Organization (dùng cơ chế nào đã có ở Phần 3-6). `[case-appointment]`
17. XXIV: Chốt nơi lưu vai trò chuyên môn (DOCTOR, NURSE...) nếu không phải global User Role — Organization Position, Assignment, hay healthcare context. `[case-appointment]`
18. XXV: Co tao HealthcareProfessionalProfile hay khong ('Neu can') va tap field chinh xac (specialty / professional title / license metadata / clinical identifiers) — can ADR quyet dinh scope va quan he voi User/CompanyMembership. `[consultation-procedure]`
19. XXV/XXIV(tail): Cach ghep Position + Healthcare permission pack + professional metadata thanh mo hinh nhan su y te — chua chot, can ADR. `[consultation-procedure]`
20. XXVI: Co luu license information (so chung chi, pham vi hanh nghe, ngay hieu luc) trong Phase 7 hay defer — 'neu san pham can'. `[consultation-procedure]`
21. XXVII: Chot ten canonical: ClinicalConsultation hay Consultation. `[consultation-procedure]`
22. XXVIII: Chot chi tiet schema ClinicalConsultation (kieu du lieu, truong bat buoc, truong bo sung) — spec noi 'chi tiet dua legacy', can khao co ZenithTasks truoc. `[consultation-procedure]`
23. XXIX: Chot correction/addendum policy cu the: ai duoc sua, trong bao lau, sua gi thi phai tao addendum. `[consultation-procedure]`
24. XXX: Muc do 'finalized/signed' duoc dinh nghia the nao khi chua co digital signature system. `[consultation-procedure]`
25. XXXI: Co dua trang thai DRAFT/FINAL vao hay khong ('neu legacy co nhu cau') va dinh nghia 'controlled edit' cu the. `[consultation-procedure]`
26. XXXII: Screening co phai entity rieng khong — phai khao co legacy roi moi quyet dinh salvage hay bo. `[consultation-procedure]`
27. XXXIII: Co model ClinicalIndication rieng hay khong ('neu legacy co Doctor indication') va lien ket toi procedure hay service. `[consultation-procedure]`
28. XXXIV: Co luu diagnosis code khong, va neu co thi dung bang ma nao (khong xay ICD day du) — can ADR. `[consultation-procedure]`
29. XXXVII: Cac truong optional cua Procedure (catalogItemId, procedureType, primaryClinicianUserId, organizationUnitId, scheduledAt, performedAt, clinicalNotes) — truong nao thuc su optional, truong nao bat buoc theo procedure type. `[consultation-procedure]`
30. XXXVIII: Chot tap gia tri ProcedureStatus cuoi cung dua tren legacy (PLANNED/READY/IN_PROGRESS/COMPLETED/CANCELLED chi la de xuat). `[consultation-procedure]`
31. XXXIX: Thiet ke co che policy preconditions theo procedure type (cau hinh o dau: HealthcareServiceDefinition hay bang policy rieng). `[consultation-procedure]`
32. XL: Xac nhan CatalogItem Phan 5 co that su chua service y te khong; neu khong thi giai phap thay the. `[consultation-procedure]`
33. XLI: Co tao HealthcareServiceDefinition hay khong ('neu can') va tap metadata toi thieu. `[consultation-procedure]`
34. XLIII/XLIV: Định nghĩa tập giá trị enum cho ConsentRecord.consentType — spec chỉ nêu tên field, không liệt kê giá trị. `[consent-photo-file]`
35. XLIII: Định nghĩa tập giá trị enum cho ConsentRecord.status (vd DRAFT/PENDING/SIGNED/REVOKED/EXPIRED) — spec để mở. `[consent-photo-file]`
36. XLIV: Quyết định cách biểu diễn version — string tự do, số tăng dần, hay FK tới một ConsentTemplateVersion kèm snapshot nội dung đã ký; và cơ chế nào đảm bảo template update không mutate lịch sử (snapshot content vs immutable version row). `[consent-photo-file]`
37. XLV: Quyết định CÓ xây ConsentTemplate hay không ('Có thể'), và nếu có thì scope là Company-scoped, Healthcare preset dùng chung, hay cả hai. `[consent-photo-file]`
38. XLV: Định nghĩa ranh giới 'không document builder khổng lồ' — mức tối thiểu chấp nhận được của template (plain text/markdown + placeholder?). `[consent-photo-file]`
39. XLVI: Khảo cổ legacy ZenithTasks để xác định đã có digital signature hay chưa — kết quả khảo cổ quyết định phạm vi implement. `[consent-photo-file]`
40. XLVI: Quyết định mức evidence bắt buộc khi ký (chỉ signedAt + signer, hay bắt buộc file/image evidence) theo requirement nghiệp vụ. `[consent-photo-file]`
41. XLIII: Quyết định signedByCustomer là FK tới Customer hay là tên/định danh người ký dạng text (trường hợp người nhà ký thay). `[consent-photo-file]`
42. XLVII/LIII: Định nghĩa cụ thể các permission key Healthcare cho consent và clinical photo (đọc/tạo/ký/thu hồi/xem ảnh/tải ảnh) và độ mịn của chúng trong permission registry hiện có. `[consent-photo-file]`
43. LIII: Định nghĩa 'case access' là gì — dựa trên assignment bác sĩ/điều dưỡng trên MedicalCase, theo Organization unit, hay theo membership Company là đủ. `[consent-photo-file]`
44. XLIX: Quyết định bodyArea là free text hay taxonomy/enum có kiểm soát. `[consent-photo-file]`
45. LI: Quyết định có tạo ClinicalPhotoSet hay không — phụ thuộc kết quả khảo cổ legacy; nếu filtering đơn giản đủ thì bỏ. `[consent-photo-file]`
46. LIV: Xác nhận storage provider đang dùng có hỗ trợ signed URL không, và chốt TTL cho short-lived URL. `[consent-photo-file]`
47. LVI: Định nghĩa privacy/data-retention policy có kiểm soát cho phép hard delete ảnh lâm sàng (ai được duyệt, điều kiện, thời hạn lưu). `[consent-photo-file]`
48. L: Quyết định enum photoType là enum Prisma cố định hay có cơ chế mở rộng theo vertical Healthcare khác ngoài thẩm mỹ. `[consent-photo-file]`
49. LXVII: Chot ten entity — `HealthcareMaterialUsage` hay `ProcedureMaterialUsage`? (spec dua ca hai; model o LXVIII dung ProcedureMaterialUsage — can ADR chot mot ten duy nhat va pham vi: chi gan Procedure hay gan ca MedicalCase/Appointment) `[followup-material]`
50. LXIV: Chot cach ghi nhan bien chung — entity `ClinicalIncident` rieng vs complication field/event tren ban ghi lam sang; va xac dinh legacy ZenithTasks co requirement nay khong `[followup-material]`
51. LXIII: Quyet dinh co implement follow-up template hay khong — phu thuoc danh gia 'legacy co gia tri'; can ADR ghi ro ket qua kiem tra legacy `[followup-material]`
52. LXII: Dinh nghia cau truc cau hinh lich follow-up theo procedure (schema cua template: danh sach offset ngay/thang, bat buoc hay goi y, ai duoc sua) `[followup-material]`
53. LX: Dinh nghia tap gia tri cua `MedicalFollowUp.status` (spec de mo) va vong doi chuyen trang thai `[followup-material]`
54. LXI: Quyet dinh muc do tu dong — 'system determines follow-up needed' la rule tuong minh, cau hinh theo procedure, hay thao tac thu cong cua clinician; va viec tao WorkItem/Appointment la tu dong hay de xuat cho nguoi dung xac nhan `[followup-material]`
55. LXV: Chot dinh nghia 'red flag' (rule nao, ai dinh nghia) va chot output la `WorkItem` hay `Signal` (hoac ca hai) — spec dung 'could generate' `[followup-material]`
56. LXXI: Thiet ke co che reversal cu the — reversal record doi ung vs cancel-and-rewrite; ai co quyen thuc hien; cua so thoi gian cho phep sua `[followup-material]`
57. LXX: Chot khoa idempotency cho issueStock (source type + source id? hay client-generated idempotency key) va hanh vi khi goi trung: no-op tra ve movement cu vs bao loi `[followup-material]`
58. LXXIII: Chot chieu tham chieu giua thuong mai va lam sang (SaleLine -> Procedure hay Procedure -> SaleLine, optional den muc nao) va dieu kien 'if appropriate' — dong thoi cho phan spec sau dong 1810 (bat dau bang 'But:') truoc khi chot `[followup-material]`
59. LXXIII: Chốt hình dạng liên kết thương mại - lâm sàng: link ở cấp Procedure <-> SaleLine hay MedicalCase <-> Sale (hay cả hai)? Cardinality (1-1, 1-n)? Tiêu chí 'if appropriate' - khi nào hệ thống tự gợi ý/tự nối, khi nào để trống? -> cần ADR. `[finance-access-permission]`
60. LXXIV: Định nghĩa chính xác 'financial history visible contextually' cho clinician: được thấy trạng thái đã/chưa thanh toán mà không thấy số tiền, hay không thấy gì? Permission key nào gate (dùng finance.view sẵn có hay thêm một quyền healthcare-scoped read-only)? -> cần ADR. `[finance-access-permission]`
61. LXXIX: Ranh giới 'clinical detail may be limited' cho Care/CSKH - liệt kê cụ thể field/section nào bị che (chẩn đoán, chỉ định thuốc, ảnh before/after, ghi chú khám) và cơ chế che (deny field vs deny endpoint). -> cần ADR. `[finance-access-permission]`
62. LXXX: Chốt danh sách permission cuối cùng từ 16 key 'candidates' (spec ghi 'Candidates' + 'Keep manageable'): giữ nguyên 16, gộp hay bớt? Tiêu chí định lượng cho 'manageable'? Quan hệ bao hàm (manage có ngụ ý view/upload không, hay phải cấp rời)? `[finance-access-permission]`
63. LXXXI: Thiết kế điểm mở rộng (hook/policy interface) cho clinical credentialing tương lai: đặt ở đâu trong đường thực thi Procedure, ký hiệu interface ra sao, mà vẫn không implement engine ngay bây giờ. `[finance-access-permission]`
64. LXXXII: Định nghĩa 'evidence' để chuyển từ Company+permission sang targeted care-team scope: tiêu chí nào (yêu cầu pháp lý, loại case nhạy cảm, khách VIP)? Áp cho toàn bộ Case hay chỉ một cờ confidential trên từng Case? `[finance-access-permission]`
65. LXXXIII: Có tạo MedicalCaseMember ngay trong Phần 7 hay defer (spec dùng 'Possible' + 'if legacy/use case requires')? Nếu tạo: enum role có đúng 4 giá trị PRIMARY_DOCTOR/NURSE/ASSISTANT/CARE_COORDINATOR không, có unique constraint 1 PRIMARY_DOCTOR mỗi Case không, và membership có ảnh hưởng tới quyền đọc hay chỉ là metadata? `[finance-access-permission]`
66. XC: Kiến trúc Module hiện tại (Phần 3-6) đã hỗ trợ bật/tắt module theo Company chưa? Nếu chưa thì Phần 7 có được xây cơ chế module toggle không, hay tạm coi healthcare luôn bật? Tên module chuẩn ('Healthcare' và 'Aesthetics' là một module hay hai)? -> cần ADR. `[finance-access-permission]`
67. XC/XCI: Co che ky thuat cua Module enablement — luu trang thai bat module o dau (cot tren Company, bang CompanyModule rieng, hay config), va "if Module architecture supports" nghia la kien truc module hien tai co dap ung khong hay phai bo sung truoc. Can ADR. `[module-parity-journey]`
68. XCI: Danh sach permission preset healthcare cu the (ten preset, tap permission trong moi preset, cach map vao permission registry/resolver da co o src/lib/permissions/). `[module-parity-journey]`
69. XCI: Company AI healthcare context bi defer — can quyet dinh moc thoi gian va ranh gioi (AI duoc doc gi trong du lieu lam sang) trong mot ADR sau. `[module-parity-journey]`
70. XCII: Company Type HEALTHCARE "suggest module enabled" o muc do nao — bat mac dinh khi tao Company, chi hien goi y cho admin, hay chi ap dung cho seed. Can chot. `[module-parity-journey]`
71. XCVIII: Bang phan loai nang luc legacy luu o dau va dinh dang nao (docs/legacy/LEGACY_CAPABILITY_MATRIX.md?), ai cap nhat cot Migration Status va khi nao. `[module-parity-journey]`
72. XCVIII: Tieu chi phan dinh "Generic or Healthcare?" — quy tac de quyet dinh mot capability thuoc nen chung Phan 3-6 hay thuoc vertical Healthcare. `[module-parity-journey]`
73. XCIX: Dinh nghia van hanh cua KEEP / ADAPT / REWRITE / MERGE — ranh gioi giua ADAPT va REWRITE, khi nao dung MERGE. `[module-parity-journey]`
74. CI/CII: Tieu chi cham diem de xep P0/P1/P2/P3, va phan loai P0 cuoi cung cho tung capability (spec noi phai dua tren source, chua chot). `[module-parity-journey]`
75. CV: Thu tu stage that cua tung loai dich vu — spec cam gia dinh mot thu tu chung, nen phai xac dinh tu legacy roi chot mo hinh. `[module-parity-journey]`
76. CVII: Tap stage tuong minh cua Clinical Journey (ten stage, stage nao optional theo loai dich vu, cach bieu dien trong schema) ma khong roi vao workflow DSL. Can ADR. `[module-parity-journey]`
77. CVIII/CIX: Tap dieu kien bat buoc day du de tinh procedure readiness (spec bi cat giua chung tai dong 2335) va cach dieu kien nay bien thien theo loai dich vu. `[module-parity-journey]`
78. XCV: Quy uoc danh dau du lieu synthetic (prefix ten, domain email, marker field) de khong the nham voi du lieu that. `[module-parity-journey]`
79. CXII: Chot ma tran actor/permission cho tung high-risk clinical write (final diagnosis, procedure indication, procedure completion, consent state, clinical correction) — spec noi ro 'not necessarily two-person approval' nhung khong chi dinh ai duoc lam gi, can ADR. `[ai-audit-privacy]`
80. CXX: Chon mo hinh sua ban ghi final — luu old/new trace (versioning) hay addendum (chi them ban bo sung, khong sua ban goc), hoac ca hai; spec de mo bang 'old/new trace or addendum'. `[ai-audit-privacy]`
81. CXXII: Thoi han retention thuc te cho tung loai ho so clinical — spec cam bia, yeu cau doi 'verified requirements'; can ADR ghi nhan la open + thiet ke cho co the gan policy sau. `[ai-audit-privacy]`
82. CXXVII: Quyet dinh co lam printable view cho consent/case summary trong Phan 7 hay khong ('if legacy needs') va pham vi den dau — spec noi khong can document engine day du 'unless required'. `[ai-audit-privacy]`
83. CXXX: Dinh nghia quyen healthcare tuong minh nao cho phep search xuyen Company o cap Founder/Ecosystem (ten quyen, cach cap, scope). `[ai-audit-privacy]`
84. CXXXI: Chinh sach truy cap clinical/privacy cho Founder — Founder co duoc doc clinical note khong, qua co che nao, co can audit/justification khong; spec chi noi 'may be separate' va 'unless explicitly required'. `[ai-audit-privacy]`
85. CXXXII: Dinh nghia scope/policy cu the cho phep Ecosystem AI cham vao du lieu clinical (cai gi duoc, dieu kien nao, ai cap). `[ai-audit-privacy]`
86. CXXXVIII: Chon authorization strategy cho file/anh clinical (signed URL co han vs proxy qua server co permission check) — spec chi noi 'without authorization strategy' la khong duoc. `[ai-audit-privacy]`
87. CXIV: Co che danh dau draft/evidence cho AI generated clinical text — spec noi 'Part 8 details', can chot toi thieu phan schema/flag nao lam o Phan 7. `[ai-audit-privacy]`
88. CXXIII: Quy uoc van hanh cho 'access bug = P0' (dinh nghia, quy trinh xu ly, ai owner) — spec chi neu nguyen tac. `[ai-audit-privacy]`
89. CXLII: Policy quyết định ai được tạo MedicalCase — Doctor, Reception, hay cả hai (spec ghi 'depending policy'). Cần ADR chốt ma trận role → quyền tạo case. `[tests]`
90. CXLVI: 'Authorized' cho Consultation create chưa định nghĩa cụ thể — cần chốt tập role/permission nào được tạo Consultation. `[tests]`
91. CXLVII: Định nghĩa 'appropriate clinician' cho finalize Consultation — chỉ clinician đã khám? clinician cùng specialty? supervisor có được finalize thay không? `[tests]`
92. CXLVIII: Cơ chế mutate consultation sau finalize — chọn 'controlled edit' (sửa có kiểm soát + audit) hay 'addendum only' (chỉ nối thêm bản ghi mới), hay cả hai theo loại trường. `[tests]`
93. CXLIX: Policy Reception có được sửa clinical note của Consultation hay không (spec chỉ nói 'if policy says no'). `[tests]`
94. CL: Cần định nghĩa tường minh tập clinical action mà Nurse được phép thực hiện. `[tests]`
95. CLV: Danh sách điều kiện 'readiness' bắt buộc trước khi perform Procedure chưa được liệt kê. `[tests]`
96. CLVI: Quy tắc xác định procedure nào 'requires consent' — cấu hình theo procedure type hay theo policy company. `[tests]`
97. CLVII: Policy nào yêu cầu screening trước procedure, và screening gồm những gì. `[tests]`
98. CLIX: Chọn semantics cho complete Procedure lần 2: idempotent (trả về thành công không side-effect) hay fail-safe (từ chối) — spec để mở cả hai. `[tests]`
99. CLX: Cơ chế reopen MedicalCase (ai được reopen, điều kiện, audit) chưa định nghĩa. `[tests]`
100. CLXVII: Định nghĩa 'controlled' cho delete/void photo — soft delete + reason + audit? ai được phép? có giữ file gốc không. `[tests]`
101. CLXXIII: Xác định chính xác Inventory policy nào áp dụng khi thiếu tồn (block, cho phép backorder, cảnh báo...) — phải trỏ về policy đã có ở Phần 3-6 chứ không tự định nghĩa. `[tests]`
102. CLXXVII: Chính sách emergency read khi company suspended — có hay không, ai được, điều kiện và audit ra sao (spec yêu cầu 'explicit' nhưng chưa định nghĩa). `[tests]`
103. CLXXVIII: 'Founder/admin rules' cho read-only trên archived company cần được viết rõ (ai đọc được gì). `[tests]`
104. CLXXIX/CLXXX/CLXXXI: Cơ chế vô hiệu hóa quyền tức thời với session đang mở (revalidate mỗi request vs invalidate session vs TTL cache ngắn) — cần ADR vì ảnh hưởng toàn hệ authorization. `[tests]`
105. CLXXV: Cách link Sale ↔ Procedure (bắt buộc hay tùy chọn, 1-1 hay 1-n) chưa được định nghĩa rõ. `[tests]`
106. CXCI: Quyết định có tồn tại view lịch chuyên biệt cho healthcare hay không — spec chỉ cho phép 'unless legacy workflow truly requires'; cần ADR chứng minh workflow legacy nào bắt buộc, nếu không thì dùng lại Appointment list. `[ux-integration-migration]`
107. CXCVI: Định nghĩa công thức deterministic cụ thể cho 5 signal (ngưỡng overdue bao nhiêu ngày, thế nào là 'material low', thế nào là 'clinical record incomplete') và contract expose cho Phần 8. `[ux-integration-migration]`
108. CXCVIII: Bố cục/nội dung cuối cùng của Company Home healthcare — spec nói Part 9 final UX. `[ux-integration-migration]`
109. CXCIX: Cấu trúc navigation cuối cùng: giữ 6 mục phẳng hay gom Healthcare dưới nhóm 'Chuyên môn'; nav budget cho phép bao nhiêu mục — Part 9 quyết. `[ux-integration-migration]`
110. CCIV: Danh sách field nào là 'safety-critical' (không được ẩn sau progressive disclosure) cho từng form lâm sàng. `[ux-integration-migration]`
111. CCV: Có triển khai autosave hay không ('could be useful'); nếu có thì chu kỳ, phạm vi entity nào, cơ chế chống finalize ngoài ý muốn. `[ux-integration-migration]`
112. CCVI: Định nghĩa tập required field lâm sàng 'dựa trên workflow thực tế' — phải chốt từ khảo sát legacy, không tự đặt. `[ux-integration-migration]`
113. CCIX: Có chuyển các field y khoa boolean sang tri-state YES/NO/UNKNOWN hay không ('consider') — ảnh hưởng schema Prisma, cần ADR. `[ux-integration-migration]`
114. CCXI: Có cần bảng timeline trung tâm hay giữ hoàn toàn derived ('unless required') — quyết định theo yêu cầu hiệu năng. `[ux-integration-migration]`
115. CCXIV: Chốt danh sách metadata cần strip khỏi ảnh (EXIF nào giữ, cái nào xóa) và thời điểm strip (khi upload hay khi serve) — spec chỉ nói 'where appropriate'. `[ux-integration-migration]`
116. CCXVI: Có bật malware scanning hay không, phụ thuộc hạ tầng file hiện có; nếu không, ghi vào backlog security tương lai. `[ux-integration-migration]`
117. CCXVIII: Chọn cơ chế mã hóa cụ thể của nền tảng/DB/storage (at-rest, in-transit, column-level?) trong khuôn khổ 'best practice sẵn có'. `[ux-integration-migration]`
118. CCXXVIII: Phương án đối soát material usage lịch sử với tồn kho hiện tại khi không dựng lại được movement history. `[ux-integration-migration]`
119. CCXXXII: Xác nhận/điều chỉnh thứ tự phụ thuộc migration — spec ghi 'Likely', Phần 10 verify. `[ux-integration-migration]`
120. CCXXXV/CCXXXVI/CCXXXVII: Phạm vi áp dụng checksum nội dung, checksum file, và có làm record hash hay không (optional) — cần chốt để tránh over-engineering. `[ux-integration-migration]`
121. CCL — Co dung co che 'case team member' de gioi han truy cap trong pham vi mot MedicalCase hay khong? Neu co, dinh nghia model + luat revoke; neu khong, quyen chi dua vao permission cap Company. `[parity-commands-constraints]`
122. CCLIV — Co dung caching cho du lieu healthcare khong? Neu co, chot chien luoc cache key (bat buoc chua companyId + actor scope) va co che invalidation. `[parity-commands-constraints]`
123. CCLVI — 'Nen tang AI' da ton tai o thoi diem Phan 7 chua? Quyet dinh co viet test helper AI tool injection ngay bay gio hay defer sang Phan 8. `[parity-commands-constraints]`
124. CCLXVII — Danh sach muc trong procedure readiness checklist ap dung cho loai procedure nao ('if relevant'): can dinh nghia rule mapping loai thu thuat -> cac muc bat buoc (ho so / sang loc / dong y / vat tu). `[parity-commands-constraints]`
125. CCLXXII — Safety checklist lam sang co duoc trien khai o Phan 7 khong, va cau truc domain-specific cua no la gi (checklist template theo loai thu thuat?). `[parity-commands-constraints]`
126. CCLXXIX — Nguong 'Photos if large' de bat phan trang anh: chot page size va dieu kien. `[parity-commands-constraints]`
127. CCLXXX — Danh sach index la 'likely', phai doi chieu schema thuc te sau khi chot model de bo/them index cho dung ten bang/cot. `[parity-commands-constraints]`
128. CCLXXXVI — Customer merge keo theo MedicalCase: defer khoi Phan 7 hay lam? Neu lam, chot chien luoc migrate quan he atomic (rui ro cao). `[parity-commands-constraints]`
129. CCLXXXVII — Legacy ZenithTasks co thuc su can Case merge khong? Ket luan tu doi chieu legacy truoc khi quyet dinh khong implement. `[parity-commands-constraints]`
130. CCLXXXVIII — Case reopen vs tao Case moi khi benh nhan quay lai sau khi case da dong: chot ngu nghia, viet ADR neu material. `[parity-commands-constraints]`
131. CCXC — Chuyen khoa (specialty) luu o dau (truong tren Case hay Procedure) va co can enum/danh muc khong; xac nhan khong xay hierarchy. `[parity-commands-constraints]`
132. CCXCI — Case/Procedure tham chieu don vi to chuc nao (department hay branch hay ca hai) va truong nay optional hay bat buoc. `[parity-commands-constraints]`
133. CCXCIV — Dieu kien nao trong tuong lai cho phep du lieu lam sang gan vao Project (use case nghien cuu) — can quyet dinh tuong minh rieng. `[parity-commands-constraints]`
134. CCXCIX — Nhung 'high-risk business action' nao trong healthcare duoc noi vao Approval engine cua core: can liet ke tuong minh. `[parity-commands-constraints]`
135. CCCI: Xac dinh ha tang notification da ton tai tu Phan 3-6 hay chua, va Healthcare duoc phep noi vao kenh nao — neu chua co thi bo qua muc nay hay dung them (ADR). `[deferred-aesthetics-traceability]`
136. CCCII: Dieu kien va thoi diem tich hop SMS/Zalo — spec noi 'defer unless already architecture stable', can dinh nghia tieu chi 'architecture stable' truoc khi mo lai. `[deferred-aesthetics-traceability]`
137. CCCIII: Quyet dinh Phan 7 co can printable consent hay khong ('if needed'), va co che versioning noi dung consent. `[deferred-aesthetics-traceability]`
138. CCCVII/CCCVIII/CCCIX: Sau archaeology, quyet dinh phan loai va scope cho Lab / Imaging / Pharmacy (module rieng, submodule tuong lai, hay loai bo). `[deferred-aesthetics-traceability]`
139. CCCX: Inpatient management co in-scope hay khong — phu thuoc ket qua archaeology legacy. `[deferred-aesthetics-traceability]`
140. CCCXII: Insurance claims co lam hay khong — chi khi chung minh duoc legacy da co. `[deferred-aesthetics-traceability]`
141. CCCXIV: EMR certification co tro thanh explicit requirement cua Phase 7 hay khong. `[deferred-aesthetics-traceability]`
142. CCCXV: Medication workflow co du 'meaningful' trong legacy de implement khong — can ket luan tu archaeology. `[deferred-aesthetics-traceability]`
143. CCCXVI: Vital signs neu co thi dat o dau — thuoc Consultation hay thuoc Screening. `[deferred-aesthetics-traceability]`
144. CCCXVII: Mo hinh hoa allergy status (enum unknown / no-known-allergy / has-allergy) va cach migrate du lieu legacy dang boolean. `[deferred-aesthetics-traceability]`
145. CCCXXI: Muc dau tu va thu tu uu tien cho photo comparison UI (chi lam sau khi dat parity). `[deferred-aesthetics-traceability]`
146. CCCXXIV: Co can consent type cho anh hay khong, va nguon noi dung phap ly (business/legal cung cap, khong tu soan). `[deferred-aesthetics-traceability]`
147. CCCXXX/CCCXXXI: Xac nhan lot/batch/expiry co that su can hay khong, va scope cua InventoryLot (chi lotNumber+expiryDate hay them truong khac). `[deferred-aesthetics-traceability]`
148. CCCXXXV: Serial number / device tracking co ton tai trong legacy khong va classify vao dau (Inventory extension). `[deferred-aesthetics-traceability]`
149. CCCXXXVI: Xac nhan implant traceability co 'medically important' de giu P0 hay khong. `[deferred-aesthetics-traceability]`
150. CCCXXXVII: Định nghĩa 'mature' của một feature legacy (ngưỡng nào để coi surgeon workflow / nurse checklist / pre-op / post-op / material lot / clinical photo / case accounting links là đủ trưởng thành để map) — spec để mở. `[legacy-rules-agents-arch]`
151. CCCXXXIX: Legacy có 3 customer view — quyết định cụ thể job nào giữ, màn hình target hợp nhất ra sao (spec chỉ nêu nguyên tắc 'preserve jobs, not all screens', không nêu thiết kế). `[legacy-rules-agents-arch]`
152. CCCXL: Tiêu chí đo 'no real usage / test / business value' để được RETIRE — cần định nghĩa đo được (số liệu usage nào, ai xác nhận business value) và nơi document quyết định retire. `[legacy-rules-agents-arch]`
153. CCCXLII: Quy trình phân biệt workaround kỹ thuật với business rule thật, và ai là người ra phán quyết cuối khi không rõ. `[legacy-rules-agents-arch]`
154. CCCXLIV: Quy tắc phân xử khi source legacy mâu thuẫn test legacy — chọn hành vi source hiện tại hay business intent, và nơi record kết luận. `[legacy-rules-agents-arch]`
155. CCCXLVI: Điều kiện thế nào là 'explicitly authorized and safely provisioned' để được phép chạm dữ liệu production (ai cấp phép, cơ chế provisioning) — spec không định nghĩa. `[legacy-rules-agents-arch]`
156. CCCXLVIII: Có thực sự tạo LegacyClinicReader / TargetHealthcareImporter hay không ('if useful') — cần ADR quyết định làm hay bỏ, và hợp đồng interface. `[legacy-rules-agents-arch]`
157. CCCXLIX: Vị trí vật lý cụ thể của code migration tách khỏi runtime (thư mục/package/workspace nào) và cơ chế enforce việc runtime không import nó. `[legacy-rules-agents-arch]`
158. CCCL: Phạm vi kịch bản của healthcare test data generator ('rich synthetic scenarios' gồm những gì) và công nghệ dùng để sinh. `[legacy-rules-agents-arch]`
159. CCCLIII: Ai đóng vai 'dedicated reviewer' cho clinical access red team và red team chạy ở giai đoạn nào của quy trình (gate nào). `[legacy-rules-agents-arch]`
160. CCCLV: Bộ personas dùng cho UX review (bác sĩ, điều dưỡng, lễ tân, kế toán...?) chưa được liệt kê trong dải spec này. `[legacy-rules-agents-arch]`
161. CCCLVI: Danh sách 'critical flows' lâm sàng cần so sánh với UX legacy, và cách đo 'equal/better' (tiêu chí chấp nhận). `[legacy-rules-agents-arch]`
162. CCCLXIX: Chốt có dùng 'application events' hay không, và nếu có thì cơ chế nào (in-process domain event sau transaction, outbox table, hay chỉ gọi service trực tiếp) — spec chỉ nói 'if useful'. `[orchestration-events-reports]`
163. CCCLXXI: Định nghĩa 'actual product needs' — tiêu chí nào cho phép mở lại hướng form builder tổng quát trong tương lai. `[orchestration-events-reports]`
164. CCCLXXIII: Chốt chính xác danh sách template được versioning (Consent gồm những loại nào, 'clinical template' gồm những gì) và ranh giới template nào KHÔNG versioning. `[orchestration-events-reports]`
165. CCCLXXIV: Chốt tiêu chí 'meaningfully needed' và danh sách clinical document được bật versioning; document còn lại chỉ audit trail. `[orchestration-events-reports]`
166. CCCLXXV: Định nghĩa cụ thể metric của 3 báo cáo: 'cases opened' tính theo trường thời gian nào, 'procedures today' theo lịch hay theo thực hiện, 'overdue' tính từ mốc nào. `[orchestration-events-reports]`
167. CCCLXXVIII: Định nghĩa 'unnecessary PHI' cho Founder summary — danh sách field được phép/bị cấm hiển thị ở tầng Ecosystem. `[orchestration-events-reports]`
168. CCCLXXIX: Chốt permission nào cho phép manager vượt mặc định để xem clinical note chi tiết ('not by default' nghĩa là có đường mở). `[orchestration-events-reports]`
169. CCCLXXXIV: Chốt cơ chế Position/preset đóng góp permission (preset là tập permission tĩnh hay có kế thừa/override) và cách resolve xung đột với permission cấp trực tiếp. `[orchestration-events-reports]`
170. CCCLXXXV: Chốt bảng ánh xạ chi tiết 6 legacy role → (Position, permission pack) và chiến lược migration dữ liệu người dùng cũ. `[orchestration-events-reports]`
171. CCCLXXXVI: Assess source dữ liệu legacy để quyết định CONSULTANT thuộc nhánh Sales hay Healthcare (spec để mở). `[orchestration-events-reports]`
172. CCCLXXXVIII: Viết policy tường minh cho 'limited healthcare context' của CARE — chính xác permission nào được cấp. `[orchestration-events-reports]`
173. CCCXC: Quy trình xử lý user ADMIN legacy khi migrate: map thành gì, ai duyệt việc nâng lên Ecosystem-tier (nếu có). `[orchestration-events-reports]`
174. CCCXCII: Chốt mô hình COLLABORATOR — external party, referral partner, hay cả hai — và permission (nếu có) đi kèm. `[orchestration-events-reports]`
175. CCCLXXXVI — Role CONSULTANT thuoc Sales hay Healthcare? Spec yeu cau 'assess source' truoc khi map; can ADR/quyet dinh mapping va permission pack tuong ung. `[roles-tail]`
176. CCCLXXXVIII — Chinh sach 'explicit' cho role CARE: chinh xac phan healthcare context nao CARE duoc doc (follow-up? note?) va den muc do nao. `[roles-tail]`
177. CCCXC — Legacy ADMIN map sang role nao trong he thong moi (khong duoc tu dong thanh Founder); can quyet dinh tuong minh. `[roles-tail]`
178. CCCXCII — Mo hinh hoa COLLABORATOR nhu quan he external/referral: dung entity/quan he nao cua Core, khong ep vao clinical role. `[roles-tail]`
179. CCCXCVIII — Quyet dinh material traceability co phai P0 khong (spec: 'if legacy/business requires'); can ket luan tu legacy archaeology. `[roles-tail]`
180. CD — Chon giai phap chong mat du lieu form tu van dai: autosave hay explicit save UX (spec cho phep ca hai). `[roles-tail]`
181. CDIII/CDIV — Quyet dinh pham vi ho tro mobile/tablet: form lam sang nao bat buoc dung duoc tren tablet, cai nao chap nhan desktop-only ('no need perfect phone EMR if impractical'). `[roles-tail]`
182. CDXVI — Chinh sach disable module Healthcare khi da co du lieu that (chan thao tac moi vs giu read/admin access); spec de mo va day chi tiet sang Part 9. `[roles-tail]`
183. CDXX — Neu tim thay ClinicCustomer / MedicalAppointment / ClinicPayment / ClinicPayroll / ClinicInventory / ClinicTask: quyet dinh justify hay remove tung cai. `[roles-tail]`
184. CDXXIII — Co tao docs/verticals/HEALTHCARE_DOMAIN_MODEL.md khong ('if helpful'). `[roles-tail]`
185. CDXXIV — Tao file docs/legacy/CLINIC_PARITY_MATRIX.md rieng hay tich hop vao master capability matrix. `[roles-tail]`
186. CDXXV — Co tao docs/security/HEALTHCARE_DATA_SECURITY.md khong ('if useful'). `[roles-tail]`
187. CDXXIX — Cap nhat ADR 'Healthcare as vertical' (da co tu Phase 2) theo implementation thuc te. `[roles-tail]`
188. CDXXX — ADR Patient model: HealthcareProfile co phai quyet dinh material khong, va hinh dang model ra sao. `[roles-tail]`
189. CDXXXI — ADR Case model cho MedicalCase ('if needed'). `[roles-tail]`
190. CDXXXII — ADR Clinical record finalization: dinh nghia chinh sach finalize (khoa gi, ai duoc sua, amendment ra sao) — spec danh dau Important. `[roles-tail]`
191. CDXXXIII — ADR Photos: chon mo hinh luu tru + bao mat file cho ClinicalPhoto. `[roles-tail]`
192. CDXXXIV — ADR Material usage: cach tich hop ProcedureMaterialUsage voi Inventory/StockMovement. `[roles-tail]`
193. CDXLII — Chot naming convention cu the cho 5 nhom test suite (spec chi noi 'naming project convention'). `[roles-tail]`
194. CDLXII#2 — Neu chung minh duoc 'unavoidable', quyet dinh co lam Appointment engine rieng cho Healthcare khong; mac dinh la NO. `[roles-tail]`

## Cấm tường minh / defer sang Phần sau

- VI: Cấm migrate bất kỳ model/feature legacy nào chưa có classification. `[case-appointment]`
- VII: Cấm tạo lại trong Healthcare các capability generic đã có ở Core Phần 3-6 (User, Customer, Appointment, Task/PlanTask, Payment, CashTransaction, Sale, Payroll, Attendance, Inventory, Organization, Audit, Approval, AI execution, Files, Notifications). `[case-appointment]`
- VIII: Cấm tự đặt tên model Healthcare không dựa trên source legacy. `[case-appointment]`
- X: Cấm tuyệt đối tạo HealthcareCustomer, ClinicCustomer, PatientCustomer khi Customer Core đã đủ. `[case-appointment]`
- XI: Cấm biến mọi Customer thành MedicalCase một cách tự động. `[case-appointment]`
- XII: Cấm duplicate identity (tạo thực thể danh tính bệnh nhân song song với Customer/User). `[case-appointment]`
- XIII: Cấm nhét toàn bộ history vào HealthcareProfile; cấm tạo HealthcareProfile khi chưa có use case thật. `[case-appointment]`
- XIV: Cấm dùng MedicalCase như Customer. `[case-appointment]`
- XV: Cấm chỉ dựa vào customerId để suy ra Company của MedicalCase. `[case-appointment]`
- XVI: Cấm copy schema legacy mù quáng vào MedicalCase. `[case-appointment]`
- XVII: Cấm tạo ~30 trạng thái Case trừ khi nghiệp vụ bắt buộc. `[case-appointment]`
- XVIII: Cấm over-enum caseType. `[case-appointment]`
- XXI: Cấm tạo MedicalAppointment / engine lịch thứ hai khi Appointment Core đã hỗ trợ. `[case-appointment]`
- XXII: Cấm đưa field không phải healthcare-specific vào HealthcareAppointmentContext. `[case-appointment]`
- XXIII: Cấm lưu bác sĩ bằng text tự do (MedicalCase.doctorText = "BS A") khi đã có User identity; cấm relation không Company-valid. `[case-appointment]`
- XXIV: Cấm đưa vai trò chuyên môn DOCTOR, NURSE... trở lại thành global User Role. `[case-appointment]`
- IX: Chưa tạo separate package riêng cho Aesthetics ở bước này (defer) — giữ trong Healthcare/Aesthetics Vertical. `[case-appointment]`
- Khong dat healthcare professional metadata (specialty, title, license, clinical identifiers) tren User core (XXV). `[consultation-procedure]`
- Khong build credential verification platform trong Phase 7 — chi luu du lieu license, khong xac minh (XXVI). `[consultation-procedure]`
- Khong xay digital signature system phuc tap khi he thong chua co (XXX). `[consultation-procedure]`
- Khong generic hoa Screening thanh arbitrary form / form builder khi cau truc chuyen mon da ro (XXXII). `[consultation-procedure]`
- Khong tu xay he thong ma ICD hoan chinh tru khi legacy/use case yeu cau ro (XXXIV). `[consultation-procedure]`
- Khong dong nhat Sale voi Procedure — khong dung mot model cho ca hai (XXXV, XXXVI). `[consultation-procedure]`
- Khong hard-code moi procedure theo kich ban phau thuat (XXXIX). `[consultation-procedure]`
- Khong tao separate price catalog cho healthcare khi CatalogItem Phan 5 da du (XL). `[consultation-procedure]`
- Khong build universal clinical protocol engine (XLI). `[consultation-procedure]`
- Khong coi consent chi la checkbox trong MedicalCase (XLII). `[consultation-procedure]`
- Khong bia them trang thai/truong ngoai legacy: chi tiet Consultation (XXVIII) va tap ProcedureStatus (XXXVIII) phai dua tren khao co legacy. `[consultation-procedure]`
- XLII: Cấm biểu diễn consent bằng checkbox/boolean trên MedicalCase. `[consent-photo-file]`
- XLIV: Cấm để việc cập nhật consent template làm thay đổi lịch sử consent đã ký. `[consent-photo-file]`
- XLV: Cấm xây document builder khổng lồ cho consent template. `[consent-photo-file]`
- XLVI: Cấm tự xây PKI / digital signature platform khi legacy chưa có sẵn. `[consent-photo-file]`
- XLVII: Cấm mọi truy cập consent cross-company. `[consent-photo-file]`
- XLVIII: Cấm dùng generic attachment thay cho model ClinicalPhoto first-class. `[consent-photo-file]`
- L: Cấm hard-code photoType chỉ theo nhu cầu thẩm mỹ (before/after) khi Healthcare vertical rộng hơn. `[consent-photo-file]`
- LI: Cấm tạo ClinicalPhotoSet nếu legacy không có và simple filtering đã đủ. `[consent-photo-file]`
- LII: Cấm xây storage layer mới — phải reuse File Storage abstraction; cấm lưu binary trong DB record. `[consent-photo-file]`
- LIII: Cấm dùng URL khó đoán (unguessable URL) làm cơ chế bảo mật cho file ảnh lâm sàng. `[consent-photo-file]`
- LIV: Cấm public clinical photo URLs. `[consent-photo-file]`
- LV: Cấm log URL/token nhạy cảm của ảnh lâm sàng. `[consent-photo-file]`
- LVI: Cấm hard delete ảnh lâm sàng ngoài phạm vi một privacy/data-retention policy có kiểm soát. `[consent-photo-file]`
- LVII: Cấm trộn customer profile photo với clinical photo. `[consent-photo-file]`
- Tao `ClinicMaterialStock` hoac bat ky engine ton kho rieng nao cho healthcare (LXVI) `[followup-material]`
- Sua truc tiep truong so luong ton kho — 'No direct stock field edit' (LXIX) `[followup-material]`
- Tru kho hai lan cho cung mot material usage (LXX) `[followup-material]`
- Duplicate task engine — khong lam co che giao viec rieng cho follow-up, phai dung Work module (LXI) `[followup-material]`
- Hard-code lich follow-up (Day 1/3/7/Month 1) o tang toan product (LXII) `[followup-material]`
- Xay universal workflow builder cho follow-up template (LXIII) `[followup-material]`
- Implement follow-up template khi legacy khong co gia tri tuong ung (LXIII — defer) `[followup-material]`
- Tu thiet ke full patient safety system khi khong co requirement tu legacy (LXIV) `[followup-material]`
- Dung AI de tu chan doan y khoa (LXV) `[followup-material]`
- Tao bang location rieng cho healthcare thay vi dung InventoryLocation (LXXII) `[followup-material]`
- Dung MedicalFollowUp cho follow-up khong chua clinical assessment (LVIII — truong hop do thuoc WorkItem) `[followup-material]`
- LXXIII: Không được để công việc lâm sàng phụ thuộc DUY NHẤT vào sự tồn tại của Sale - cấm ràng buộc bắt buộc phải có Sale mới tạo/thực hiện được Case/Procedure. `[finance-access-permission]`
- LXXV: Cấm auto-grant finance.view cho bác sĩ (hay bất kỳ vai trò lâm sàng nào) chỉ vì có quyền truy cập Case. `[finance-access-permission]`
- LXXVI: Reception không được xem full clinical notes. `[finance-access-permission]`
- LXXVII: Nurse không được truy cập payroll/finance. `[finance-access-permission]`
- LXXVIII: Doctor không tự động là Company admin. `[finance-access-permission]`
- LXXXI: KHÔNG xây clinical credential engine đầy đủ ở giai đoạn này (defer) - chỉ để ngỏ chỗ cắm chính sách tương lai. `[finance-access-permission]`
- LXXXII: KHÔNG xây universal row-level ACL cho Case khi chưa có bằng chứng nhu cầu - mặc định là Company + permission. `[finance-access-permission]`
- LXXX: Không tạo hệ permission song song cho healthcare; không bung nở registry vượt mức 'keep manageable'. `[finance-access-permission]`
- LXXXV: Cross-company case (Customer Company B gắn Case Company A) - NEVER. `[finance-access-permission]`
- LXXXVI: Cross-company clinician - NEVER. `[finance-access-permission]`
- LXXXVII: Cross-company photo - NEVER. `[finance-access-permission]`
- LXXXVIII: Cross-company material - NEVER. `[finance-access-permission]`
- LXXXIX: Không được làm suy yếu chặn cross-company Appointment đã có ở Core khi tích hợp healthcare. `[finance-access-permission]`
- Khong dung co che dynamic plugin install cho module Healthcare (XC). `[module-parity-journey]`
- Khong duoc de viec bat module lam thay doi kien truc tenant (XCI). `[module-parity-journey]`
- Company AI healthcare context: defer — chi bat "later", khong lam trong pham vi nay (XCI). `[module-parity-journey]`
- Company Type khong duoc tu dong rewrite schema (XCII). `[module-parity-journey]`
- Khong import du lieu production that trong Phan 7 (XCIII). `[module-parity-journey]`
- Cam sao chep vao dev DB du lieu that: patients, medical photos, diagnoses, finance, payroll (XCIV). `[module-parity-journey]`
- Khong duoc gia dinh cac ten trong spec (CaseRecord, Consultation, ...) la ten model/route thuc te cua legacy — phai tra source (XCVI). `[module-parity-journey]`
- Khong tai tao tung man hinh legacy (screen parity) (CIII). `[module-parity-journey]`
- Khong yeu cau column parity — khong bat buoc mang moi cot legacy sang (CIV). `[module-parity-journey]`
- Khong gia dinh moi dich vu deu chay dung thu tu CUSTOMER -> APPOINTMENT -> CONSULTATION -> CASE -> SCREENING -> CONSENT -> PROCEDURE -> FOLLOW-UP (CV). `[module-parity-journey]`
- Khong lam wizard khong lo one-size-fits-all cho moi dich vu (CVI). `[module-parity-journey]`
- Khong xay dung universal workflow DSL (CVII). `[module-parity-journey]`
- Readiness khong duoc tinh bang logic phi deterministic (AI/heuristic ngau nhien) (CVIII). `[module-parity-journey]`
- CIX: Cam de LLM quyet dinh ket qua procedure readiness check ('Do not LLM decide'). `[ai-audit-privacy]`
- CX: Cam AI cap authorization cho thu thuat — clinical authorization thuoc human/policy. `[ai-audit-privacy]`
- CXI: Cam AI im lang tao diagnosis/procedure indication ngoai workflow do clinician kiem soat. `[ai-audit-privacy]`
- CXII: Khong ap dat two-person approval kieu Finance cho clinical write (clinical workflow khac finance). `[ai-audit-privacy]`
- CXV: Cam trinh bay khuyen nghi AI nhu medical order da finalize khi chua co clinician co tham quyen xac nhan. `[ai-audit-privacy]`
- CXXI: Cam hard delete ban ghi clinical da finalized (default deny). `[ai-audit-privacy]`
- CXXII: Cam bia thoi han luu tru phap ly khi chua co yeu cau da xac minh. `[ai-audit-privacy]`
- CXXIV: Cam log vao technical log: chan doan day du, anh clinical, medical note, du lieu dinh danh ca nhan. `[ai-audit-privacy]`
- CXXVI: Cam link PDF cong khai khong an toan cho tai lieu clinical; export phai authorize server-side. `[ai-audit-privacy]`
- CXXVII: Khong xay document engine day du cho in an tru khi co yeu cau ro rang. `[ai-audit-privacy]`
- CXXX/CXXXI: Cam de Founder/Ecosystem search tu dong lo noi dung clinical cua moi Company; cam gia dinh FOUNDER = READ ALL PHI. `[ai-audit-privacy]`
- CXXXII: Cam Ecosystem AI tu dong ingest toan bo ho so y te. `[ai-audit-privacy]`
- CXXXIV: Cam gui du lieu clinical du thua cho AI (vi du gui full clinical history khi tac vu chi can so lich hen). `[ai-audit-privacy]`
- CXXXVI: Cam coi ID client gui la co so cap quyen truy cap. `[ai-audit-privacy]`
- CXXXVIII: Cam dung URL asset CDN cong khai cho anh clinical khi khong co authorization strategy. `[ai-audit-privacy]`
- DEFER sang Phan 8: chi tiet AI summarize du lieu clinical (CXI) va co che danh dau/soan thao AI generated clinical text (CXIV) — Phan 7 chi chua cho, khong implement. `[ai-audit-privacy]`
- CLXXVII: Cấm tự phát minh cơ chế emergency bypass âm thầm cho company suspended — nếu có emergency read thì phải là policy tường minh. `[tests]`
- CLXX: Cấm để việc hoàn tất Work/task nhắc việc tự động sinh ra kết luận/đánh giá lâm sàng. `[tests]`
- CLXXIII: Cấm để tồn kho âm một cách âm thầm (no silent negative). `[tests]`
- CLXXVIII: Cấm mọi clinical operation trên company đã archived (chỉ read-only theo rule founder/admin). `[tests]`
- CLXXVII: Cấm clinical write mới trên company đang suspended. `[tests]`
- CXLI: Cấm cho phép truy cập route Healthcare ở company không bật module (kể cả gọi trực tiếp, bỏ qua UI). `[tests]`
- CXLIX: Cấm Reception sửa clinical note của Consultation nếu policy không cho phép. `[tests]`
- CXLVIII: Cấm sửa trực tiếp đè lên Consultation đã finalize (phải qua controlled/addendum). `[tests]`
- CLI/CLII/CLXXVI: Cấm doctor thiếu quyền finance mở dữ liệu Finance; cấm finance user thiếu quyền healthcare đọc medical note; cấm clinical staff sửa payment khi không có permission. `[tests]`
- CLXXXII: Cấm coi việc ẩn control trên UI là biện pháp kiểm soát — không được dựa vào UI hidden controls để đảm bảo an toàn. `[tests]`
- CLXXX: Cấm cho phép clinical write qua stale session sau khi position Doctor đã kết thúc. `[tests]`
- CLX: Cấm thực hiện Procedure trên case đã closed (mặc định fail, trừ khi reopen tường minh). `[tests]`
- CLXVII: Cấm xóa/void photo lâm sàng ngoài cơ chế controlled. `[tests]`
- CLIX: Cấm double side-effect khi complete Procedure lần thứ hai. `[tests]`
- CXC: Cấm tạo clinic customer directory riêng — dùng Customer Core. `[ux-integration-migration]`
- CXCI: Cấm trang đặt lịch/scheduling trùng lặp, trừ khi workflow legacy thực sự đòi hỏi view chuyên biệt. `[ux-integration-migration]`
- CXCII: Cấm dựng ClinicalTask engine riêng trừ khi ngữ nghĩa thực sự khác WorkItem. `[ux-integration-migration]`
- CXCIV: Cấm đổ toàn bộ hồ sơ bệnh nhân ra Today (Today không phải medical dashboard). `[ux-integration-migration]`
- CXCVII: Cấm dùng LLM sinh medical risk alert làm hệ thống an toàn chính thức trong Phase 7. `[ux-integration-migration]`
- CXCVIII: Cấm dựng dashboard phòng khám khổng lồ; UX cuối cùng defer sang Phần 9. `[ux-integration-migration]`
- CXCIX: Cấm phá vỡ nav budget; cấu trúc nav cuối cùng defer sang Phần 9. `[ux-integration-migration]`
- CC: Cấm hiển thị thuật ngữ khung (Vertical Package, Healthcare Context Entity, ScopeRef, Module Adapter) cho nhân viên y tế. `[ux-integration-migration]`
- CCI: Cấm redesign flow legacy chỉ vì muốn mới lạ. `[ux-integration-migration]`
- CCIII: Cấm sao chép nguyên giao diện legacy (không tái tạo sidebar cũ vì hoài niệm). `[ux-integration-migration]`
- CCIV: Cấm ẩn field an toàn quan trọng sau progressive disclosure. `[ux-integration-migration]`
- CCV: Cấm autosave dẫn tới finalize ngoài ý muốn (autosave chỉ draft). `[ux-integration-migration]`
- CCVII: Cấm bịa dữ kiện lâm sàng mặc định, cụ thể cấm hiển thị 'No allergy' khi chưa ghi nhận. `[ux-integration-migration]`
- CCXI: Cấm tạo bảng timeline trung tâm dư thừa trừ khi bắt buộc. `[ux-integration-migration]`
- CCXIII: Cấm public caching ảnh lâm sàng. `[ux-integration-migration]`
- CCXIV: Cấm expose EXIF/location không cần thiết. `[ux-integration-migration]`
- CCXV: Cấm tin vào extension file để xác định loại file. `[ux-integration-migration]`
- CCXVI: Không bắt buộc (và không nên) tự xây hệ thống quét malware cấp doanh nghiệp từ đầu — ghi vào backlog bảo mật. `[ux-integration-migration]`
- CCXVII: Cấm đưa tên bệnh nhân vào đường dẫn lưu trữ public. `[ux-integration-migration]`
- CCXVIII: Cấm tự phát minh cơ chế mã hóa riêng. `[ux-integration-migration]`
- CCXIX: Backup/cutover production defer sang Phần 10; Phần 7 chỉ backup môi trường test. `[ux-integration-migration]`
- CCXX: Cấm migrate dữ liệu lâm sàng legacy thật trong Phần 7 — chỉ làm mapping spec. `[ux-integration-migration]`
- CCXXV: Cấm dùng bucket public tạm thời khi copy ảnh lâm sàng (Phần 10). `[ux-integration-migration]`
- CCXXVI: Cấm chạy lại workflow lâm sàng trên dữ liệu lịch sử khi migrate. `[ux-integration-migration]`
- CCXXVIII: Cấm giả định có thể tái dựng đầy đủ lịch sử movement kho từ dữ liệu legacy. `[ux-integration-migration]`
- CCXXIX: Cấm map legacy Customer/Payment vào bảng Healthcare. `[ux-integration-migration]`
- CCXXX: Khử trùng lặp khách hàng defer sang Phần 10; Phần 7 chỉ identify quan hệ. `[ux-integration-migration]`
- CCXXXII: Xác minh cuối cùng thứ tự migration defer sang Phần 10. `[ux-integration-migration]`
- CCXXXIII: Cấm giả định target ID = source ID. `[ux-integration-migration]`
- CCXXXVII: Record hash là optional — cấm làm phức tạp hóa hệ thống vì nó. `[ux-integration-migration]`
- Dung du lieu production/benh nhan that trong parity test — chi synthetic (CCXXXVIII). `[parity-commands-constraints]`
- Raw arbitrary CRUD tren cac model lam sang (CCLVII). `[parity-commands-constraints]`
- Hien ma loi Prisma / loi noi bo tren UI (CCLXVI). `[parity-commands-constraints]`
- Hien lo noi bo AI governance (agent, job, approval internals) tren man hinh lam sang (CCLXVIII). `[parity-commands-constraints]`
- Bat moi buoc lam sang phai qua 'admin approval' (CCLXIX). `[parity-commands-constraints]`
- Dinh tuyen Patient Consent qua Approval engine dung chung (CCLXX). `[parity-commands-constraints]`
- Dung luong business approval cho procedure sign-off (CCLXXI). `[parity-commands-constraints]`
- Ep safety checklist vao model Approval chung (CCLXXII). `[parity-commands-constraints]`
- Query 'get all cases' khong scope theo Company (CCLXXVIII). `[parity-commands-constraints]`
- Cascade delete lich su lam sang (CCLXXXIII). `[parity-commands-constraints]`
- Xoa MedicalCase theo duong thong thuong khi da co ban ghi con (CCLXXXIV). `[parity-commands-constraints]`
- Implement Case merge tru khi legacy chung minh can (CCLXXXVII). `[parity-commands-constraints]`
- Gan MedicalCase vao Project / dua du lieu lam sang vao Project (mac dinh NO) (CCXCIII, CCXCIV). `[parity-commands-constraints]`
- Tao model thanh toan lam sang trung lap voi Finance core (CCXCV). `[parity-commands-constraints]`
- Luu luong/thu lao trong model lam sang (CCXCVI). `[parity-commands-constraints]`
- Tao kho/ton kho rieng cho healthcare thay vi tham chieu Inventory core (CCXCVII). `[parity-commands-constraints]`
- Xay audit log rieng cua vertical thay vi dung core Audit (CCXCVIII). `[parity-commands-constraints]`
- Xay lop file storage rieng thay vi dung core File Storage (CCC). `[parity-commands-constraints]`
- Coi Branch la tenant rieng (CCXCII). `[parity-commands-constraints]`
- Xay he thong phan cap chuyen khoa khi chua co nhu cau (CCXC). `[parity-commands-constraints]`
- Tin hieu AI mang tinh suy dien/du doan — chi cho phep deterministic (CCLXXIII). `[parity-commands-constraints]`
- Defer sang Phan 8: cac tinh nang AI (tom tat, tim khoang trong van hanh, chuan bi task, tra loi cau hoi, de xuat lich, soan nhap ghi chu) va evidence links tren UX (CCLXXIV, CCLXXVI). `[parity-commands-constraints]`
- Co the defer: Customer merge keo theo MedicalCase (high-risk) (CCLXXXVI). `[parity-commands-constraints]`
- CCCII: Cam tich hop SMS/Zalo o Phan 7 (defer) va cam gui bat ky message that nao toi benh nhan. `[deferred-aesthetics-traceability]`
- CCCIV: Patient portal — khong thuoc Phan 7. `[deferred-aesthetics-traceability]`
- CCCV: Online booking — khong can, khong lam. `[deferred-aesthetics-traceability]`
- CCCVI: E-prescription — cam them vao tru khi co capability legacy tuong minh VA yeu cau da duoc validate. `[deferred-aesthetics-traceability]`
- CCCVII/CCCVIII/CCCIX: Cam tu dong dua Laboratory / Imaging / Pharmacy vao pham vi Phan 7. `[deferred-aesthetics-traceability]`
- CCCIX: Cam tu sang che he HIS benh vien khong co trong legacy. `[deferred-aesthetics-traceability]`
- CCCX: Inpatient management — ngoai scope tru khi legacy da co. `[deferred-aesthetics-traceability]`
- CCCXI: Bed management — defer. `[deferred-aesthetics-traceability]`
- CCCXII: Insurance claims — defer tru khi chung minh duoc legacy da co. `[deferred-aesthetics-traceability]`
- CCCXIII: Cam build tich hop y te quoc gia khi chua co specification hien hanh va credentials. `[deferred-aesthetics-traceability]`
- CCCXIV: EMR certification — ngoai Phase 7 tru khi co yeu cau tuong minh. `[deferred-aesthetics-traceability]`
- CCCXV: Cam gia dinh legacy co medication workflow roi implement truoc. `[deferred-aesthetics-traceability]`
- CCCXVIII: Cam dung LLM cho clinical alert. `[deferred-aesthetics-traceability]`
- CCCXXI: Cam dau tu sau vao photo comparison UI truoc khi dat parity. `[deferred-aesthetics-traceability]`
- CCCXXII: Cam sua/ghi de ngam anh lam sang goc. `[deferred-aesthetics-traceability]`
- CCCXXIII: Photo annotations — defer tru khi legacy that su dung. `[deferred-aesthetics-traceability]`
- CCCXXIV: Cam tu bia/tu soan noi dung phap ly cho consent. `[deferred-aesthetics-traceability]`
- CCCXXIX: Cam tinh 'profit' cua procedure tu vat tu tieu hao khi chua co cost accounting. `[deferred-aesthetics-traceability]`
- CCCXXXI: Cam tao stock/ton kho trung lap ben trong Healthcare (lot phai nam o Inventory). `[deferred-aesthetics-traceability]`
- CCCXXXVII: Cam gioi han archaeology trong pham vi cac vi du neu trong prompt. `[deferred-aesthetics-traceability]`
- CCCXXXVII: Cấm giới hạn phạm vi khảo cổ legacy chỉ trong các ví dụ mà prompt liệt kê. `[legacy-rules-agents-arch]`
- CCCXXXVIII: Cấm bỏ sót một capability legacy có thật chỉ vì prompt không nhắc tên nó. `[legacy-rules-agents-arch]`
- CCCXXXIX: Cấm bảo tồn duplication xấu — không port toàn bộ màn hình trùng lặp của legacy (ví dụ 3 customer view) sang target. `[legacy-rules-agents-arch]`
- CCCXLI: Cấm port dead code sang target. `[legacy-rules-agents-arch]`
- CCCXLII: Cấm port workaround bug lịch sử khi chưa hiểu nguyên nhân của nó. `[legacy-rules-agents-arch]`
- CCCXLV: Cấm ra quyết định migration lâm sàng chỉ dựa trên nhãn UI của legacy. `[legacy-rules-agents-arch]`
- CCCXLVI: Cấm truy cập dữ liệu production thật khi chưa được cho phép tường minh và chưa provisioning an toàn; Phần 7 mặc định chỉ dùng schema/source. `[legacy-rules-agents-arch]`
- CCCXLVIII: Cấm kết nối migration adapter tới production. `[legacy-rules-agents-arch]`
- CCCXLIX: Cấm đặt code công cụ migration chung với code runtime. `[legacy-rules-agents-arch]`
- CCCLV: Cấm thiết kế bắt bác sĩ phải điều hướng qua độ phức tạp ERP để hoàn thành công việc lâm sàng. `[legacy-rules-agents-arch]`
- CCCLVI: Cấm chấp nhận critical flow của target có UX kém hơn legacy. `[legacy-rules-agents-arch]`
- Event sourcing cho clinical event model (CCCLXIX). `[orchestration-events-reports]`
- Kafka / message broker phân tán; phá vỡ modular monolith (CCCLXX). `[orchestration-events-reports]`
- Universal medical form builder khi chưa có nhu cầu sản phẩm thực tế (CCCLXXI). `[orchestration-events-reports]`
- Dynamic form metadata — defer, không phải ưu tiên phase này (CCCLXXII). `[orchestration-events-reports]`
- Versioning cho mọi form/template (chỉ Consent + clinical template) (CCCLXXIII). `[orchestration-events-reports]`
- Versioning tràn lan cho mọi clinical document (CCCLXXIV). `[orchestration-events-reports]`
- Hospital BI platform / báo cáo phân tích đa chiều cho healthcare (CCCLXXV). `[orchestration-events-reports]`
- Tự nghĩ ra medical outcome metrics (CCCLXXVI). `[orchestration-events-reports]`
- Clinical quality metrics — defer sang tương lai (CCCLXXVII). `[orchestration-events-reports]`
- Lộ PHI không cần thiết trên Founder summary (CCCLXXVIII). `[orchestration-events-reports]`
- Hiển thị clinical note chi tiết mặc định trên summary của quản lý Company (CCCLXXIX). `[orchestration-events-reports]`
- Hard-code nav theo role name thay vì permission (CCCLXXXIV). `[orchestration-events-reports]`
- Tạo global role cho các role phòng khám legacy (CCCLXXXV). `[orchestration-events-reports]`
- Coi TELESALE là healthcare core role (CCCLXXXVII). `[orchestration-events-reports]`
- Tự động map legacy ADMIN thành Founder (CCCXC). `[orchestration-events-reports]`
- Coi SHAREHOLDER là healthcare role (CCCXCI). `[orchestration-events-reports]`
- CDXIII — Khong lam AI config trong Phan 7 (defer sang Part 8). `[roles-tail]`
- CDXIV — Khong xay dung template marketplace. `[roles-tail]`
- CDXVII — Khong ho tro xoa (delete) module Healthcare. `[roles-tail]`
- CDXVI — Khong tuy tien disable module Healthcare khi da co du lieu that theo cach an mat quyen truy cap quan trong; chi tiet quan tri defer sang Part 9. `[roles-tail]`
- CDXXI — Khong dat ten model kieu ZHealthcare* de mo phong legacy. `[roles-tail]`
- CDXX — Khong tao model trung lap Core (ClinicCustomer, MedicalAppointment, ClinicPayment, ClinicPayroll, ClinicInventory, ClinicTask) neu khong giai trinh duoc. `[roles-tail]`
- CDXV — Khong hien bang/man hinh healthcare trong UI cua Company khong dung Healthcare. `[roles-tail]`
- CDXII — Khong expose technical/advanced config va framework settings ra UI settings cua module. `[roles-tail]`
- CDVIII — Khong dung ngon ngu ky thuat trong warning (vd 'Consent FK missing'). `[roles-tail]`
- CDX — Khong canh bao o moi field (tranh alert fatigue). `[roles-tail]`
- CDXLI — Khong viet lich su/khao co legacy vao comment source code. `[roles-tail]`
- CDXXVIII — Khong chep lai noi dung da co trong master docs (phai link). `[roles-tail]`
- CDLXII#1-6 — Healthcare khong duoc co Customer / Appointment engine / Payment / Payroll / Inventory / Task engine rieng (Appointment chi ngoai le neu chung minh khong the tranh). `[roles-tail]`
- CDLXIV — Defer sang backlog (P1): polish UI tham my, bao cao tuy chon, so sanh anh nang cao, quan ly template nang cao. `[roles-tail]`
- CDLXV — Khong hoi nguoi dung ve cac lua chon ky thuat thong thuong. `[roles-tail]`
- CDLXVI — Khong dung lai ngoai 6 dieu kien hard block da liet ke. `[roles-tail]`
- CDLXVII — Khong dung du lieu production. `[roles-tail]`
- CDLXVIII — Khong gui SMS/Zalo/email toi benh nhan that. `[roles-tail]`
- CDLXIX — Khong thuc hien hanh dong lam sang that; chi test/synthetic. `[roles-tail]`
- CDLXX — Khong deploy/cutover production trong Phan 7 (defer sang Part 10). `[roles-tail]`
- CDLIX.8 — Khong migrate du lieu that. `[roles-tail]`
- CCCXCIII/CDLIX.9 — Khong co silent gap va khong retire capability legacy mot cach ngam. `[roles-tail]`
- CDLXI.19-20 — Khong thay doi repo ZenithTasks va khong dung den production. `[roles-tail]`
- CCCXCIV — Khong sang Part 8 khi con healthcare capability P0 o trang thai UNKNOWN (tru blocker da document). `[roles-tail]`
- CCCXC — Khong tu dong map legacy ADMIN thanh Founder. `[roles-tail]`

## Yêu cầu theo cụm

### case-appointment — spec dòng 602–1000 (19 yêu cầu)

**VI. Phân loại bắt buộc mọi model/feature legacy Clinic trước khi migrate** — `LegacyClassification`, `LEGACY_CAPABILITY_MATRIX`

Xây dựng bảng phân loại (classification registry) cho MỌI model/feature legacy của hệ Clinic. Mỗi mục phải được gán đúng MỘT trong 7 nhãn: GENERIC_CORE, HEALTHCARE_VERTICAL, AESTHETICS_SPECIALIZATION, LEGACY_DUPLICATE, TECHNICAL_INFRASTRUCTURE, UNKNOWN, RETIRE. Quy tắc chặn: model/feature chưa có classification thì KHÔNG được migrate sang app mới (không tạo Prisma model, không tạo service, không tạo migration). Cần một artifact tra cứu được (ví dụ bảng trong docs/legacy/LEGACY_CAPABILITY_MATRIX.md) làm cổng kiểm soát trước khi viết code Healthcare, và test/CI check chặn migrate item nhãn UNKNOWN hoặc chưa gán nhãn.

**VII. Danh sách capability GENERIC CORE — dùng lại Core Phần 3-6, cấm tái tạo trong Healthcare** — `User`, `Customer`, `Appointment`, `Task`, `PlanTask`, `Payment`, `CashTransaction`, `Sale`, `Payroll`, `Attendance`, `Inventory`, `Organization`, `Audit`, `Approval`, `AIExecution`, `File`, `Notification`

Các capability sau tuy trong legacy mang 'DNA Clinic' nhưng bản chất là generic, BẮT BUỘC dùng lại Core đã implement ở Phần 3-6 và KHÔNG được tạo lại bản sao trong package Healthcare: User, Customer, Appointment, Task/PlanTask, Payment, CashTransaction, Sale, Payroll, Attendance, Inventory, Organization, Audit, Approval, AI execution, Files, Notifications. Healthcare chỉ được tham chiếu (relation/FK) tới các entity Core này, không định nghĩa lại schema tương đương.

**VIII. Danh sách ứng viên HEALTHCARE-SPECIFIC** — `MedicalCase`, `CaseRecord`, `ClinicalConsultation`, `ClinicalScreening`, `DoctorIndication`, `Procedure`, `Consent`, `ClinicalPhoto`, `MedicalFollowUp`, `HealthcareMaterialUsage`, `ClinicalNote`, `ProcedureOutcome`, `ComplicationFollowUp`

Các khái niệm sau là ứng viên thuộc Healthcare Vertical (đặc thù y tế, không thuộc Core): MedicalCase, CaseRecord, ClinicalConsultation, ClinicalScreening, DoctorIndication, bản ghi liên quan Diagnosis, Procedure, Treatment episode, Consent, ClinicalPhoto, Before/After Photo, MedicalFollowUp, HealthcareMaterialUsage, ClinicalNote, ProcedureOutcome, ComplicationFollowUp. Đây mới là danh sách ví dụ/ứng viên — tên model thật khi implement phải căn cứ vào source legacy tương ứng, không tự đặt tên theo trí nhớ hay theo danh sách ví dụ này.

**IX. Nhóm AESTHETICS SPECIALIZATION nằm trong Healthcare/Aesthetics Vertical** — `BeforeAfterImageSet`, `AestheticConsultation`, `ProcedurePlan`, `BodyArea`, `AestheticConcern`, `TreatmentPackageContext`, `OutcomePhotography`

Các nghiệp vụ đặc thù thẩm mỹ (khác y tế chung): bộ ảnh Before/After, Aesthetic consultation, Procedure plan, Body-area/aesthetic concern, Treatment package context, Post-procedure cosmetic progress, Outcome photography. Không bắt buộc tách thành package riêng ngay ở bước này; được phép đặt trong Healthcare/Aesthetics Vertical chung.

**X. Healthcare Vertical không tạo entity Customer mới** — `Customer`, `HealthcareProfile`, `MedicalCase`

Tuyệt đối không tạo HealthcareCustomer, ClinicCustomer, PatientCustomer khi Customer Core đã đủ. Mô hình đúng: dùng Customer Core + bổ sung HealthcareProfile và/hoặc MedicalCase tham chiếu customerId. Mọi truy vấn danh tính khách hàng trong Healthcare phải đi qua Customer Core.

**XI. Customer không đồng nhất với hồ sơ y tế** — `Customer`, `MedicalCase`, `HealthcareProfile`

Một Customer có thể chỉ hỏi dịch vụ, chưa khám, chưa có hồ sơ y tế. Bản ghi healthcare (HealthcareProfile / MedicalCase) chỉ được sinh khi nghiệp vụ thực sự cần. Cấm mọi cơ chế tự động tạo MedicalCase cho mọi Customer (không auto-create khi tạo Customer, không backfill hàng loạt). Việc tạo MedicalCase phải là hành động nghiệp vụ tường minh.

**XII. Thuật ngữ Patient không được tạo identity trùng lặp** — `Patient`, `HealthcareProfile`, `Customer`

Nếu sản phẩm cần thuật ngữ 'Patient', hiện thực bằng một trong hai hướng: (a) HealthcareProfile liên kết tới Customer, hoặc (b) Customer có healthcare role/context. Trong mọi trường hợp KHÔNG tạo bảng identity thứ hai cho bệnh nhân — không duplicate identity của Customer/User.

**XIII. HealthcareProfile là optional, chỉ chứa dữ liệu y tế ổn định xuyên Case** — `HealthcareProfile`, `Customer`, `Company`

Chỉ tạo model HealthcareProfile khi có use case thật cần dữ liệu y tế ổn định dùng chung nhiều MedicalCase. Cấu trúc gợi ý: id, companyId, customerId, medicalIdentifier? (optional), basicMedicalMetadata... (metadata y tế cơ bản). Cấm nhồi toàn bộ lịch sử khám/điều trị vào profile — lịch sử thuộc về MedicalCase và các bản ghi lâm sàng, profile chỉ giữ dữ liệu ổn định/ít thay đổi.

**XIV. MedicalCase là entity lõi của Healthcare Vertical** — `MedicalCase`, `Customer`

Tạo entity canonical tương đương MedicalCase, định nghĩa: một episode/hồ sơ chăm sóc hoặc điều trị chuyên môn của một Patient/Customer. MedicalCase KHÔNG được dùng thay cho Customer (không lưu danh tính/thông tin liên hệ khách hàng như thể nó là customer record); danh tính luôn nằm ở Customer Core.

**XV. Ownership tường minh của MedicalCase** — `MedicalCase`, `Company`, `Customer`

MedicalCase.companyId là bắt buộc (NOT NULL). MedicalCase.customerId bắt buộc nếu nghiệp vụ phù hợp. Cấm suy ra Company của Case qua đường vòng customerId -> Customer.companyId; mọi truy vấn/scope/authorization phải dùng trực tiếp MedicalCase.companyId (explicit ownership để bảo mật tenant).

**XVI. Mô hình khái niệm MedicalCase** — `MedicalCase`, `User`, `OrganizationUnit`, `Company`, `Customer`

Cấu trúc MedicalCase gợi ý: id, companyId, customerId, code? (optional), status, caseType? (optional), openedAt, closedAt? (optional), primaryClinicianUserId? (optional), organizationUnitId? (optional), createdAt, updatedAt. Đây là mô hình khái niệm — cấm copy nguyên schema legacy một cách mù quáng; field cụ thể phải đối chiếu nghiệp vụ thật.

**XVII. Enum trạng thái Case tối giản** — `MedicalCase`, `MedicalCaseStatus`

Case status dùng tập tối giản: OPEN, IN_TREATMENT, FOLLOW_UP, CLOSED, CANCELLED — hoặc theo tập trạng thái thực tế của source legacy. Cấm bung ra ~30 trạng thái trừ khi nghiệp vụ bắt buộc và chứng minh được từ legacy.

**XVIII. Enum loại Case** — `MedicalCase`, `MedicalCaseType`

Case type có thể gồm: CONSULTATION, TREATMENT, PROCEDURE, SURGERY, AESTHETICS, OTHER. Không over-enum; tập giá trị cuối cùng phải dựa trên legacy thực tế.

**XIX. Mã hồ sơ Case unique theo Company** — `MedicalCase`, `Company`

Nếu cơ sở y tế cần mã hồ sơ, MedicalCase.code phải unique trong phạm vi Company: ràng buộc DB unique(companyId, code). Không unique toàn cục.

**XX. Phân biệt MedicalCase và Appointment** — `MedicalCase`, `Appointment`

Appointment = lịch theo thời gian; MedicalCase = hồ sơ chuyên môn. Quan hệ: một MedicalCase có nhiều Appointment; một Appointment có thể mở một Case mới hoặc liên kết tới Case đã có. Không gộp hai khái niệm vào một model.

**XXI. Bắt buộc reuse Appointment Core, không tạo engine lịch thứ hai** — `Appointment`, `HealthcareAppointmentContext`

Cấm tạo model/engine MedicalAppointment nếu Appointment Core (Phần 3-6) đã hỗ trợ lịch. Healthcare chỉ được bổ sung HealthcareAppointmentContext để mang metadata y tế, gắn vào Appointment Core.

**XXII. HealthcareAppointmentContext — chỉ chứa field healthcare-specific** — `HealthcareAppointmentContext`, `Appointment`, `MedicalCase`

Model optional HealthcareAppointmentContext với các field: appointmentId (tham chiếu Appointment Core), medicalCaseId? (optional), appointmentPurpose? (optional), specialty? (optional), clinicalStatus? (optional). Chỉ được chứa field đặc thù y tế; cấm lặp lại field lịch/thời gian/tài nguyên đã có ở Appointment Core.

**XXIII. Bác sĩ là User + Assignment/Position, không phải text tự do** — `MedicalCase`, `User`, `Assignment`, `Position`, `CompanyMembership`

Bác sĩ được biểu diễn bằng User Core kết hợp Assignment/Position của Organization. Cấm field text tự do kiểu MedicalCase.doctorText = "BS A" khi đã có User identity — phải dùng relation tới User (ví dụ primaryClinicianUserId). Mọi relation tới User phải Company-valid: user được gán phải có membership/assignment hợp lệ trong đúng Company của MedicalCase.

**XXIV. Vai trò chuyên môn không trở thành global User Role** — `User`, `Role`, `Assignment`, `Position`

Các vai trò chuyên môn y tế (DOCTOR, NURSE, v.v.) KHÔNG được đưa trở lại thành global User Role (không thêm vào enum role toàn cục của User). Chúng phải được biểu diễn ở tầng Organization/Assignment/Position hoặc context healthcare, giữ đúng bài học tránh bypass tenant bằng role toàn cục. (Lưu ý: mục XXIV bị cắt tại dòng 1000 — phần còn lại nằm ngoài dải được giao.)

### consultation-procedure — spec dòng 1000–1340 (18 yêu cầu)

**XXV. Healthcare Professional Profile** — `HealthcareProfessionalProfile`, `User`

Tao entity rieng HealthcareProfessionalProfile de luu thong tin chuyen mon y te cua nhan su: specialty (chuyen khoa), professional title (chuc danh chuyen mon), license metadata (thong tin chung chi hanh nghe), clinical identifiers (dinh danh chuyen mon). TUYET DOI khong them cac field nay vao User core (model User cua Phan 3 Identity). Profile nay nam trong healthcare vertical, gan len User/CompanyMembership da co chu khong sua model nen.

**XXVI. License Information** — `HealthcareProfessionalProfile`, `License`

Neu san pham can luu so chung chi hanh nghe, pham vi hanh nghe, ngay hieu luc thi cac field nay phai nam trong healthcare professional domain (gan HealthcareProfessionalProfile / license record cua vertical y te), khong dat o Identity core. Chi luu du lieu, KHONG xay he thong xac minh chung chi (credential verification platform) trong Phase 7.

**XXVII. Consultation canonical entity** — `ClinicalConsultation`, `Company`, `MedicalCase`

Tao mot entity canonical duy nhat cho buoi kham/tu van chuyen mon, ten ClinicalConsultation (hoac Consultation). Entity nay thuoc ve Company (tenant scope) va thuoc ve MedicalCase — nghia la phai co ca companyId lan medicalCaseId, khong ton tai consultation lo lung ngoai Case, khong ton tai consultation khong thuoc Company nao.

**XXVIII. Consultation conceptual model** — `ClinicalConsultation`

Mo hinh khai niem cho ClinicalConsultation gom cac truong: id, companyId, medicalCaseId, clinicianUserId, occurredAt, reason, assessment, plan, createdAt, updatedAt. Chi tiet cu the (kieu du lieu, truong bo sung, truong bat buoc/optional) phai dua tren khao co legacy ZenithTasks chu khong tu bia.

**XXIX. Clinical record immutability** — `ClinicalConsultation`, `AuditLog`

Clinical note khong duoc phep sua/xoa tuy tien. Moi clinical record bat buoc phai co: author (nguoi tao — clinician user), timestamps (createdAt/updatedAt), audit trail (ghi lai moi thay doi), va mot correction/addendum policy ro rang thay cho viec ghi de tu do. Enforce o tang domain/service, khong chi o UI.

**XXX. Addendum thay vi overwrite** — `ClinicalConsultation`, `Addendum`

Khi mot record chuyen mon da o trang thai finalized/signed, moi thay doi noi dung phai duoc ghi nhan bang ADDENDUM (ban ghi bo sung tro ve record goc) chu khong ghi de len noi dung goc. Khong can — va khong duoc — xay he thong digital signature phuc tap neu he thong chua co san.

**XXXI. Draft vs Final** — `ClinicalConsultation`

ClinicalConsultation co the co hai trang thai DRAFT va FINAL (chi ap dung neu khao co legacy cho thay co nhu cau that). Record o trang thai FINAL chi duoc sua qua duong controlled edit (co kiem soat, co audit, uu tien addendum theo XXX), khong sua tu do nhu DRAFT.

**XXXII. Clinical Screening** — `Screening`

Khao co legacy ZenithTasks ve Screening (sang loc truoc thu thuat). Neu Screening la mot entity rieng va quan trong trong legacy thi salvage no thanh entity chuyen mon co cau truc ro rang. Khong duoc generic hoa Screening thanh arbitrary form / form builder khi cau truc chuyen mon da ro.

**XXXIII. Doctor Indication** — `ClinicalIndication`, `MedicalCase`, `CatalogItem`

Neu legacy co khai niem 'Doctor indication' (bac si chi dinh) thi phai giu nguyen business semantics, khong hoa tan vao note tu do. Co the model thanh ClinicalIndication lien ket toi: MedicalCase, clinician (bac si chi dinh), procedure/service duoc chi dinh, va date (ngay chi dinh).

**XXXIV. Diagnosis** — `Diagnosis`, `ClinicalConsultation`

Khong tu xay he thong ma ICD hoan chinh tru khi legacy hoac use case yeu cau ro. Neu can luu chan doan thi model toi gian: diagnosis text va/hoac diagnosis code dang chuoi, gan vao Case/Consultation.

**XXXV. Procedure la healthcare-specific fulfillment** — `Procedure`, `Sale`

Procedure la fulfillment dac thu y te: ghi nhan viec chuyen mon DA THUC HIEN tren benh nhan. Khong duoc dong nhat Procedure voi Sale cua Phan 6: Sale = khach mua dich vu (giao dich thuong mai); Procedure = hoat dong chuyen mon thuc te da/se thuc hien. Hai model tach biet.

**XXXVI. Sale khac Procedure** — `Sale`, `Procedure`

Sale va Procedure thuoc hai domain khac nhau va phai la hai bang/entity khac nhau. Vi du chuan: Sale = 'Nang mui 50M' (khach mua, gia tri thuong mai); Procedure = 'Phau thuat ngay 10/09, bac si A, phong B, ket qua...' (thuc thi chuyen mon). Mot ben khong duoc suy ra tu dong hay thay the ben kia.

**XXXVII. Procedure model** — `Procedure`, `MedicalCase`, `CatalogItem`, `OrganizationUnit`

Mo hinh khai niem Procedure gom: id, companyId, medicalCaseId, catalogItemId (optional), procedureType (optional), primaryClinicianUserId (optional), organizationUnitId (optional), scheduledAt (optional), performedAt (optional), status, clinicalNotes (optional), createdAt, updatedAt. Procedure luon scoped theo Company va gan vao MedicalCase.

**XXXVIII. Procedure status** — `Procedure`, `ProcedureStatus`

Procedure co truong status voi tap gia tri du kien: PLANNED, READY, IN_PROGRESS, COMPLETED, CANCELLED. Tap gia tri cuoi cung phai chot dua tren khao co legacy chu khong bia them trang thai moi.

**XXXIX. Procedure preconditions** — `Procedure`, `Consent`, `Screening`, `Appointment`, `MedicalCase`

Truoc khi mot Procedure duoc thuc hien, he thong kiem tra cac dieu kien tien quyet tuy nghiep vu: MedicalCase dang open; consent da co; screening da hoan tat; appointment bat buoc da ton tai; clinician da duoc gan. Cac dieu kien nay phai la POLICY theo procedure type (cau hinh duoc), KHONG hard-code tat ca procedure giong nhu ca phau thuat.

**XL. Procedure catalog reuse** — `Procedure`, `CatalogItem`

Neu CatalogItem cua Phan 5 da chua service thi Procedure lien ket truc tiep toi CatalogItem qua catalogItemId. Khong tao mot price catalog rieng cho healthcare khi khong thuc su can — tai su dung catalog nen da co.

**XLI. Healthcare Service Definition** — `HealthcareServiceDefinition`, `CatalogItem`

Co the bo sung metadata y te cho service duoi dang HealthcareServiceDefinition (gan len CatalogItem service), chua: requires consent, requires screening, follow-up schedule, material template. Day la metadata cau hinh don gian; KHONG xay universal clinical protocol engine.

**XLII. Consent la first-class record** — `Consent`, `MedicalCase`

Consent (dong y cua benh nhan) phai la mot healthcare record first-class — entity rieng co vong doi, thoi diem, nguoi ky, pham vi — KHONG duoc rut gon thanh mot checkbox/boolean field tren MedicalCase.

### consent-photo-file — spec dòng 1331–1572 (17 yêu cầu)

**XLII. Consent là first-class healthcare record** — `ConsentRecord`, `MedicalCase`

Consent phải là một bản ghi độc lập (model riêng ConsentRecord trong Prisma schema), KHÔNG được biểu diễn bằng một field boolean/checkbox trên MedicalCase. Mọi luồng nghiệp vụ liên quan tới đồng ý điều trị đều đọc/ghi qua ConsentRecord chứ không qua cờ trên Case.

**XLIII. Consent model — các field bắt buộc** — `ConsentRecord`, `MedicalCase`, `Company`, `User`, `Customer`, `File`

Model ConsentRecord (conceptual) gồm đúng các field spec liệt kê: id; companyId; medicalCaseId; consentType; version (optional); status; signedAt (optional); signedByCustomer (optional); witnessUserId (optional); documentFileId (optional); createdAt. companyId là bắt buộc (tenant scope), medicalCaseId là bắt buộc (gắn với ca bệnh). Các field có dấu ? là nullable/optional. documentFileId trỏ tới File Storage abstraction đã có, không lưu binary trong ConsentRecord.

**XLIV. Consent version — bảo toàn lịch sử bản đã ký** — `ConsentRecord`, `ConsentTemplate`

ConsentRecord phải ghi lại phiên bản nội dung consent tại thời điểm ký (field version). Khi nội dung/template consent thay đổi về sau, các ConsentRecord đã ký KHÔNG được thay đổi theo: update template không được mutate lịch sử. Nghĩa là bản ghi đã ký phải giữ được version (và nội dung tương ứng) mà khách hàng thực sự đã ký.

**XLV. Consent template (tùy chọn, giữ nhỏ)** — `ConsentTemplate`, `Company`

CÓ THỂ thêm model ConsentTemplate, scope theo Company hoặc dưới dạng Healthcare preset dùng chung. Nếu làm thì giữ ở mức tối thiểu — spec cấm xây một document builder khổng lồ cho consent.

**XLVI. Digital signature — chỉ ghi bằng chứng, không xây PKI** — `ConsentRecord`, `File`

Trước tiên khảo cổ legacy (ZenithTasks) xem đã có cơ chế chữ ký số chưa. Nếu legacy chưa có: KHÔNG tự xây PKI/digital signature platform. Chỉ record theo requirement: signedAt (thời điểm ký), signer (người ký), và file/image evidence (ảnh/file chữ ký lưu qua File Storage, tham chiếu bằng documentFileId).

**XLVII. Consent security** — `ConsentRecord`, `Company`

Consent là dữ liệu highly sensitive: truy cập phải bị giới hạn bằng permission (Healthcare permission), và tuyệt đối không có truy cập cross-company — mọi query ConsentRecord đều phải bị ràng buộc bởi companyId của context hiện tại.

**XLVIII. Clinical photo là first-class** — `ClinicalPhoto`

Healthcare/Aesthetics cần model riêng ClinicalPhoto, KHÔNG dùng generic attachment, vì ảnh lâm sàng mang ý nghĩa chuyên môn (clinical meaning) cần metadata riêng.

**XLIX. Clinical photo model — các field bắt buộc** — `ClinicalPhoto`, `MedicalCase`, `Company`, `User`, `File`

Model ClinicalPhoto (conceptual) gồm đúng các field spec liệt kê: id; companyId; medicalCaseId; fileId; photoType; bodyArea (optional); capturedAt (optional); capturedByUserId (optional); notes (optional); createdAt. fileId trỏ tới File Storage abstraction; companyId và medicalCaseId bắt buộc.

**L. Photo types enum** — `ClinicalPhoto`

photoType là enum với các giá trị ví dụ spec đưa: BEFORE, AFTER, FOLLOW_UP, DIAGNOSTIC, PROGRESS, OTHER. Enum không được hard-code chỉ phục vụ thẩm mỹ (before/after) nếu Healthcare vertical rộng hơn — phải giữ được các loại chẩn đoán/theo dõi.

**LI. Before/After pairing** — `ClinicalPhotoSet`, `ClinicalPhoto`

CÓ THỂ thêm relation/group ClinicalPhotoSet để ghép cặp before/after — nhưng chỉ khi legacy đã có khái niệm đó. Nếu chỉ cần lọc đơn giản theo photoType/medicalCaseId là đủ thì KHÔNG tạo ClinicalPhotoSet.

**LII. File storage — reuse abstraction có sẵn** — `ClinicalPhoto`, `File`

Tái sử dụng File Storage abstraction đã có của nền (Phần 3-6), không xây storage layer mới. ClinicalPhoto record chỉ chứa metadata; dữ liệu nhị phân (binary) nằm ở object/file storage.

**LIII. File access — 4 lớp kiểm soát** — `ClinicalPhoto`, `File`, `MedicalCase`, `Company`

Truy cập file ảnh lâm sàng KHÔNG được dựa vào URL khó đoán (unguessable URL) làm cơ chế bảo mật. Mỗi lần truy cập phải thỏa đồng thời 4 điều kiện: (1) đã authenticate; (2) đúng Company scope; (3) có Healthcare permission tương ứng; (4) có quyền truy cập chính Case đó (case access).

**LIV. Signed URL ngắn hạn** — `ClinicalPhoto`, `File`

Nếu storage provider hỗ trợ, phát signed URL có thời hạn ngắn (short-lived) để phục vụ ảnh lâm sàng. Không bao giờ để URL ảnh lâm sàng ở dạng public.

**LV. Clinical photo logging** — `ClinicalPhoto`

Không ghi log URL hoặc token nhạy cảm (signed URL, access token) của ảnh lâm sàng vào bất kỳ log nào (application log, audit log, error log, request log).

**LVI. Photo deletion — archive/void thay vì hard delete** — `ClinicalPhoto`

Ảnh lâm sàng có giá trị lịch sử và rủi ro pháp lý. Cơ chế mặc định phải là archive/void (soft), kèm reason bắt buộc và ghi audit. Hard delete chỉ được thực hiện theo một privacy/data-retention policy có kiểm soát, không phải thao tác thông thường trên UI/API.

**LVII. Tách profile photo và clinical photo** — `ClinicalPhoto`, `Customer`

Ảnh đại diện/hồ sơ của Customer (customer profile photo) và ClinicalPhoto là hai thứ khác nhau — không trộn chung model, không dùng ClinicalPhoto để lưu avatar và ngược lại.

**LVIII. Medical follow-up (đoạn spec bị cắt tại dòng 1572)** — `MedicalCase`

Mục này bắt đầu bằng 'Follow-up chuyên môn có thể dùng:' nhưng nội dung nằm ngoài dải dòng 1331-1572 được giao, nên chưa rút được yêu cầu implement. Cần agent phụ trách dải kế tiếp đọc tiếp từ dòng 1572 để hoàn tất mục LVIII.

### followup-material — spec dòng 1569–1810 (16 yêu cầu)

**LVIII. Medical Follow-Up entity** — `MedicalFollowUp`, `WorkItem`

Tao entity rieng `MedicalFollowUp` cho follow-up chuyen mon. Dieu kien dung: khi ban ghi follow-up CO chua clinical assessment (danh gia chuyen mon cua clinician). Follow-up thuan tuy hanh chinh (goi dien, nhac lich) KHONG dung entity nay ma dung WorkItem cua Phan Work da co.

**LIX. Tach bach MedicalFollowUp vs WorkItem** — `MedicalFollowUp`, `WorkItem`

Phan vai ro rang, khong duoc gop: (a) `WorkItem` tra loi cau hoi 'ai lam viec gi' — mang semantics giao viec/assignment/due; (b) `MedicalFollowUp` tra loi 'ket qua va theo doi chuyen mon' — mang semantics lam sang. Mot follow-up schedule DUOC PHEP sinh ra WorkItem (quan he 1 chieu: FollowUp -> tao Work), nhung MedicalFollowUp khong duoc mang truong assignment/task cua rieng no.

**LX. Model MedicalFollowUp** — `MedicalFollowUp`, `MedicalCase`, `User`, `Company`

Prisma model `MedicalFollowUp` voi cac truong (conceptual, theo spec): `id`, `companyId` (bat buoc — tenant scope), `medicalCaseId` (lien ket ca benh), `clinicianUserId?` (nullable), `followUpAt` (thoi diem follow-up), `status`, `assessment?` (nullable — danh gia chuyen mon), `outcome?` (nullable — ket qua), `nextFollowUpAt?` (nullable — moc follow-up ke tiep, cho phep chuoi follow-up), `createdAt`. Khong them truong assignee/owner kieu task vao model nay (xem LIX).

**LXI. Luong tich hop Follow-up voi Work/Appointment** — `Procedure`, `WorkItem`, `Appointment`, `MedicalFollowUp`

Cai dat luong chuan, tai su dung engine co san: Procedure completed -> system xac dinh can follow-up -> tao `WorkItem` (vi du 'Goi benh nhan tai kham') bang Work module da co -> tao `Appointment` bang Appointment module da co -> ghi `MedicalFollowUp`. Tuyet doi khong viet task engine thu hai trong Healthcare vertical; moi task/nhac viec deu di qua Work module cua nen.

**LXII. Lich follow-up sau thu thuat (procedure-specific)** — `Procedure`, `MedicalFollowUp`

Ho tro lich follow-up nhieu moc cho aesthetics: Day 1, Day 3, Day 7, Month 1, ... Cac moc nay KHONG duoc hard-code o tang product/toan he thong; phai la du lieu cau hinh gan theo tung procedure (procedure-specific follow-up template).

**LXIII. Follow-up template — pham vi toi thieu** — `Procedure`

Chi implement follow-up template neu legacy (ZenithTasks) that su co gia tri/tuong duong de salvage. Neu implement, giu o muc template co dinh gan procedure; khong xay universal workflow builder (khong dieu kien/nhanh/rule engine tong quat).

**LXIV. Ghi nhan bien chung / adverse event** — `ClinicalIncident`, `MedicalCase`, `Procedure`

He thong healthcare phai co kha nang ghi nhan bien chung/su co, nhung CHI khi legacy co requirement. Hai lua chon cai dat: (a) entity `ClinicalIncident` rieng, hoac (b) mot complication field/event gan vao ban ghi lam sang hien co. Khong tu thiet ke full patient safety system (severity taxonomy, RCA workflow, reporting regulatory...) khi khong co requirement.

**LXV. Red flag trong follow-up** — `MedicalFollowUp`, `WorkItem`, `Signal`

Neu noi dung medical follow-up chua canh bao nghiem trong (red flag), he thong CO THE sinh ra `WorkItem` hoac Signal de con nguoi xu ly. Viec phat hien/danh gia y khoa phai do con nguoi hoac rule tuong minh; khong dung AI de tu chan doan.

**LXVI. Tai su dung Inventory cho vat tu y te** — `Inventory`, `InventoryItem`, `ClinicMaterialStock`

Healthcare vertical phai dung lai module Inventory da implement o Phan 3-6 cho toan bo vat tu. Cam tao engine ton kho rieng kieu `ClinicMaterialStock` (bang stock rieng, so luong ton rieng, movement rieng cho phong kham).

**LXVII. Entity ghi nhan su dung vat tu** — `ProcedureMaterialUsage`, `HealthcareMaterialUsage`, `Inventory`

Tao entity ghi nhan su dung vat tu trong healthcare — ten `HealthcareMaterialUsage` hoac `ProcedureMaterialUsage`. Ban chat cua no la BANG CHUNG clinical/operational (evidence cua viec da dung gi trong ca thu thuat), khong phai ban ghi ton kho; so luong ton van do Inventory quan ly.

**LXVIII. Model ProcedureMaterialUsage** — `ProcedureMaterialUsage`, `Procedure`, `InventoryItem`, `InventoryLocation`, `User`, `Company`

Prisma model `ProcedureMaterialUsage` voi cac truong (conceptual, theo spec): `id`, `companyId` (tenant scope), `procedureId`, `inventoryItemId` (tro ve Inventory item cua nen, khong tao catalog vat tu rieng), `inventoryLocationId` (tro ve InventoryLocation cua nen), `quantity`, `recordedByUserId`, `recordedAt`.

**LXIX. Material usage phai goi lenh Inventory** — `ProcedureMaterialUsage`, `Inventory`, `StockMovement`

Khi ghi nhan su dung vat tu, bat buoc goi command cua Inventory `issueStock(...)` voi `source = ProcedureMaterialUsage` (source type + source id de truy nguoc). Cam moi hinh thuc sua truc tiep truong so luong ton (khong update quantity/onHand bang query hay service cua Healthcare).

**LXX. Chong tru kho hai lan (double deduction)** — `ProcedureMaterialUsage`, `StockMovement`, `Inventory`

Duoc danh dau CRITICAL trong spec: cung mot ban ghi material usage khong bao gio duoc tru kho hai lan. Cai dat bang idempotency va/hoac unique constraint tren source (source type + source id) o phia Inventory movement, co test bao phu truong hop goi lai/retry.

**LXXI. Dao nguoc material usage** — `ProcedureMaterialUsage`, `StockMovement`, `AuditLog`

Neu nhap sai, phai co co che sua/dao nguoc CO KIEM SOAT (controlled correction/reversal) — tao ban ghi doi ung/reversal thay vi xoa hoac sua ngam — va ghi audit day du (ai sua, khi nao, tu gia tri nao sang gia tri nao).

**LXXII. Inventory location trong healthcare** — `InventoryLocation`, `Inventory`

Cac dia diem healthcare — phong mo (operating room), phong thu thuat (procedure room), chi nhanh phong kham (clinic branch), kho (warehouse) — deu la du lieu cua `InventoryLocation` san co. Khong tao bang location rieng cho healthcare; chi bo sung du lieu/phan loai neu can.

**LXXIII. Lien ket Sales va Procedure (doan bi cat)** — `SaleLine`, `MedicalCase`, `Procedure`

`SaleLine` co the xac dinh dich vu (service) da mua. `MedicalCase`/`Procedure` co the tham chieu ban ghi thuong mai khi phu hop. LUU Y: doan spec o dong 1810 ket thuc bang chu 'But:' — phan rang buoc/ngoai le di kem nam ngoai dai duoc giao (>1810), can agent phu trach dai ke tiep bo sung truoc khi implement.

### finance-access-permission — spec dòng 1803–2010 (18 yêu cầu)

**LXXIII. Sales / Procedure link (liên kết thương mại - lâm sàng)** — `SaleLine`, `Sale`, `MedicalCase`, `Procedure`

Cho phép SaleLine định danh dịch vụ (service) đã bán, và cho phép MedicalCase/Procedure tham chiếu tới bản ghi thương mại tương ứng (Sale/SaleLine) khi phù hợp. BẮT BUỘC: liên kết này là OPTIONAL (nullable FK), không phải điều kiện tiên quyết. Luồng lâm sàng (tạo MedicalCase, tạo/thực hiện/hoàn tất Procedure) phải chạy được đầy đủ khi KHÔNG tồn tại Sale nào, vì chăm sóc có thể diễn ra ngoài giao dịch bán hàng (bảo hành, tái khám, xử lý biến chứng, dịch vụ tặng). Không được đặt validation/guard bắt buộc phải có saleId/saleLineId ở tầng domain hay API của healthcare.

**LXXIV. Payment / Case link - tách quyền tài chính khỏi ngữ cảnh lâm sàng** — `Customer`, `Payment`, `MedicalCase`, `Permission`

Lịch sử tài chính của Customer CÓ THỂ hiển thị theo ngữ cảnh (contextual) trong màn hình khách hàng/case, nhưng lâm sàng viên (clinician) không nhất thiết cần thấy SỐ TIỀN thanh toán. Phải tách quyền: dữ liệu tài chính (payment amount) trên màn hình healthcare chỉ render khi caller có permission tài chính tương ứng; nếu không có thì ẩn/mask ở tầng server (không trả field về client rồi ẩn ở UI).

**LXXV. Clinical staff finance privacy** — `Permission`, `MedicalCase`, `CompanyMembership`

Bác sĩ (hoặc bất kỳ vai trò lâm sàng nào) KHÔNG tự động được cấp finance.view chỉ vì có quyền truy cập MedicalCase. Permission resolver không được suy diễn/implicit-grant từ nhóm quyền healthcare.* sang nhóm quyền finance.*. Hai nhóm quyền hoàn toàn độc lập trong registry và trong việc gán vào permission pack.

**LXXVI. Reception access pack** — `Permission`, `Customer`, `Appointment`

Tạo permission pack cho Lễ tân (Reception) gồm quyền trên Customer và Appointment, nhưng KHÔNG bao gồm quyền xem đầy đủ clinical notes (không có healthcare.consultation.view / các quyền đọc nội dung khám chi tiết). Triển khai bằng cơ chế permission pack sẵn có của Core, không hardcode role check trong healthcare code.

**LXXVII. Nurse access pack** — `Permission`, `MedicalCase`, `Procedure`

Tạo permission pack cho Điều dưỡng (Nurse) được truy cập các bản ghi lâm sàng/thủ thuật phù hợp (healthcare.case.*, healthcare.procedure.*, healthcare.photo.* ở mức phù hợp), nhưng KHÔNG bao gồm bất kỳ quyền payroll hoặc finance nào.

**LXXVIII. Doctor access pack** — `Permission`, `MedicalCase`, `CompanyMembership`

Tạo permission pack cho Bác sĩ (Doctor) được truy cập các bản ghi y tế liên quan (case, consultation, procedure, photo, consent, followup ở mức phù hợp), nhưng KHÔNG tự động kèm quyền quản trị Company (company admin). Quyền quản trị Company phải được gán riêng và tường minh.

**LXXIX. Care / CSKH access** — `Permission`, `MedicalCase`, `FollowUp`

Vai trò Chăm sóc khách hàng (Care/CSKH) được xem ngữ cảnh follow-up và ngữ cảnh kinh doanh trong phạm vi được cấp quyền (ví dụ healthcare.followup.view/write), nhưng chi tiết lâm sàng có thể bị giới hạn. Phải tồn tại cơ chế giới hạn chi tiết lâm sàng cho vai trò này ở tầng server (permission-gated field/section), không dựa vào việc ẩn ở UI.

**LXXX. Healthcare permission registry** — `Permission`

Mở rộng ĐÚNG hệ thống Permission canonical đã có (không tạo hệ quyền song song cho healthcare). Đăng ký các permission key ứng viên: healthcare.case.view, healthcare.case.create, healthcare.case.update, healthcare.consultation.view, healthcare.consultation.write, healthcare.consultation.finalize, healthcare.procedure.view, healthcare.procedure.manage, healthcare.procedure.complete, healthcare.consent.view, healthcare.consent.manage, healthcare.photo.view, healthcare.photo.upload, healthcare.photo.manage, healthcare.followup.view, healthcare.followup.write. Nguyên tắc: giữ registry ở mức quản lý được (keep manageable) - không bung nở thêm quyền chi tiết ngoài danh sách này nếu không có lý do rõ ràng.

**LXXXI. Clinical privilege khác System permission** — `Permission`, `Procedure`

Phân biệt rõ: quyền hệ thống (ví dụ healthcare.procedure.manage) KHÔNG đồng nghĩa với chứng chỉ/đặc quyền lâm sàng (clinical credentialing) cho từng loại thủ thuật. KHÔNG xây credential engine đầy đủ ở giai đoạn này. Kiến trúc phải để ngỏ điểm mở rộng (policy/authorization hook ở đường thực hiện Procedure) để sau này gắn chính sách hạn chế theo loại thủ thuật mà không phải viết lại tầng permission.

**LXXXII. Case access model** — `MedicalCase`, `Company`, `Permission`

Mô hình truy cập MedicalCase khởi điểm = Company scope + Permission (giống Core). KHÔNG xây row-level ACL phổ quát cho mọi Case khi chưa có bằng chứng nhu cầu. Chỉ khi yêu cầu bảo mật lâm sàng thực sự đòi hỏi giới hạn theo care-team thì mới triển khai scope hạn chế có mục tiêu (targeted), áp cho đúng phạm vi cần, không áp toàn hệ thống.

**LXXXIII. Care team (MedicalCaseMember)** — `MedicalCaseMember`, `MedicalCase`, `User`

Có thể (possible, chưa bắt buộc) bổ sung model MedicalCaseMember để mô tả ê-kíp chăm sóc, chỉ triển khai nếu use case/legacy thực sự yêu cầu. Nếu triển khai: role enum gồm PRIMARY_DOCTOR, NURSE, ASSISTANT, CARE_COORDINATOR; mục đích là hỗ trợ mô hình truy cập hạn chế theo ê-kíp (targeted scope ở LXXXII).

**LXXXIV. Case member khác Company membership** — `MedicalCaseMember`, `CompanyMembership`, `MedicalCase`, `User`

CompanyMembership là điều kiện tiên quyết: một User chỉ có thể được thêm làm MedicalCaseMember khi đã có CompanyMembership tường minh trên đúng Company sở hữu Case đó. Case team là phép gán HẸP HƠN membership, không bao giờ thay thế hay tự động tạo ra membership, và không tự cấp quyền vượt permission pack của membership.

**LXXXV. Cross-company case - cấm tuyệt đối** — `MedicalCase`, `Customer`, `Company`

KHÔNG BAO GIỜ cho phép Case thuộc Company A gắn với Customer thuộc Company B. Ràng buộc MedicalCase.companyId phải khớp Customer.companyId, enforce ở cả tầng domain/service lẫn schema/constraint DB, kèm test cố tình vi phạm phải bị từ chối.

**LXXXVI. Cross-company clinician - cấm tuyệt đối** — `User`, `CompanyMembership`, `MedicalCase`, `Company`

KHÔNG BAO GIỜ cho phép clinician của Company B được gán vào / truy cập bản ghi lâm sàng của Company A. Mọi hành động trên Case phải kiểm CompanyMembership trên đúng Company của Case, kể cả khi thao tác đi qua AI hoặc tác vụ nền.

**LXXXVII. Cross-company photo - cấm tuyệt đối** — `Photo`, `MedicalCase`, `Company`

KHÔNG BAO GIỜ cho phép ảnh lâm sàng (clinical photo) của Company này gắn/hiển thị trong ngữ cảnh Company khác. Photo.companyId phải khớp companyId của Case/Customer chứa nó; URL/asset cũng phải kiểm quyền theo Company khi phục vụ, không chỉ kiểm ở query.

**LXXXVIII. Cross-company material - cấm tuyệt đối** — `Material`, `Procedure`, `Company`, `Inventory`

KHÔNG BAO GIỜ cho phép vật tư/material của Company này được tiêu thụ hay tham chiếu bởi Procedure/Case của Company khác. Kiểm companyId khớp khi ghi nhận sử dụng vật tư trong thủ thuật.

**LXXXIX. Cross-company appointment - giữ nguyên chặn của Core** — `Appointment`, `MedicalCase`, `Company`

Việc chặn Appointment xuyên Company đã được Core (Phần 3-6) thực thi. Tích hợp Healthcare (gắn Appointment với MedicalCase/Procedure/consultation) KHÔNG được làm suy yếu hay bỏ qua ràng buộc này - mọi đường đi mới từ healthcare tới Appointment phải đi qua đúng company scope hiện có, không tự viết truy vấn bỏ qua guard.

**XC. Healthcare company module** — `Company`, `Module`

Company phải có khả năng bật (enable) module Healthcare / Aesthetics, ĐIỀU KIỆN là kiến trúc Module hỗ trợ. Tức là healthcare là vertical bật/tắt theo từng Company chứ không mặc định bật cho mọi Company; khi module chưa bật, các entity/route healthcare không được xuất hiện với Company đó. (Lưu ý: mục này bị cắt ở cuối dải 1803-2010, phần mô tả tiếp theo nằm ngoài phạm vi đọc.)

### module-parity-journey — spec dòng 2004–2335 (20 yêu cầu)

**XC. Healthcare Company Module** — `Company`, `Module`, `HealthcareModule`

Them mot module "Healthcare / Aesthetics" ma tung Company co the bat/tat, dua tren co che Module architecture da co san cua nen tang (Phan 3-6). Trang thai bat module la du lieu cau hinh cua Company (per-tenant flag/record), KHONG phai co che cai dat plugin dong: khong tai code runtime, khong dang ky plugin luc chay, khong sinh schema moi khi bat module. Toan bo code Healthcare da nam san trong codebase, module flag chi quyet dinh no co duoc lo ra cho Company do hay khong.

**XCI. Module Enablement — hieu ung khi bat module** — `Company`, `Module`, `Permission`, `PermissionPreset`, `Navigation`, `Route`, `CompanyAI`

Khi Company bat module Healthcare, he thong duoc phep lam dung 4 viec: (1) hien thi navigation Healthcare trong UI cua Company do; (2) mo (expose) cac route healthcare cho Company do; (3) kich hoat cac permission preset healthcare (preset quyen dinh nghia san, gan vao permission registry/resolver da co); (4) sau nay moi bat Company AI healthcare context — hang muc (4) la defer, khong implement trong pham vi nay. Viec bat/tat module TUYET DOI khong duoc thay doi kien truc tenant: khong doi cach resolve Company context, khong doi rang buoc CompanyMembership, khong doi cach cach ly du lieu giua cac Company.

**XCII. Company Type HEALTHCARE** — `Company`, `CompanyType`, `Module`

Company type = HEALTHCARE chi duoc dung nhu mot goi y (suggestion/default) rang module Healthcare nen duoc bat — vi du hien de xuat khi tao Company hoac bat mac dinh khi seed. Company Type KHONG duoc tu dong sinh, doi, hay ghi de schema; khong co nhanh code nao dieu kien hoa cau truc bang/model theo company type. Quan he: type goi y -> module enablement -> UI/route/permission; khong bao gio type -> schema.

**XCIII. Hong Phuc la Healthcare Company dau tien (fixture)** — `Company`, `CompanyType`, `Fixture`, `Seed`

Tao mot Company mau cho muc dich test/synthetic: ten "Benh vien Da khoa Hong Phuc", type = HEALTHCARE, dung lam target example de kiem chung luong Healthcare end-to-end. Day la du lieu fixture/seed cua moi truong dev, KHONG duoc import bat ky du lieu production that nao vao trong Phan 7.

**XCIV. Legacy data khong phai test data** — `Patient`, `Customer`, `Photo`, `Diagnosis`, `Finance`, `Payroll`

Cam sao chep vao dev DB cua target bat ky du lieu that nao tu he thong legacy, cu the: patients (benh nhan/khach hang that), medical photos (anh y khoa), diagnoses (chan doan), finance (tai chinh), payroll (luong). Quy trinh seed/fixture phai khong co buoc doc-ghi tu nguon du lieu that; neu can du lieu, phai sinh moi.

**XCV. Synthetic clinical fixtures** — `Fixture`, `Seed`, `Patient`, `Customer`

Toan bo du lieu lam sang dung de test phai la du lieu gia, viet bang tieng Viet (ten nguoi, dia chi, dich vu... theo ngu canh Viet Nam), va PHAI nhan dien duoc ro rang la synthetic (vi du co marker/prefix/quy uoc dat ten khien khong the nham voi du lieu that).

**XCVI. Legacy archaeology — cac domain bat buoc phai tra** — `CaseRecord`, `Customer`, `Consultation`, `Appointment`, `Procedure`, `Consent`, `Photo`, `FollowUp`, `Screening`, `Indication`, `Materials`, `Treatment`, `Doctor`, `Nurse`, `Care`, `Surgery`, `Medical`

Truoc khi thiet ke model/service/route Healthcare moi, phai search repo legacy ZenithTasks de tim CHINH XAC cac model/service/route dang ton tai xoay quanh cac domain sau: CaseRecord, Customer, Consultation, Appointment, Procedure, Consent, Photo, FollowUp, Screening, Indication, Materials, Treatment, Doctor, Nurse, Care, Surgery, Medical. Ket qua phai la ten thuc te doc duoc tu source code legacy; khong duoc coi cac ten trong spec la ten dung trong legacy va khong duoc suy dien ten model tu tri nho.

**XCVII. Legacy route archaeology** — `Customer`, `Appointment`, `CaseRecord`, `Consultation`, `Screening`, `Indication`, `Consent`, `Procedure`, `Photo`, `Materials`, `FollowUp`, `Payment`, `Care`, `Route`

Lap ban do (map) moi user journey quan trong cua Clinic trong legacy, gan voi ROUTE THUC TE doc tu source. Toi thieu phai bao phu cac journey: create customer, book appointment, open case, consult, screen, indicate, consent, procedure, photo, material use, follow-up, payment, care. Moi journey ghi ro route legacy tuong ung; khong tu bia route.

**XCVIII. Bang phan loai nang luc legacy** — `LegacyCapabilityMatrix`, `Capability`, `Route`, `Model`

Voi MOI capability legacy tim duoc, ghi mot dong trong bang phan loai gom du 11 cot: Legacy Capability, Legacy Route, Legacy Models, Business Purpose, Actual Usage Evidence, Generic or Healthcare?, Target Domain, Target Route, Salvage Decision, Parity Requirement, Migration Status. Cot "Actual Usage Evidence" phai dan chung thuc te (code/route/du lieu su dung), khong phai phong doan; cot "Generic or Healthcare?" quyet dinh nang luc do thuoc nen chung (Phan 3-6) hay thuoc vertical Healthcare.

**XCIX. Quyet dinh salvage: KEEP / ADAPT / REWRITE / MERGE** — `LegacyCapabilityMatrix`, `SalvageDecision`

Cot Salvage Decision chi duoc nhan mot trong bon gia tri thong nhat: KEEP, ADAPT, REWRITE, MERGE. Dung nhat quan tren toan bo bang; khong dung tu ngu tu do hay bien the khac.

**C. Khong co gi bien mat am tham** — `LegacyCapabilityMatrix`, `RetireRecord`

Neu mot tinh nang legacy khong duoc tai tao o target, PHAI ghi ro ban ghi RETIRE gom du ba phan: (1) ly do retire ("because ..."), (2) thu thay the ("replacement ..."), (3) cach xu ly du lieu khi migrate ("migration handling ..."). Khong duoc bo tinh nang bang cach im lang/khong nhac den.

**CI. Parity levels P0-P3** — `LegacyCapabilityMatrix`, `ParityLevel`

Phan loai moi capability legacy vao 4 muc parity: P0 = thiet yeu ve lam sang/an toan (clinical/safety); P1 = thiet yeu ve van hanh; P2 = huu ich; P3 = legacy gia tri thap. Muc parity la mot truong bat buoc trong bang phan loai va la co so uu tien thu tu implement.

**CII. Ung vien P0** — `CaseRecord`, `Consultation`, `Consent`, `Procedure`, `Photo`, `FollowUp`, `Materials`

Cac nang luc sau nhieu kha nang la P0 va phai duoc xem xet dau tien: case history, consultation, consent, procedure, critical clinical photos, follow-up, material usage trace. Day chi la danh sach ung vien — phan loai P0 cuoi cung phai dua tren bang chung tu source legacy, khong duoc coi danh sach nay la ket luan.

**CIII. UX parity khac screen parity** — `Consent`, `UX`, `Screen`

Khong tai tao tung man hinh cu cua legacy. Tieu chi parity la giu duoc job-to-be-done cua nguoi dung, khong phai giu so luong/hinh dang man hinh. Vi du chuan: legacy co 3 man hinh cho consent, target duoc phep gop thanh 1 flow tot hon mien la cong viec consent van hoan thanh duoc.

**CIV. Data parity khac column parity** — `LegacyCapabilityMatrix`, `DataMigration`

Moi "meaningful fact" (du kien nghiep vu co y nghia) trong legacy phai co dich den (destination) trong mo hinh du lieu target. Nguoc lai, KHONG phai moi cot legacy deu can duoc mang sang: cot vo nghia/trung lap/rac duoc phep bo, nhung phai the hien trong bang phan loai (Parity Requirement / Migration Status).

**CV. Legacy clinic workflows** — `Customer`, `Appointment`, `Consultation`, `CaseRecord`, `Screening`, `Consent`, `Procedure`, `FollowUp`

Xac dinh chinh xac cac luong end-to-end that cua phong kham tu source legacy. Luong tham chieu (vi du, khong phai luat): CUSTOMER -> APPOINTMENT -> CONSULTATION -> CASE -> SCREENING -> CONSENT -> PROCEDURE -> FOLLOW-UP. Khong duoc gia dinh moi dich vu deu chay dung thu tu nay; thu tu that phai lay tu source.

**CVI. Bien thien theo tung dich vu** — `Service`, `Consultation`, `Procedure`, `Consent`, `Materials`, `ClinicalJourney`

Workflow healthcare khac nhau theo tung loai dich vu. He thong phai cho phep mot dich vu chi-tu-van (consultation-only) hoan tat ma KHONG bat buoc phai co procedure, consent, hay material usage. Cam thiet ke mot wizard khong lo ap dung chung cho moi dich vu.

**CVII. Clinical journey model** — `ClinicalJourney`, `Stage`

Mo hinh hanh trinh lam sang phai la cac stage TUONG MINH (explicit, dinh nghia trong code/schema, doc duoc, kiem tra duoc) nhung linh hoat (mot journey co the bo qua stage khong ap dung). Khong xay dung mot workflow DSL tong quat/engine cau hinh workflow bang du lieu.

**CVIII. Procedure readiness** — `Procedure`, `ProcedureReadiness`, `ClinicalJourney`

Cung cap ham tinh readiness cho procedure: dau vao la tap dieu kien bat buoc (required conditions) cua ca/dich vu do, dau ra la trang thai san sang (readiness). Logic phai viet bang code deterministic — cung mot input trang thai luon cho cung mot ket qua, khong phu thuoc AI/random/thoi diem goi; phai co test cho ca ready va not-ready.

**CIX. Procedure readiness check — dieu kien vi du** — `Procedure`, `ProcedureReadiness`, `Consent`

Ket qua readiness phai liet ke duoc cac ly do chua san sang cu the, vi du: thieu consent bat buoc (required consent missing). (Doan spec bi cat tai dong 2335 — danh sach dieu kien day du nam ngoai dai duoc phan cong, phai doc tiep truoc khi chot tap dieu kien.)

### ai-audit-privacy — spec dòng 2318–2660 (32 yêu cầu)

**CVIII. PROCEDURE READINESS** — `ProcedureRecord`, `ProcedureReadiness`, `RequiredCondition`, `MedicalCase`

Phai co ham/service tinh 'procedure readiness' cua mot ca thu thuat: input la tap 'required conditions' cua thu thuat do, output la trang thai readiness (san sang / chua san sang + danh sach dieu kien con thieu). Logic tinh phai la code deterministic (cung input => cung output, khong random, khong goi model), dat trong domain layer va co unit test phu cac to hop dieu kien.

**CIX. PROCEDURE READINESS CHECK** — `Consent`, `Screening`, `ProcedureReadiness`, `ProcedureRecord`

Bo dieu kien kiem tra readiness phai gom it nhat cac case: (1) consent bat buoc chua co / chua ky (required consent missing); (2) screening bat buoc chua hoan tat (required screening incomplete). Moi dieu kien tra ve ma loi/ly do doc duoc de UI hien 'con thieu gi'. Tuyet doi khong de LLM quyet dinh ket qua check nay.

**CX. AI DOES NOT AUTHORIZE PROCEDURE** — `ProcedureRecord`, `AIAssistant`, `Permission`, `AuditEvent`

AI chi duoc phep: tom tat cac buoc con thieu va sinh checklist chuan bi. AI khong duoc phat sinh authorization cho thu thuat. Quyen cho phep thuc hien thu thuat thuoc ve con nguoi/policy: buoc chuyen sang trang thai 'duoc phep thuc hien' phai do actor nguoi dung co quyen thuc hien, khong co code path nao cho AI tu set trang thai do.

**CXI. AI DOES NOT DIAGNOSE AUTONOMOUSLY** — `Diagnosis`, `ProcedureIndication`, `ConsultationRecord`, `AIAssistant`

AI chi duoc summarize du lieu clinical da ton tai. Khong duoc co code path nao cho phep AI tao/ghi diagnosis hoac procedure indication moi mot cach im lang; moi diagnosis/indication phat sinh tu AI phai di qua workflow do clinician kiem soat (clinician xem va xac nhan) truoc khi tro thanh du lieu chinh thuc. Phan nang luc summarize chi tiet thuoc Phan 8.

**CXII. HIGH-RISK CLINICAL WRITE** — `Diagnosis`, `ProcedureIndication`, `ProcedureRecord`, `Consent`, `ClinicalCorrection`, `AuditEvent`, `Permission`

Dinh nghia tap 'high-risk clinical write' gom it nhat: final diagnosis, procedure indication, procedure completion, consent state (ky/void), clinical correction. Moi write nay phai co: actor xac dinh duoc, permission check tuong ung, va audit record. LUU Y: khong ap dat co che two-person approval (dual control) nhu ben Finance — clinical workflow khac finance; mac dinh la mot actor co quyen + audit day du.

**CXIII. CLINICAL HUMAN-IN-THE-LOOP** — `ConsultationRecord`, `AIDraft`, `Clinician`, `AuditEvent`

Mo hinh du lieu clinical phai tach hai trang thai: ban nhap do AI sinh (AI draft) va ban duoc clinician xac nhan. AI duoc phep tao draft; de ban ghi tro thanh ho so chuyen mon hop le bat buoc phai co buoc clinician (nguoi) confirm, luu lai ai confirm va luc nao.

**CXIV. AI GENERATED CLINICAL TEXT** — `ConsultationRecord`, `AIDraft`, `AIGeneratedText`

Neu ve sau AI soan noi dung phieu tu van, noi dung do phai duoc danh dau ro la draft/evidence (co field/flag phan biet, hien thi ro tren UI), khong duoc tron lan voi noi dung da chot. Nguoi (clinician) la nguoi finalize. Chi tiet co che nay de sang Phan 8 — Phan 7 chi can chua san cho danh dau draft, khong implement AI soan thao.

**CXV. MEDICAL SAFETY** — `AIRecommendation`, `MedicalOrder`, `ConsultationRecord`, `Clinician`

He thong khong duoc trinh bay khuyen nghi do AI sinh nhu mot y lenh/medical order da chot khi chua co xac nhan cua clinician co tham quyen. Rang buoc nay ap dung o ca tang UI (nhan/badge, wording) lan tang du lieu (trang thai draft vs finalized).

**CXVI. CLINICAL DATA SOURCES** — `ConsultationRecord`, `ProcedureRecord`, `Consent`, `Screening`, `FollowUp`, `AISummary`

Nguon du lieu clinical canonical gom dung 5 loai: Consultation record, Procedure record, Consent, Screening, Follow-up. Moi output cua AI (tom tat, checklist...) la du lieu derived — khong duoc ghi de len canonical record, khong duoc dung lam nguon su that; phai luu/tham chieu ve canonical record goc.

**CXVII. HEALTHCARE AUDIT** — `AuditEvent`, `ConsultationRecord`, `Consent`, `ProcedureRecord`, `ClinicalPhoto`, `ClinicalCorrection`, `MaterialUsage`, `FollowUp`

Phai ghi audit manh (khong bo sot) cho cac su kien: consultation finalized; consent signed; consent voided; procedure performed; clinical photo added; clinical photo removed; clinical correction; material usage; follow-up closed. Moi su kien luu actor, thoi diem, doi tuong lien quan.

**CXVIII. CLINICAL AUDIT LANGUAGE** — `AuditEvent`, `AuditMessageTemplate`

Audit clinical phai hien thi bang ngon ngu nghiep vu doc duoc, khong chi la raw DB diff. Mau mong doi: 'BS A da hoan tat phieu tu van luc 10:32.' Tuc moi loai su kien audit can co template mo ta tieng Viet gan actor + hanh dong + thoi diem.

**CXIX. TECHNICAL AUDIT** — `AuditEvent`, `RecordVersion`

Ben canh ban mo ta nghiep vu, audit ky thuat duoc phep luu ID va version metadata (id ban ghi, version/revision) de truy nguoc — day la kenh audit rieng, khong thay the ban business-readable.

**CXX. CLINICAL RECORD CORRECTION** — `ClinicalCorrection`, `ConsultationRecord`, `ProcedureRecord`, `AuditEvent`

Sua mot ban ghi clinical da final bat buoc kem: (1) reason (ly do sua, bat buoc nhap); (2) actor; (3) timestamp; (4) dau vet old/new hoac addendum. Khong cho phep sua im lang ghi de len ban final.

**CXXI. NO HARD DELETE FINALIZED CLINICAL RECORD** — `ConsultationRecord`, `ProcedureRecord`, `Consent`, `ClinicalRecord`

Mac dinh tu choi (default deny) moi thao tac hard delete tren ban ghi clinical da finalized. Khong expose API/route nao cho phep xoa vat ly ban ghi clinical da chot.

**CXXII. DATA RETENTION** — `ClinicalRecord`, `RetentionPolicy`

Khong hardcode/bia ra thoi han luu tru phap ly cu the khi chua co yeu cau phap luat da xac minh. Kien truc phai chua cho de gan retention policy ve sau (vi du: cac ban ghi clinical co the gan policy luu tru/expiry ma khong phai doi schema lon).

**CXXIII. PRIVACY** — `PHI`, `AccessControl`

Du lieu healthcare la du lieu nhay cam cao. Moi bug lien quan den access control (lo du lieu sai nguoi/sai Company) phai duoc xu ly o muc uu tien P0 — can quy uoc phan loai nay trong quy trinh va co test bao ve duong access.

**CXXIV. PII / PHI LOGGING** — `Logger`, `PHI`, `ClinicalPhoto`, `Diagnosis`

Cam ghi vao technical log thong thuong: noi dung chan doan day du, anh clinical, ghi chu y khoa, du lieu dinh danh ca nhan. Phai co ra soat cac diem logging (server log, error tracking) de dam bao khong roi PHI vao day.

**CXXV. ERROR LOGGING** — `Logger`, `AuditEvent`

Log loi chi duoc dung ID va metadata an toan (record id, company id, ma loi, timestamp) thay vi noi dung clinical, du de debug ma khong lo PHI.

**CXXVI. EXPORT** — `ClinicalExport`, `PDF`, `Permission`

Moi export du lieu clinical phai duoc authorize o phia server tai thoi diem export. Cam sinh link PDF cong khai khong bao ve (public/unsigned) cho tai lieu clinical.

**CXXVII. PRINT** — `Consent`, `CaseSummary`, `PrintableView`

Neu nghiep vu legacy can in phieu consent / tom tat ca benh, duoc phep lam printable view an toan (view co kiem soat quyen). Khong can va khong nen xay dung document engine day du tru khi co yeu cau ro rang.

**CXXVIII. FILE DOWNLOAD** — `ClinicalFile`, `ClinicalPhoto`, `Permission`

Kiem tra quyen phai chay tai thoi diem download file, khong chi kiem tra luc render trang. Endpoint tra file clinical phai tu resolve actor + Company + quyen truoc khi stream noi dung.

**CXXIX. SEARCH** — `Search`, `Company`, `Permission`, `MedicalCase`

Chuc nang search trong pham vi healthcare phai ap dong thoi rang buoc Company scope va healthcare permission cua actor; ket qua tra ve khong duoc chua ban ghi ma actor khong co quyen doc.

**CXXX. GLOBAL SEARCH** — `Search`, `Ecosystem`, `Company`, `MedicalCase`, `Permission`

Search cap Company binh thuong duoc tra ve Case/customer theo quyen cua actor trong Company do. Search cap Founder/Ecosystem KHONG duoc tu dong lo noi dung clinical cua tat ca Company — muon thay noi dung clinical xuyen Company phai co quyen healthcare tuong minh.

**CXXXI. FOUNDER VS CLINICAL ACCESS** — `Founder`, `EcosystemMembership`, `PHI`, `Permission`

Kien truc khong duoc gia dinh FOUNDER = READ ALL PHI. Founder co tham quyen van hanh (operational authority) nhung chinh sach truy cap clinical/privacy la mot lop rieng: muon doc clinical note phai co quyen healthcare cap tuong minh, khong suy ra tu role Ecosystem.

**CXXXII. ECOSYSTEM AI VS CLINICAL DATA** — `EcosystemAI`, `ClinicalRecord`, `AIScope`, `Permission`

Ecosystem AI khong duoc tu dong nap (ingest) toan bo ho so y te. Muon AI truy cap du lieu clinical phai co scope/policy tuong minh, kiem tra server-side truoc khi cap du lieu.

**CXXXIII. COMPANY AI** — `CompanyAI`, `AICapability`, `Permission`

AI cua Company thuoc linh vuc healthcare duoc phep co cac capability healthcare, nhung moi capability van phai chay qua permission check cua actor dang goi — khong co capability nao bypass permission.

**CXXXIV. AI DATA MINIMIZATION** — `AITool`, `Appointment`, `ClinicalHistory`

Chi gui cho AI luong du lieu toi thieu du cho tac vu. Vi du: neu tac vu chi can so luong lich hen thi chi gui con so do, khong gui toan bo benh su/clinical history. Cac AI tool phai dinh nghia ro payload toi thieu.

**CXXXV. AI TOOL SCOPING** — `AITool`, `Company`, `Customer`, `MedicalCase`, `Permission`

Moi healthcare AI tool phai resolve o server-side: Company, Customer, MedicalCase va quyen cua actor — truoc khi doc/ghi bat ky du lieu nao. Khong nhan scope tu client lam co so tin cay.

**CXXXVI. NO CLIENT PHI AUTHORITY** — `MedicalCase`, `Customer`, `Permission`, `API`

Client gui ID truc tiep (caseId, customerId, photoId...) khong dong nghia duoc quyen truy cap; server luon phai kiem tra membership/permission cho tung ID truoc khi tra du lieu.

**CXXXVII. CLINICAL CACHE** — `Cache`, `Company`, `Permission`, `PHI`

Moi lop cache co lien quan du lieu clinical phai co khoa cache bao gom Company va ngu canh permission cua actor. Cam dung cache dung chung khien PHI cua actor/Company nay lo sang actor/Company khac.

**CXXXVIII. FILE CACHE / CDN** — `ClinicalPhoto`, `CDN`, `FileStorage`

File clinical (dac biet anh clinical) phai private. Khong duoc dung URL asset CDN cong khai cho anh clinical neu khong co chien luoc authorization di kem.

**CXXXIX. TEST PERSONAS** — `TestPersona`, `Founder`, `HealthcareCompanyAdmin`

Phai co bo test persona tong hop (synthetic, khong dung du lieu that) de test phan quyen healthcare; danh sach bat dau bang Founder va HealthcareCompanyAdmin (danh sach con tiep sau dong 2660, ngoai dai duoc giao).

### tests — spec dòng 2653–3012 (46 yêu cầu)

**CXXXIX. Test personas (synthetic)** — `User`, `CompanyMembership`, `EcosystemMembership`, `TestFixture`

Seed dữ liệu test phải tạo đủ 11 synthetic persona dùng chung cho toàn bộ test suite Healthcare: Founder, HealthcareCompanyAdmin, DoctorA, DoctorB, NurseA, ReceptionA, CareA, FinanceA, EmployeeA, MemberB, Outsider. Đây là persona tổng hợp (synthetic), không dùng dữ liệu thật. Mỗi persona là một User + membership/position tương ứng để test có thể đăng nhập và thực hiện server action dưới đúng danh tính đó. Outsider = user không có membership ở company đang test; MemberB = member của company khác (dùng cho test cross-company).

**CXL. Test companies** — `Company`, `Ecosystem`, `CompanyModule`, `TestFixture`

Seed test phải tạo 3 company: (1) Healthcare Company A — company có module Healthcare bật; (2) General Company B — company KHÔNG bật module Healthcare; (3) Healthcare Company C nằm trong Ecosystem khác. Bộ 3 này là nền cho mọi test module-gating và cross-tenant/cross-ecosystem.

**CXLI. Module test — company không bật Healthcare** — `CompanyModule`, `Navigation`, `HealthcareRoute`

Với General Company B: navigation/UI không được hiển thị bất kỳ mục Healthcare nào. Ngoài ra, gọi thẳng route Healthcare (bỏ qua UI) trong context Company B phải trả về deny / not available — không được render, không được trả dữ liệu. Test phải kiểm cả 2 lớp: navigation và direct route.

**CXLII. Case create test** — `MedicalCase`, `Doctor`, `Reception`, `Permission`

User được ủy quyền (Doctor hoặc Reception, tùy theo policy đang cấu hình) tạo MedicalCase trong Healthcare Company A phải PASS. Test phải chạy dưới cả DoctorA và ReceptionA theo policy hiện hành.

**CXLIII. Case cross-company customer** — `MedicalCase`, `Customer`, `Company`

Tạo MedicalCase trong Company A nhưng trỏ customerId thuộc Company B phải FAIL (deny ở server, không tạo record).

**CXLIV. Case cross-company clinician** — `MedicalCase`, `Clinician`, `Company`

Tạo/gán MedicalCase trong Company A với clinician (bác sĩ/điều dưỡng) thuộc Company B phải FAIL.

**CXLV. Case archive/close** — `MedicalCase`, `AuditLog`, `History`

Sau khi archive hoặc close một MedicalCase, toàn bộ lịch sử (history) của case vẫn còn nguyên — không bị xóa, không bị mất truy vết. Test phải assert history/audit trail vẫn đọc được sau khi close/archive.

**CXLVI. Consultation create** — `Consultation`, `Permission`

Chỉ user được ủy quyền mới tạo được Consultation. Test phải có case positive (user authorized tạo thành công) và negative (user không có quyền bị deny).

**CXLVII. Consultation finalize** — `Consultation`, `Clinician`, `Permission`

Chỉ đúng clinician phù hợp (appropriate clinician) mới được finalize Consultation. Clinician khác / non-clinician phải bị deny. Test phải chạy với DoctorA (owner) PASS và DoctorB / NurseA / ReceptionA theo policy.

**CXLVIII. Consultation final mutation** — `Consultation`, `Addendum`, `AuditLog`

Sau khi Consultation đã finalize, mọi thay đổi phải đi qua cơ chế có kiểm soát (controlled) hoặc addendum — không được sửa trực tiếp đè lên nội dung đã finalize. Test phải chứng minh: sửa trực tiếp bị chặn, và addendum tạo bản ghi mới giữ nguyên bản gốc.

**CXLIX. Reception clinical note test** — `Reception`, `Consultation`, `Permission`

Nếu policy quy định Reception không được sửa Consultation thì ReceptionA phải bị deny khi cố sửa clinical note của Consultation — kiểm ở tầng server action, không chỉ ẩn nút.

**CL. Nurse permission test** — `Nurse`, `Permission`, `ClinicalAction`

NurseA chỉ thực hiện được đúng tập clinical action được phép; mọi action clinical ngoài tập đó phải bị deny. Test phải liệt kê rõ tập action allowed vs denied cho vai trò Nurse.

**CLI. Doctor finance test** — `Doctor`, `Finance`, `Permission`

Bác sĩ không có quyền Finance thì không mở/đọc được dữ liệu Finance (deny ở server, không chỉ ẩn UI).

**CLII. Finance clinical test** — `FinanceUser`, `Consultation`, `MedicalRecord`, `Permission`

User Finance không có quyền Healthcare thì không đọc được medical note (clinical content). Deny ở server.

**CLIII. Appointment test** — `Appointment`, `Customer`, `MedicalCase`, `Reception`

ReceptionA tạo được Appointment generic (module Appointment nền của Phần 3-6) gắn với Customer, và healthcare context được link vào Appointment một cách an toàn (không phá cấu trúc nền, không rò dữ liệu cross-module).

**CLIV. Appointment cross-company** — `Appointment`, `Company`

Tạo/gắn Appointment với entity thuộc company khác phải FAIL.

**CLV. Procedure test (happy path)** — `Procedure`, `Readiness`, `AuditLog`

Luồng đầy đủ phải chạy được: tạo Procedure ở trạng thái planned → hoàn tất các điều kiện readiness bắt buộc → perform (thực hiện) → sinh audit record. Test assert đủ 4 bước, đặc biệt là audit trail sau khi perform.

**CLVI. Procedure without consent** — `Procedure`, `Consent`

Nếu Procedure được chọn thuộc loại yêu cầu consent mà chưa có consent hợp lệ thì perform phải FAIL.

**CLVII. Procedure without screening** — `Procedure`, `Screening`, `Policy`

Nếu policy yêu cầu screening trước procedure mà chưa có screening thì perform phải FAIL.

**CLVIII. Procedure wrong clinician company** — `Procedure`, `Clinician`, `Company`

Thực hiện Procedure với clinician thuộc company khác phải FAIL.

**CLIX. Procedure complete twice** — `Procedure`, `Idempotency`, `InventoryTransaction`

Gọi complete Procedure hai lần phải an toàn: hoặc idempotent (lần 2 không tạo side-effect mới), hoặc fail-safe (lần 2 bị từ chối). Tuyệt đối không được double side-effect (ví dụ trừ kho 2 lần, tạo 2 audit hoàn tất).

**CLX. Procedure after case closed** — `Procedure`, `MedicalCase`, `Reopen`

Thực hiện Procedure trên MedicalCase đã closed: mặc định FAIL, trừ khi case được reopen theo cơ chế tường minh.

**CLXI. Consent test** — `Consent`, `ConsentTemplate`, `Version`

Consent phải lưu và giữ nguyên template + version tại thời điểm ký. Sửa/đổi template về sau không được làm thay đổi nội dung consent đã ký. Test assert đọc lại consent cũ vẫn ra đúng template/version gốc.

**CLXII. Consent cross case** — `Consent`, `MedicalCase`, `Company`

Không được gắn Consent vào case/entity thuộc Company sai — attach cross-company phải bị từ chối.

**CLXIII. Consent void** — `Consent`, `AuditLog`

Void một Consent bắt buộc phải kèm reason và ghi audit. Void không có reason phải bị từ chối.

**CLXIV. Photo upload** — `ClinicalPhoto`, `FileStorage`, `Metadata`, `Permission`

Ảnh lâm sàng phải được lưu như private file (không public), có metadata đi kèm, và chỉ user được ủy quyền mới truy cập được. Test assert cả 3 thuộc tính.

**CLXV. Photo direct URL attack** — `ClinicalPhoto`, `FileStorage`, `Permission`

User không được ủy quyền truy cập thẳng URL file ảnh (bỏ qua UI) phải không lấy được nội dung — kiểm bằng test gọi trực tiếp URL/endpoint file.

**CLXVI. Photo cross-company** — `ClinicalPhoto`, `Company`

Truy cập photo thuộc company khác phải FAIL.

**CLXVII. Photo delete/void** — `ClinicalPhoto`, `AuditLog`

Xóa/void ảnh lâm sàng phải qua cơ chế có kiểm soát (controlled) — không cho hard delete tự do.

**CLXVIII. Follow-up test** — `Procedure`, `FollowUpPlan`, `Work`, `Appointment`

Từ một Procedure phải tạo được follow-up plan, và follow-up plan sinh ra Work item và/hoặc Appointment trên module nền. Test assert chuỗi link Procedure → follow-up plan → Work/Appointment.

**CLXIX. Follow-up clinical record** — `FollowUpPlan`, `Clinician`, `ClinicalRecord`

Clinician ghi được kết quả (outcome) của follow-up như một clinical record riêng.

**CLXX. Follow-up: work completion ≠ clinical completion** — `Work`, `FollowUpPlan`, `ClinicalRecord`

Hoàn tất Work/task nhắc việc KHÔNG được tự động sinh ra hay suy diễn kết luận lâm sàng. Test: complete Work item của follow-up rồi assert không có clinical assessment/outcome nào được tạo tự động; clinical outcome chỉ tồn tại khi clinician ghi tường minh.

**CLXXI. Material usage test** — `Procedure`, `InventoryItem`, `InventoryTransaction`

Procedure sử dụng vật tư phải làm tồn kho giảm đúng MỘT lần cho mỗi lần sử dụng. Test assert số lượng tồn giảm chính xác, không double.

**CLXXII. Material cross company** — `Procedure`, `InventoryItem`, `Company`

Dùng InventoryItem thuộc company khác cho Procedure phải FAIL.

**CLXXIII. Material insufficient stock** — `InventoryItem`, `InventoryPolicy`, `Procedure`

Khi tồn kho không đủ, hành vi phải tuân theo policy của module Inventory đã có ở Phần 3-6 (không tự chế policy mới trong Healthcare). Tuyệt đối không được để tồn kho âm một cách âm thầm (no silent negative).

**CLXXIV. Material correction** — `InventoryTransaction`, `Reversal`, `AuditLog`

Phải có đường sửa sai: reversal giao dịch vật tư hoạt động đúng (hoàn lại tồn kho, có audit). Test assert tồn kho về đúng giá trị trước đó sau reversal.

**CLXXV. Sale / procedure test** — `Sale`, `Procedure`, `ClinicalRecord`

Dịch vụ đã bán (Sale) có thể link tới Procedure. Nhưng thay đổi giá trên Sale về sau KHÔNG được làm thay đổi clinical record đã ghi. Test: link Sale-Procedure, đổi giá Sale, assert clinical record bất biến.

**CLXXVI. Payment test** — `Payment`, `Clinician`, `Permission`

Nhân viên lâm sàng (doctor/nurse) không được sửa payment trừ khi có permission finance tường minh. Deny ở server.

**CLXXVII. Suspended company** — `Company`, `CompanyStatus`, `ClinicalWrite`, `EmergencyReadPolicy`

Company ở trạng thái suspended: không cho phép bất kỳ clinical write mới nào. Nếu cần cho phép đọc trong tình huống khẩn cấp thì chính sách đó phải tường minh (explicit policy, có kiểm soát và audit). Không được tự phát minh cơ chế emergency bypass âm thầm trong code.

**CLXXVIII. Archived company** — `Company`, `CompanyStatus`, `Founder`, `CompanyAdmin`

Company đã archived: chỉ read-only theo đúng quy tắc founder/admin đã định; không cho phép bất kỳ clinical operation nào.

**CLXXIX. Membership revoked** — `CompanyMembership`, `HealthcareAccess`, `Session`

Khi CompanyMembership bị thu hồi, quyền truy cập Healthcare của user đó phải mất hiệu lực NGAY LẬP TỨC. Test: revoke rồi gọi lại server action healthcare bằng session cũ → deny.

**CLXXX. Position change** — `Position`, `Session`, `ClinicalWrite`

Khi position Doctor kết thúc, user đó không được tiếp tục clinical write nhờ session cũ (stale session). Test: kết thúc position, dùng session đang mở gọi clinical write → deny.

**CLXXXI. Professional permission change** — `ProfessionalPermission`, `PermissionResolver`, `Session`

Thay đổi professional permission phải có hiệu lực thực tế ngay trên hành vi authorization (không bị cache cũ giữ lại quyền). Test: đổi permission → hành vi allow/deny thay đổi tương ứng.

**CLXXXII. Direct server action test** — `ServerAction`, `TestSuite`, `Authorization`

Mọi critical action (case, consultation, procedure, consent, photo, material, payment...) phải được test bằng cách gọi thẳng server action/route, KHÔNG dựa vào việc UI ẩn nút. Ẩn control ở UI không được tính là kiểm soát an ninh.

**CLXXXIII. ID injection matrix** — `Customer`, `MedicalCase`, `Consultation`, `Appointment`, `Procedure`, `Consent`, `ClinicalPhoto`, `InventoryItem`, `ClinicianUser`

Phải có ma trận test tấn công bằng cách truyền ID thuộc Company B vào request trong context Company A, phủ đủ 9 loại ID: customerId, medicalCaseId, consultationId, appointmentId, procedureId, consentId, photoId, inventoryItemId, clinicianUserId. Tất cả các trường hợp đều phải DENY (không rò dữ liệu, không ghi được, không leak sự tồn tại).

**CLXXXIV. Browser journey — Reception (bắt đầu)** — `Reception`, `BrowserTest`, `Login`

Phải có browser journey test end-to-end cho vai trò Reception, bắt đầu bằng bước Login. LƯU Ý: mục này bị cắt ở cuối dải được giao (dòng 3012) — các bước còn lại của journey nằm ngoài dải, cần agent phụ trách dải kế tiếp bổ sung.

### ux-integration-migration — spec dòng 3010–3670 (55 yêu cầu)

**CLXXXIV. Browser Journey — Reception** — `User/Session`, `Customer`, `Appointment`

Phải có luồng đi được bằng trình duyệt cho vai trò Lễ tân, đúng thứ tự: Login → màn hình Customer → tạo mới hoặc tìm khách hàng đã có → đặt lịch hẹn (book appointment) → check-in / mở context của lượt khám. Mỗi bước phải là một trang/hành động thật click được, không phải mock; điểm bắt đầu là đăng nhập chứ không phải deep-link.

**CLXXXV. Browser Journey — Doctor** — `Today`, `Appointment`, `Customer`, `MedicalCase`, `Consultation`, `WorkItem/FollowUp`

Phải có luồng đi được bằng trình duyệt cho vai trò Bác sĩ, đúng thứ tự: Today → chọn appointment → mở customer → mở medical case → thực hiện consultation → finalize note (chốt ghi chép, chuyển khỏi trạng thái draft) → plan next step (tạo bước kế tiếp: tái khám/thủ thuật/follow-up). Điểm vào là Today, không phải danh sách bệnh nhân.

**CLXXXVI. Browser Journey — Procedure Team** — `MedicalCase`, `ProcedureReadiness`, `Consent`, `Procedure`, `MaterialUsage`, `FollowUp`

Phải có luồng đi được bằng trình duyệt cho đội thủ thuật, đúng thứ tự: mở Case → kiểm tra readiness (sẵn sàng làm thủ thuật) → xem consent evidence (bằng chứng đồng ý) → thực hiện procedure → ghi material usage (vật tư đã dùng) → complete → tạo follow-up plan. Bước consent evidence phải nằm TRƯỚC bước thực hiện procedure trong luồng.

**CLXXXVII. Browser Journey — Care** — `Today`, `WorkItem/FollowUp`, `Customer`, `Appointment`, `Interaction`

Phải có luồng đi được bằng trình duyệt cho vai trò Chăm sóc khách hàng: Today → xem follow-up work được giao → mở Customer → mở appointment/follow-up tương ứng → ghi nhận interaction ĐƯỢC PHÉP (permitted interaction). Nhân viên Care chỉ ghi được loại tương tác mà quyền của họ cho phép, không mở được toàn bộ nội dung lâm sàng.

**CLXXXVIII. Browser Journey — Patient History** — `Customer`, `Healthcare tab`, `MedicalCase`, `ClinicalTimeline`

Với clinician được authorize, phải đi được: Customer → tab/section Healthcare → danh sách Cases → Timeline của case, và nội dung timeline phải hiểu được (understandable) đối với người dùng nghiệp vụ — không phải dump log kỹ thuật. Luồng này chỉ mở cho clinician có quyền.

**CLXXXIX. Customer Detail Integration** — `Customer`, `HealthcareModuleToggle`, `Permission`

Trang Customer của Phần 5 được bổ sung một tab/section mới nhãn tiếng Việt 'Hồ sơ chuyên môn'. Tab này CHỈ được render khi thỏa đồng thời 2 điều kiện: (1) module Healthcare đang enabled cho Company đó; (2) user hiện tại có permission tương ứng. Không thỏa thì tab không tồn tại trong DOM (không phải chỉ disable), và không được viết lại trang Customer core.

**CXC. No Separate Clinic Customer Directory** — `Customer`

Không tạo danh bạ/bảng/trang danh sách bệnh nhân riêng cho Healthcare. Mọi tra cứu bệnh nhân dùng lại Customer Core của Phần 5 (cùng model, cùng list page, cùng search).

**CXCI. Appointment Integration** — `Appointment`, `HealthcareAppointmentContext`

Danh sách Appointment hiện có được phép hiển thị thêm purpose/context healthcare (mục đích khám, loại lượt hẹn lâm sàng) như phần mở rộng. Không tạo trang đặt lịch/lịch làm việc thứ hai song song, trừ khi chứng minh được một workflow legacy thực sự đòi hỏi view chuyên biệt.

**CXCII. Work Core Integration** — `WorkItem`, `MedicalCase`, `Consent`, `FollowUp`

Các workflow lâm sàng sinh ra WorkItem của Work Core (Phần 4), không sinh entity task riêng. Các loại việc tối thiểu phải tạo được: 'Chuẩn bị hồ sơ', 'Xác nhận consent', 'Tái khám', 'Gọi follow-up', 'Kiểm tra kết quả'. Cấm dựng ClinicalTask engine riêng trừ khi ngữ nghĩa thực sự khác WorkItem.

**CXCIII. Today Integration** — `Today`, `WorkItem`, `Appointment`, `Procedure`, `FollowUp`

Màn Today của nhân viên healthcare gộp 3 nguồn: (1) Work (WorkItem được giao); (2) Appointment được assign cho họ; (3) các item Procedure/Follow-up liên quan. Today vẫn phải giữ đơn giản — không thêm tầng lọc/tab phức tạp.

**CXCIV. Today Is Not Medical Dashboard** — `Today`

Today không được đổ toàn bộ hồ sơ bệnh án ra màn hình. Chỉ hiển thị việc cần hành động (actionable work) — mỗi dòng phải có hành động kèm theo.

**CXCV. Procedure Readiness in Today** — `Today`, `Procedure`, `Consent`, `Permission`

Nếu có thủ thuật diễn ra trong ngày mà thiếu consent, Today phải hiển thị cảnh báo với đúng nội dung tiếng Việt 'Cần hoàn thiện hồ sơ trước thủ thuật' — và chỉ hiển thị cho nhân viên được authorize (không lộ cho user không có quyền healthcare).

**CXCVI. Healthcare Signals** — `Signal`, `FollowUp`, `Consent`, `Appointment`, `MaterialUsage`, `MedicalRecord`

Định nghĩa và expose 5 signal DETERMINISTIC (tính bằng rule/truy vấn dữ liệu, không dùng LLM) để Phần 8 tiêu thụ: Follow-up overdue; Consent missing; Appointment no-show; Procedure material low; Clinical record incomplete. Signal phải có interface/contract ổn định cho Phần 8 đọc.

**CXCVII. No AI Diagnostic Signal Without Governance** — `Signal`, `AI/LLM`

Trong Phase 7 cấm sinh cảnh báo rủi ro y khoa (medical risk alert) từ LLM và dùng nó như hệ thống an toàn chính thức (canonical safety system). Mọi signal an toàn phải deterministic.

**CXCVIII. Company Home** — `CompanyHome`, `Appointment`, `Procedure`, `FollowUp`, `WorkItem`

Company Home của công ty healthcare được phép hiển thị bản tóm tắt vận hành gồm đúng 4 nhóm: 'Lịch hôm nay', 'Ca cần chuẩn bị', 'Tái khám quá hạn', 'Việc cần xử lý'. Không dựng dashboard phòng khám khổng lồ; UX cuối cùng do Phần 9 chốt.

**CXCIX. Healthcare Navigation** — `Navigation`

Các mục nav nghiệp vụ tiềm năng: 'Hôm nay', 'Khách hàng', 'Lịch hẹn', 'Hồ sơ chuyên môn', 'Thủ thuật/Điều trị', 'Công việc'. Phải tuân thủ nav budget đã có (không vượt số mục cho phép); có thể gom phần Healthcare dưới một nhóm tên 'Chuyên môn'. Cấu trúc cuối do Phần 9 quyết.

**CC. Do Not Show Framework Terms** — `UI copy`

UI dành cho nhân viên y tế thông thường tuyệt đối không hiển thị các thuật ngữ khung: 'Vertical Package', 'Healthcare Context Entity', 'ScopeRef', 'Module Adapter'. Các từ này chỉ tồn tại trong code/docs nội bộ.

**CCI. Legacy UX Salvage** — `Legacy Clinic flows`

Rà các flow quen thuộc của Clinic legacy và GIỮ LẠI những gì (a) nhanh, (b) dễ hiểu, (c) hữu ích lâm sàng. Không redesign chỉ vì muốn mới lạ.

**CCII. Legacy UI Parity Review** — `Legacy Clinic flows`, `Parity checklist`

Với mỗi core flow của Clinic, phải trả lời và ghi lại 4 câu hỏi parity: (1) bản target có nhanh hơn không? (2) có ít nhất dễ hiểu bằng bản cũ không? (3) có bỏ mất field quan trọng nào không? (4) có làm phát sinh thêm click không? Đây là checklist review bắt buộc, không phải tùy chọn.

**CCIII. No Big-Bang UX Replica** — `UI/Navigation`

Target là ứng dụng mới, không clone giao diện legacy. Được giữ lại mental model quen thuộc, nhưng không tái tạo sidebar cũ chỉ vì hoài niệm.

**CCIV. Form Design** — `Clinical forms`

Form lâm sàng được phép dài; phải chia section và dùng progressive disclosure để giảm tải thị giác. Nhưng các field an toàn quan trọng (safety-critical) không được giấu sau bước mở rộng — luôn hiển thị mặc định.

**CCV. Autosave** — `ConsultationNote/Draft`

Autosave có thể hữu ích cho ghi chép nháp dài. Nếu triển khai, chỉ được autosave ở trạng thái DRAFT; không có đường nào để autosave dẫn tới finalize ngoài ý muốn (finalize luôn phải là hành động chủ động của người dùng).

**CCVI. Validation** — `Clinical forms`, `Server validation`

Validation phải chạy phía server (server-side), không chỉ client. Tập field bắt buộc của phần lâm sàng phải bám theo workflow thực tế, không bịa danh sách bắt buộc.

**CCVII. Empty Fields** — `Clinical fields`, `Allergy`

Không được tự sinh dữ kiện lâm sàng mặc định. Cụ thể: cấm hiển thị 'No allergy' (không dị ứng) nếu chưa được ghi nhận tường minh. Khi chưa có dữ liệu, hiển thị 'Unknown / not recorded' (chưa ghi nhận).

**CCVIII. Medical Data Truth** — `Clinical fields`

Nguyên tắc dữ liệu: KHÔNG CÓ BẢN GHI ≠ KẾT LUẬN ÂM TÍNH. Model, API và UI phải phân biệt được 'chưa ghi nhận' với 'đã ghi nhận là không'.

**CCIX. Boolean Medical Fields** — `Clinical fields`

Với các field y khoa dạng có/không, cân nhắc dùng tri-state YES / NO / UNKNOWN thay vì boolean mặc định false.

**CCX. AI Summary** — `MedicalCase`, `AI Summary`

Phần 8 được phép tóm tắt Case bằng AI. Bản tóm tắt bắt buộc phải link tới các bản ghi nguồn (source records) và không bao giờ được coi là nguồn sự thật — dữ liệu gốc mới là source-of-truth.

**CCXI. Clinical Timeline** — `ClinicalTimeline`, `Appointment`, `Consultation`, `Consent`, `Procedure`, `ClinicalPhoto`, `FollowUp`

Clinical Timeline là dữ liệu DẪN XUẤT (derived) từ các bản ghi có sẵn: Appointment, Consultation, Consent, Procedure, Photo, Follow-up. Không tạo bảng timeline trung tâm dư thừa trừ khi thật sự bắt buộc.

**CCXII. Timeline Privacy** — `ClinicalTimeline`, `Permission`

Timeline chỉ được chứa các bản ghi mà user hiện tại được phép xem — lọc quyền ở tầng truy vấn/server, không lọc ở client.

**CCXIII. Photo Thumbnails** — `ClinicalPhoto`, `FileStorage`

Thumbnail ảnh lâm sàng phải được fetch qua đường private (có kiểm tra quyền mỗi request). Cấm public caching (CDN công khai / cache-control public).

**CCXIV. Image Metadata** — `ClinicalPhoto`, `EXIF`

Không expose EXIF/location của ảnh lâm sàng khi không cần thiết; strip metadata nhạy cảm ở nơi thích hợp trước khi lưu/phục vụ ảnh.

**CCXV. Clinical File Types** — `ClinicalFile`, `Upload validation`

Mọi file lâm sàng upload phải validate loại (type) và kích thước (size). Không được tin vào phần mở rộng tên file — phải kiểm tra content type/magic bytes thật.

**CCXVI. Malware Scanning** — `ClinicalFile`, `Security backlog`

Quét malware chỉ làm nếu hạ tầng file hiện có hỗ trợ sẵn. Không bắt buộc tự xây hệ thống quét cấp doanh nghiệp từ đầu; nhưng phải ghi lại như một yêu cầu bảo mật tương lai (backlog security).

**CCXVII. File Names** — `ClinicalFile`, `FileStorage path`

Tránh đưa tên bệnh nhân vào đường dẫn lưu trữ file; dùng ID không đoán được (opaque ID) cho path/tên file.

**CCXVIII. Data Encryption** — `Encryption`, `Database`, `Storage`

Dùng best practice mã hóa sẵn có của nền tảng/database/storage. Cấm tự phát minh cơ chế mã hóa riêng.

**CCXIX. Database Backup** — `Database backup`

Trong Phần 7 chỉ làm backup cho môi trường test. Backup/cutover cho production thuộc Phần 10.

**CCXX. Healthcare Data Migration — Not Yet** — `Migration spec`

Phần 7 KHÔNG migrate dữ liệu lâm sàng legacy thật. Sản phẩm của Phần 7 là các bản đặc tả mapping (mapping specs) để Phần 10 thực thi.

**CCXXI. Migration Map — Case** — `Legacy CaseRecord`, `MedicalCase`, `Migration spec`

Với MỌI field của legacy CaseRecord, lập bảng mapping gồm đúng 5 cột: Target destination (đích trong model mới), Transform (phép biến đổi), Required? (bắt buộc hay không), Sensitive? (có nhạy cảm không), Parity test (cách kiểm chứng).

**CCXXII. Migration Map — Consultation** — `Legacy Consultation`, `Consultation`, `Migration spec`

Lập bảng mapping cho Consultation theo đúng cấu trúc 5 cột như CCXXI: Target destination, Transform, Required?, Sensitive?, Parity test.

**CCXXIII. Migration Map — Consent** — `Consent`, `ConsentVersion`, `ConsentFile`, `Migration spec`

Mapping Consent phải bảo toàn được: (1) bằng chứng nội dung/phiên bản chính xác của bản consent (exact version/content evidence); (2) các mốc ngày; (3) người ký (signer); (4) file đính kèm; (5) các quan hệ liên kết (tới case/procedure/customer).

**CCXXIV. Migration Map — Photos** — `ClinicalPhoto`, `MedicalCase`, `Migration spec`

Mapping ảnh lâm sàng phải bảo toàn: file nguồn, loại ảnh, case liên kết, ngày chụp (capture date), ngữ nghĩa before/after, và tính toàn vẹn (integrity) của file.

**CCXXV. Photo Migration Security** — `ClinicalPhoto`, `FileStorage`, `Migration`

Khi Phần 10 copy file ảnh, phải copy qua kênh private. Cấm dùng bucket public tạm thời làm trung gian.

**CCXXVI. Migration Map — Procedure** — `Procedure`, `Migration`

Migration Procedure chỉ bảo toàn sự kiện lịch sử đã xảy ra (historical facts). Cấm chạy lại workflow lâm sàng (side effect, trạng thái, trừ kho, tạo việc...) trên dữ liệu lịch sử khi import.

**CCXXVII. Migration Map — Follow-up** — `FollowUp`, `Migration spec`

Dữ liệu Follow-up legacy phải được bảo toàn khi migrate (có mapping riêng cho follow-up).

**CCXXVIII. Material Usage Migration** — `MaterialUsage`, `Inventory`, `Migration`

Việc đối soát giữa lượng vật tư sử dụng lâm sàng trong lịch sử và tồn kho hiện tại phải làm hết sức cẩn thận. Không được giả định là có thể dựng lại toàn bộ lịch sử movement kho từ dữ liệu legacy.

**CCXXIX. Legacy Generic Records** — `Customer`, `Payment`, `Healthcare tables`

Không map bản ghi Customer/Payment của legacy vào các bảng Healthcare. Chúng thuộc về Core target (Customer Core / Finance của Phần 5-6).

**CCXXX. Duplicate Customer Reconciliation** — `Customer`, `Migration`

Việc gộp/khử trùng lặp khách hàng là việc của Phần 10. Phần 7 chỉ có nhiệm vụ NHẬN DIỆN các quan hệ trùng lặp (identify relationships), không thực hiện merge.

**CCXXXI. Legacy Customer ID Reference** — `Customer ID map`, `MedicalCase`, `Migration tooling`

Bộ công cụ migration phải có bảng ánh xạ legacy Customer ID → target Customer ID, và bảng này phải sẵn sàng TRƯỚC khi import Case (Case tham chiếu customer đã map).

**CCXXXII. Migration Dependency Order** — `Migration order`

Thứ tự phụ thuộc khi migrate (dự kiến): User/People → Customer → Appointments → Medical Cases → Consultations/Screening → Consent → Procedures → Photos → Follow-ups → Material usage. Phần 10 là nơi xác minh cuối cùng thứ tự này.

**CCXXXIII. Migration IDs** — `ID mapping`, `Migration`

Không được giả định ID ở hệ đích trùng ID ở hệ nguồn. Mọi tham chiếu chéo khi migrate phải đi qua bảng mapping ID.

**CCXXXIV. Clinical Record Counts** — `Reconciliation report`, `MedicalCase`, `Consultation`

Chuẩn bị bộ đối soát số lượng cho tương lai: so sánh số Cases legacy vs target, số Consultations legacy vs target, ... cho từng loại bản ghi lâm sàng, KÈM các kiểm tra quan hệ (relational checks: mỗi Case có đúng customer, mỗi Consent gắn đúng case...).

**CCXXXV. Content Checksums** — `ClinicalFile`, `Checksum`

Dùng checksum nội dung cho các file/tài liệu lâm sàng ở những chỗ thực sự có ích (để chứng minh nội dung không đổi sau migrate).

**CCXXXVI. File Checksum** — `ClinicalPhoto`, `Checksum`, `Migration`

Checksum file đặc biệt hữu ích để kiểm tra tính toàn vẹn khi migrate ảnh lâm sàng — dùng cho photo migration.

**CCXXXVII. Record Hash** — `Record hash`

Hash toàn bản ghi (record hash) là TÙY CHỌN. Không làm phức tạp hóa hệ thống vì nó.

**CCXXXVIII. Legacy Parity Test Suite (heading tại biên dải)** — `Parity test suite`

Tiêu đề mục xuất hiện đúng tại dòng cuối dải được phân công (dòng 3670); phần nội dung nằm NGOÀI dải 3010-3670 nên chưa rút được yêu cầu. Cần agent phụ trách dải kế tiếp đọc tiếp từ dòng 3670 để bổ sung.

### parity-commands-constraints — spec dòng 3669–4300 (64 yêu cầu)

**CCXXXVIII. Legacy Parity Test Suite** — `MedicalCase`, `Company`, `Customer`

Xay bo test 'legacy parity' rieng cho Healthcare vertical (vd tests/healthcare/parity/), lay cam hung tu hanh vi legacy ZenithTasks nhung TOAN BO du lieu la synthetic/seed fixture tu tao. Cam import/copy production data hoac dump benh nhan that vao test. Moi scenario phai chay duoc doc lap (seed Company + Customer + user roles rieng) trong CI.

**CCXXXIX. Parity Scenarios** — `MedicalCase`, `Consultation`, `Procedure`, `ConsentRecord`, `ClinicalPhoto`, `FollowUp`, `ProcedureMaterialUsage`

Bo parity test phai phu toi thieu 6 kich ban end-to-end: (1) Consultation-only: mo case -> tao consultation draft -> finalize, khong co procedure; (2) Procedure requiring consent: procedure bi chan cho den khi co ConsentRecord hop le; (3) Procedure using materials: procedure tieu hao vat tu -> sinh inventory movement; (4) Before/after photo case: upload anh truoc/sau gan vao case; (5) Follow-up case: schedule + complete medical follow-up; (6) Cancelled case: procedure/case bi huy va trang thai cuoi dung. Moi kich ban assert ca state cuoi lan audit trail.

**CCXL. Clinical State Transition Tests** — `MedicalCase`, `Procedure`, `Consultation`

Viet test bao phu ma tran chuyen trang thai lam sang: moi transition hop le phai pass, va MOI transition khong hop le phai bi tu choi bang business error (khong phai crash). Vi du bat buoc: complete procedure khi chua o trang thai ready; cancel procedure da completed; ghi consultation vao case da closed; finalize hai lan.

**CCXLI. Finalization Tests** — `Consultation`, `ConsultationAddendum`

Test chung minh ban ghi lam sang da finalize khong the bi sua binh thuong: sau finalizeConsultation, moi lenh update noi dung phai tra loi CLINICAL_RECORD_FINALIZED; duong duy nhat de bo sung la addConsultationAddendum, va addendum tao ban ghi moi chu khong ghi de snapshot goc.

**CCXLII. Audit Tests** — `AuditLog`, `MedicalCase`, `Consultation`, `Procedure`, `ConsentRecord`, `ClinicalPhoto`

Test khang dinh moi su kien lam sang trong yeu (mo/dong case, finalize consultation, addendum, plan/ready/complete/cancel procedure, tao/void consent, them/archive anh, ghi/sua material usage) deu sinh dung mot ban ghi audit truy nguoc duoc: co actor, companyId, resource type + id, action, thoi diem.

**CCXLIII. File Security Tests** — `ClinicalPhoto`, `FileStorage`, `ConsentRecord`

Test: request tai file lam sang (anh, consent evidence) tu user khong co quyen healthcare hoac khac Company phai bi chan o server (403/deny), ke ca khi biet chinh xac fileId/URL. Khong duoc dua vao URL doan-khong-ra lam co che bao mat.

**CCXLIV. Multi-Tenant Tests** — `Company`, `MedicalCase`

Test isolation giua Healthcare Company A va Healthcare Company B: user cua A khong doc/ghi duoc bat ky MedicalCase, Consultation, Procedure, Consent, Photo, FollowUp nao cua B qua moi entrypoint (command, query, file, export).

**CCXLV. Cross-Ecosystem Healthcare** — `Ecosystem`, `EcosystemMembership`, `CompanyMembership`

Test: Founder/Doctor thuoc Ecosystem E1 khong truy cap duoc du lieu healthcare cua Ecosystem E2. Role tier Ecosystem khong tu dong cap quyen ghi vao Company cu the (giu invariant Phan 3), phai co CompanyMembership tuong minh.

**CCXLVI. Role Escalation** — `CompanyMembership`, `Permission`

Regression test (da co tu Phan 3, chay lai trong context healthcare): user Reception khong the tu sua permission cua chinh minh de tro thanh Doctor, ke ca qua server action cua module Healthcare.

**CCXLVII. Position Name Attack** — `Position`, `Permission`

Test: doi ten Position thanh 'Bac si' (hoac bat ky ten nghe nghiep nao) KHONG cap them quyen lam sang. Quyen phai den tu permission key tuong minh, khong bao gio suy ra tu string ten position/title.

**CCXLVIII. Clinical Permission Pack** — `Permission`

Dinh nghia permission pack lam sang tuong minh (danh sach permission key ro rang cho doc/ghi ho so, finalize, consent, photo, material usage), khong dung quyen ngam/implicit. Test kiem tra tung permission key bat/tat doc lap va gate dung command tuong ung.

**CCXLIX. Suspended User** — `User`, `CompanyMembership`

Test: user o trang thai suspended mat toan bo quyen truy cap lam sang ngay lap tuc (ca command lan query lan tai file), du membership/permission cu van con ton tai trong DB.

**CCL. Revoked Case Member** — `MedicalCase`, `CaseTeamMember`

Neu he thong dung co che gioi han theo case team: khi mot thanh vien bi go khoi case team, quyen truy cap case do phai cap nhat ngay (test assert truoc/sau khi revoke).

**CCLI. Search Leak Test** — `Customer`, `MedicalCase`

Test: tim kiem Patient/Customer cua Company B tu context Company A (theo ten, so dien thoai, ma ho so) tra ve 0 ket qua — khong tra ve ban ghi bi che mo hay 'ket qua an'.

**CCLII. Export Leak Test** — `Company`, `MedicalCase`

Test: moi export/bao cao chay boi Company A khong chua bat ky dong du lieu nao cua Company B, ke ca truong dem/aggregate.

**CCLIII. File Leak Test** — `ClinicalPhoto`, `FileStorage`

Test: user Company A khong tai duoc anh lam sang cua Company B qua bat ky duong nao (direct file id, signed URL cu, endpoint metadata).

**CCLIV. Cache Leak Test** — `Company`

Neu co dung cache (Next.js cache, react cache, redis, memoization): test chung minh cache key luon chua companyId va du lieu cache cua Company B khong duoc phuc vu cho Company A sau khi doi context/user.

**CCLV. Server Action Injection** — `ServerAction`, `Company`, `MedicalCase`

Test critical: moi server action healthcare phai tu resolve company scope o server tu session, KHONG tin companyId/caseId gui tu client. Gui id cua Company B vao server action dang nhap boi Company A phai bi tu choi HEALTHCARE_ACCESS_DENIED, khong bao gio ghi cheo tenant.

**CCLVI. AI Tool Injection Preparation** — `MedicalCase`, `AITool`

Neu nen tang AI da ton tai: viet test helper mo phong Company AI (tuong lai Phan 8) truyen Case ID cua Company B vao tool cua Company A — server phai tu choi. Helper nay chuan bi san cho Phan 8, khong build feature AI o Phan 7.

**CCLVII. Healthcare Domain Commands** — `MedicalCase`, `Consultation`, `Procedure`, `ConsentRecord`, `ClinicalPhoto`, `FollowUp`, `ProcedureMaterialUsage`, `Screening`, `ClinicalIndication`

Toan bo ghi du lieu healthcare di qua tap domain command tuong minh, khong co CRUD tuy y: openMedicalCase, updateMedicalCase, closeMedicalCase, createConsultationDraft, finalizeConsultation, addConsultationAddendum, recordScreening, recordClinicalIndication, planProcedure, markProcedureReady, completeProcedure, cancelProcedure, createConsentRecord, voidConsent, addClinicalPhoto, archiveClinicalPhoto, scheduleMedicalFollowUp, completeMedicalFollowUp, recordProcedureMaterialUsage, correctProcedureMaterialUsage. Khong expose generic create/update/delete tren model lam sang.

**CCLVIII. Command Pipeline** — `ServerAction`, `AuditLog`

Moi command nhay cam chay dung pipeline 9 buoc theo thu tu: (1) Actor (xac dinh nguoi thuc hien tu session) -> (2) Company scope -> (3) Healthcare permission -> (4) Resource scope (resource thuoc dung company/case) -> (5) State validation -> (6) Business validation -> (7) Transaction -> (8) Audit -> (9) Verify. Trien khai dung mot helper/wrapper chung de khong the bo qua buoc; test chung minh bo bat ky buoc nao deu fail.

**CCLIX. Verify — Case** — `MedicalCase`

Buoc Verify sau command lien quan Case: reload lai state cua MedicalCase tu DB (khong dung gia tri in-memory truoc transaction) va khang dinh trang thai/field da thay doi dung ky vong truoc khi tra ve thanh cong.

**CCLX. Verify — Consultation** — `Consultation`

Sau finalizeConsultation, buoc Verify phai doc lai va khang dinh snapshot ban ghi da finalize duoc luu (noi dung dong bang tai thoi diem finalize), khong chi kiem tra co status = finalized.

**CCLXI. Verify — Procedure** — `Procedure`, `ProcedureMaterialUsage`

Sau command procedure, Verify phai doc lai va khang dinh dung: status, ngay thuc hien (performedAt), clinician thuc hien, va cac lien ket material usage gan voi procedure.

**CCLXII. Verify — Consent** — `ConsentRecord`

Sau createConsentRecord, Verify phai khang dinh ban ghi consent co version (phien ban mau van ban dong y) va evidence (bang chung: chu ky/file/timestamp) duoc luu day du.

**CCLXIII. Verify — Photo** — `ClinicalPhoto`, `FileStorage`

Sau addClinicalPhoto, Verify phai khang dinh file thuc su ton tai trong storage o che do private (khong public URL) VA metadata anh da duoc ghi (case, loai anh, thoi diem chup).

**CCLXIV. Verify — Material** — `ProcedureMaterialUsage`, `InventoryMovement`

Sau recordProcedureMaterialUsage, Verify phai khang dinh inventory movement duoc tao DUNG MOT LAN (khong thieu, khong nhan doi khi retry). Test idempotency/double-submit.

**CCLXV. Error Model** — `BusinessError`

Dinh nghia tap business error co ma tuong minh: CASE_CLOSED, CONSENT_REQUIRED, SCREENING_REQUIRED, PROCEDURE_INVALID_STATE, INSUFFICIENT_STOCK, CLINICAL_RECORD_FINALIZED, HEALTHCARE_ACCESS_DENIED. Moi ma co mapping sang thong diep user-friendly (tieng Viet) hien tren UI; command tra ve ma nay thay vi throw loi ky thuat.

**CCLXVI. No Internal Error UI** — `BusinessError`

UI khong duoc hien thi ma loi noi bo: khong Prisma error code (P2002, P2025...), khong stack trace, khong ten bang/cot, khong message thu vien. Loi khong nam trong tap business error phai hien thong diep chung + correlation id, chi tiet ky thuat chi vao log server.

**CCLXVII. Procedure Readiness UX** — `Procedure`, `ProcedureReadiness`, `ConsentRecord`, `Screening`

Man hinh procedure hien checklist san sang dang danh dau tung muc (vd: ✓ Ho so, ✓ Sang loc, ✗ Dong y thuc hien, ✓ Vat tu), chi hien nhung muc thuc su ap dung cho procedure do. Checklist phai lay tu cung logic voi validation server (getProcedureReadiness), khong tinh lai o client.

**CCLXVIII. Do Not Expose AI Governance Tech** — `ClinicalUI`

Man hinh lam sang khong duoc hien chi tiet ha tang AI/governance: agent id, job/queue status, buoc approval noi bo, prompt, tool call. Nguoi dung lam sang chi thay ngu nghia y te.

**CCLXIX. Clinical Approval** — `Approval`, `Permission`

Khong bat moi buoc lam sang phai qua 'admin approval'. Uy quyen lam sang la workflow theo vai tro/chuyen mon (bac si duoc lam viec cua bac si), tach biet hoan toan khoi co che approval tai chinh cua core.

**CCLXX. Consent ≠ Approval** — `ConsentRecord`, `Approval`

ConsentRecord (dong y cua benh nhan) la ban ghi lam sang/phap ly rieng, KHONG duoc mo hinh hoa hay dinh tuyen qua Approval engine dung chung cua core.

**CCLXXI. Procedure Sign-off ≠ Business Approval** — `Procedure`, `Approval`

Sign-off thu thuat la hanh vi finalization cua clinician, giu dung ngu nghia lam sang; khong tai su dung luong business approval (nguoi quan ly duyet) cho buoc nay.

**CCLXXII. Safety Checklist** — `SafetyChecklist`, `Approval`

Neu co safety checklist, no la cau truc domain-specific cua healthcare; khong ep vao model Approval chung.

**CCLXXIII. Healthcare AI Future Signal Contracts** — `HealthcareSignal`, `MedicalCase`, `FollowUp`, `ConsentRecord`, `Appointment`, `Procedure`

Phan 7 expose du lieu co cau truc (signal contract) cho Phan 8 gom: CaseFollowUpOverdue, ConsentMissing, ProcedureReadinessIncomplete, AppointmentNoShow, ClinicalRecordDraftTooLong, LowProcedureMaterial. Tat ca phai la tin hieu van hanh deterministic (tinh duoc tu du lieu + rule ro rang), khong suy dien/du doan.

**CCLXXIV. AI Part 8 Boundary** — `AI`

Cac nang luc AI (tom tat, phat hien khoang trong van hanh, chuan bi task, tra loi cau hoi, de xuat lich, soan nhap ghi chu) thuoc Phan 8 — Phan 7 chi chuan bi du lieu/contract. Khi trien khai o Phan 8, cac hanh dong co y nghia lam sang bat buoc co xac nhan cua nguoi.

**CCLXXV. AI Must Not Hallucinate Clinical Facts** — `AI`, `Consultation`

Moi output AI ve lam sang phai phan tach ro hai loai noi dung: 'du lieu da ghi nhan' (recorded fact, tu ban ghi that) va 'dien giai cua AI' (interpretation). Contract du lieu Phan 7 phai du de danh dau nguon goc nay.

**CCLXXVI. Evidence Links** — `AI`, `MedicalCase`, `Consultation`

(Phan 8) Ban tom tat lam sang do AI tao phai trich dan/link toi ban ghi nguon noi bo ngay tren UX. Phan 7 dam bao moi thuc the lam sang co id on dinh de duoc trich dan.

**CCLXXVII. Clinical Query APIs** — `MedicalCase`, `Consultation`, `Procedure`, `ClinicalPhoto`, `FollowUp`, `Customer`

Cung cap cac query doc: getCustomerHealthcareOverview, getMedicalCase, getCaseTimeline, getConsultation, getProcedureReadiness, getCasePhotos, getFollowUps. Tat ca deu bat buoc scope theo Company resolve tu session (khong nhan companyId tu client) va kiem tra healthcare permission truoc khi tra du lieu.

**CCLXXVIII. No Unscoped Get All Cases** — `MedicalCase`, `Company`

Khong ton tai query 'lay tat ca case' khong scope. Moi truy van danh sach case bat buoc co dieu kien companyId; test/lint chung minh khong co duong nao query MedicalCase ma thieu company boundary.

**CCLXXIX. Pagination** — `MedicalCase`, `Consultation`, `ClinicalPhoto`, `CaseTimeline`

Phan trang bat buoc cho: danh sach Case, danh sach Consultation, Timeline cua case, va danh sach Photo khi so luong lon. Khong tra ve toan bo tap du lieu trong mot request.

**CCLXXX. Indexes** — `MedicalCase`, `Consultation`, `Procedure`, `ConsentRecord`, `ClinicalPhoto`, `FollowUp`

Tao index (dieu chinh theo schema thuc te) cho: MedicalCase(companyId, customerId), MedicalCase(companyId, status), MedicalCase(companyId, openedAt), Consultation(companyId, medicalCaseId, occurredAt), Procedure(companyId, medicalCaseId, status), Procedure(companyId, performedAt), Consent(companyId, medicalCaseId), ClinicalPhoto(companyId, medicalCaseId, capturedAt), FollowUp(companyId, medicalCaseId, followUpAt). Moi index deu bat dau bang companyId de phuc vu truy van scoped.

**CCLXXXI. File Metadata Index** — `ClinicalPhoto`, `FileStorage`

Index metadata file lam sang theo case va loai anh (vd (companyId, medicalCaseId, photoType)) de loc/liet ke anh theo case va theo loai hieu qua.

**CCLXXXII. Database Constraints** — `MedicalCase`, `Consultation`, `Procedure`, `ConsentRecord`, `ClinicalPhoto`, `FollowUp`

Khai bao foreign key tuong minh cho moi quan he du lieu lam sang (Case -> Customer/Company, Consultation/Procedure/Consent/Photo/FollowUp -> Case). Khong duoc ton tai ban ghi lam sang mo coi (orphan) o cap DB.

**CCLXXXIII. Cascade Delete** — `MedicalCase`, `Consultation`, `Procedure`

Cam cascade delete tren lich su lam sang. Quan he FK dung onDelete: Restrict (hoac tuong duong) va nghiep vu dung archive/soft-state thay vi xoa cung.

**CCLXXXIV. Case Delete** — `MedicalCase`

Khong cho xoa MedicalCase theo duong thong thuong khi da co ban ghi con (consultation, procedure, consent, photo, follow-up). Command xoa phai tra loi tu choi; luong hop le la dong/luu tru case.

**CCLXXXV. Customer Archive With Case** — `Customer`, `MedicalCase`

Archive mot Customer khong duoc xoa hay lam mat lich su healthcare cua ho; du lieu lam sang van ton tai va van truy van duoc (theo quyen) sau khi customer bi archive.

**CCLXXXVI. Customer Merge With Case** — `Customer`, `MedicalCase`

Neu tinh nang merge Customer duoc lam sau nay, viec di chuyen quan he Case sang customer dich phai atomic (mot transaction, khong de case tro toi customer da bien mat). Day la hang muc rui ro cao, co the defer khoi Phan 7.

**CCLXXXVII. Case Merge** — `MedicalCase`

Khong implement merge MedicalCase tru khi doi chieu legacy chung minh nghiep vu that su can.

**CCLXXXVIII. Case Reopen** — `MedicalCase`

Khi case da closed nhung benh nhan tiep tuc dieu tri, phai chot mot trong hai ngu nghia: reopen chinh case cu, hoac tao case moi. Quyet dinh dua tren ngu nghia legacy/nghiep vu va viet ADR neu anh huong dang ke.

**CCLXXXIX. Multiple Cases** — `Customer`, `MedicalCase`

Mo hinh du lieu phai cho phep mot Customer co nhieu MedicalCase lich su (quan he 1-n), khong gioi han mot case moi khach.

**CCXC. Clinical Specialty** — `MedicalCase`, `Procedure`

Chuyen khoa lam sang chi luu dang metadata don gian (truong/tag tren case hoac procedure). Khong xay he thong phan cap chuyen khoa tru khi co nhu cau su dung thuc te.

**CCXCI. Organization Unit** — `MedicalCase`, `Procedure`, `OrganizationUnit`, `Branch`

MedicalCase va Procedure co the tham chieu don vi to chuc lien quan (phong ban/chi nhanh) tu module Organization co san, nhung quyen so huu du lieu van thuoc Company (companyId la boundary).

**CCXCII. Branch Filter** — `Branch`, `MedicalCase`

Nhan vien phong kham co the loc danh sach lam sang theo chi nhanh. Branch chi la bo loc/thuoc tinh, KHONG phai mot tenant boundary rieng — khong duoc dung branch de thay the kiem tra companyId.

**CCXCIII. Project** — `MedicalCase`, `Project`

MedicalCase khong thuoc ve Project. Khong them projectId lam scope bat buoc cho Medical Case; quy gan marketing/du an van o phia thuong mai (CRM/Sales).

**CCXCIV. Project Clinical Data** — `Project`, `MedicalCase`

Mac dinh KHONG dua du lieu lam sang vao Project. Neu sau nay co use case nghien cuu/du an, phai la quyet dinh tuong minh rieng (khong mo ngam).

**CCXCV. Finance Link** — `MedicalCase`, `Sale`, `Invoice`, `Customer`

Trang lam sang cua khach hang co the link sang Billing/Sale cua core Finance khi user co quyen tuong ung. Khong tao model thanh toan rieng cho lam sang (khong duplicate payment model).

**CCXCVI. Payroll Link** — `Procedure`, `Payroll`

Khong model lam sang nao duoc luu tru thong tin luong/thu lao. Du lieu luong chi ton tai o module Payroll cua core.

**CCXCVII. Inventory Link** — `ProcedureMaterialUsage`, `InventoryItem`, `InventoryMovement`

Healthcare chi tham chieu Inventory core qua ban ghi su dung vat tu (ProcedureMaterialUsage -> item/movement cua Inventory). Khong tao kho/ton kho rieng cho healthcare.

**CCXCVIII. Audit Link** — `AuditLog`

Tai su dung he thong Audit cua core cho moi su kien healthcare; khong xay audit log rieng cua vertical.

**CCXCIX. Approval Link** — `Approval`

Chi ket noi Approval engine cua core cho cac hanh dong nghiep vu rui ro cao thuc su phu hop (vd giam gia/hoan tien lon), khong dung cho buoc lam sang thong thuong.

**CCC. File Link** — `FileStorage`, `ClinicalPhoto`, `ConsentRecord`

Tai su dung ha tang File Storage cua core cho anh lam sang va bang chung consent (private access, permission check); khong xay lop luu tru file rieng cho healthcare.

**CCCI. Notification Link** — `Notification`

Tai su dung he thong Notification cua core cho cac thong bao healthcare. Danh sach su kien duoc thong bao nam o phan spec ngay sau dong 4300 (ngoai dai duoc giao) — phai doc tiep truoc khi implement.

### deferred-aesthetics-traceability — spec dòng 4297–4620 (27 yêu cầu)

**CCCI. Notification link cho Healthcare** — `Notification`, `Appointment`, `FollowUp`, `Procedure`

CHI noi Healthcare vao ha tang notification DA CO tu Phan 3-6 (khong dung kenh gui moi trong Phan 7). Ba loai su kien duoc phep phat notification: (a) nhac lich hen (appointment), (b) nhac tai kham / follow-up, (c) huong dan chuan bi truoc thu thuat (procedure prep). Neu ha tang notification chua ton tai thi KHONG lam gi o muc nay. Trong test: cam gui message that ra ngoai — phai dung transport gia lap (fake/in-memory adapter) va assert tren ban ghi notification duoc tao, khong goi provider that.

**CCCIII. Printable consent render tu du lieu consent da versioned** — `Consent`, `ConsentVersion`

Neu can ban in consent: render tu chinh du lieu consent da luu kem version noi dung tai thoi diem benh nhan ky, KHONG render lai tu template hien hanh (in lai sau nay phai ra dung noi dung cua version da ky). Test cho luong in dung du lieu synthetic, khong dung du lieu benh nhan that.

**CCCVII. Laboratory — khong auto include, classify rieng** — `LegacyCapabilityMatrix`

Lab KHONG tu dong nam trong pham vi Phan 7. Viec bat buoc duy nhat: chay archaeology tren ZenithTasks; neu legacy co capability Lab that thi phan loai no thanh hang muc RIENG trong LEGACY_CAPABILITY_MATRIX (khong nhet vao Consultation/Procedure), va de lai quyet dinh scope thay vi implement ngay.

**CCCVIII. Imaging — cung luat voi Lab** — `LegacyCapabilityMatrix`

Imaging ap dung cung luat CCCVII: khong tu dong include vao Phan 7; neu ZenithTasks co capability Imaging thi classify rieng trong capability matrix va ghi nhan la submodule Healthcare tiem nang cho tuong lai — khong implement o Phan 7.

**CCCIX. Pharmacy — cung luat, cam sang che HIS** — `LegacyCapabilityMatrix`

Pharmacy ap dung cung luat CCCVII/CCCVIII: chi classify rieng neu legacy that su co. Tuyet doi khong tu sang che mot he HIS benh vien (module duoc/kho duoc/HIS workflow) khong co trong legacy.

**CCCXV. Medication — chi implement khi legacy chung minh co** — `Medication`

Chi implement workflow thuoc khi archaeology chung minh ZenithTasks co workflow medication CO Y NGHIA (khong phai vai truong text roi rac). Khong duoc gia dinh la co roi thiet ke san model medication.

**CCCXVI. Vital signs — chi khi legacy co, gan vao Consultation/Screening** — `VitalSigns`, `Consultation`, `Screening`

Vital signs ap dung cung luat CCCXV (chi lam khi legacy that su co, khong gia dinh). Neu co, vital signs CO THE thuoc ve ban ghi Consultation hoac Screening thay vi tao model doc lap tach roi.

**CCCXVII. Allergy khong duoc default false** — `Patient`, `AllergyRecord`

Neu allergy duoc dung vao muc dich y khoa: truong allergy KHONG duoc la boolean mac dinh false. Phai phan biet ro 3 trang thai: chua ghi nhan (unknown), da ghi nhan khong di ung, co di ung. Moi hien thi/API tra ve dung recorded status; cam suy dien 'khong co du lieu = khong di ung'.

**CCCXVIII. Clinical alerts deterministic, khong LLM** — `ClinicalAlert`, `AllergyRecord`

Neu ton tai du lieu allergy: hien thi canh bao lam sang bang rule deterministic (pure function tren du lieu da ghi nhan, cung input ra cung output, test duoc). Cam dung LLM/AI de sinh hoac quyet dinh canh bao lam sang.

**CCCXIX. Patient safety validation deterministic** — `ClinicalValidation`

Moi validation thuoc nhom safety-critical lam sang phai deterministic: cai bang code + test, khong phu thuoc LLM, khong phu thuoc ket qua dich vu ngoai co the khong xac dinh.

**CCCXX. Aesthetic photo workflow theo chuoi Case** — `Case`, `ClinicalPhoto`, `Procedure`, `FollowUp`

Voi Company thuoc linh vuc tham my: ho tro chuoi Case -> anh Before -> Procedure -> Follow-up -> anh After. Anh phai gan duoc vao dung mat xich (case / procedure / follow-up) va luu LICH SU: nhieu dot before/after qua nhieu moc thoi gian, truy van lai duoc theo trinh tu thoi gian chu khong chi giu cap anh moi nhat.

**CCCXXI. Photo comparison UI — khong phai P0** — `ClinicalPhoto`

UI so sanh anh before/after chi o muc side-by-side don gian, la nice-to-have, KHONG phai P0. Khong dau tu sau (slider overlay, zoom dong bo, do luong tren anh...) truoc khi dat parity voi legacy.

**CCCXXII. Anh lam sang goc bat bien** — `ClinicalPhoto`, `PhotoDerivative`

Anh lam sang goc khong duoc sua/ghi de ngam (khong crop, resize, chinh mau in-place tren file goc). Neu can ban dan xuat de hien thi (crop/thumbnail), luu thanh ban ghi derivative rieng co tham chieu ve original va giu nguyen file goc.

**CCCXXIV. Consent chup anh** — `Consent`, `ConsentType`, `ClinicalPhoto`

Neu quy trinh nghiep vu/phap ly yeu cau consent cho viec chup anh: mo hinh hoa duoi dang mot LOAI consent (consent type) tren he consent san co, khong tao he consent thu hai. Cam tu soan/tu bia noi dung phap ly — noi dung phai do phia business/legal cung cap.

**CCCXXV. Tach goi thuong mai (Sales/Catalog) khoi procedure lam sang** — `ServicePackage`, `Sale`, `Procedure`

Goi dich vu thuong mai thuoc ve Sales/Catalog da co tu Phan 3-6; Healthcare KHONG tao model goi dich vu/bang gia rieng. Procedure trong Healthcare chi ghi nhan viec THUC HIEN THUC TE (actual delivery) va lien ket nguoc ve sale/package item tuong ung.

**CCCXXVI. Nhieu procedure tren mot sale** — `Sale`, `Procedure`

Schema phai ho tro quan he 1 Sale -> N Procedure (khong dat unique constraint hay khoa 1:1 giua sale va procedure).

**CCCXXVII. Nhieu sale tren mot case** — `Case`, `Sale`

Schema phai ho tro 1 Case -> N Sale. Cam ep quan he 1:1 giua case va sale.

**CCCXXVIII. Case commercial summary la derived** — `Case`, `Sale`, `Finance`

Tong hop thuong mai cua mot case (tong ban, da thu, con lai...) la du lieu DERIVED, tinh tu Sales/Finance tai thoi diem doc. Khong luu cot tong denormalized tren Case.

**CCCXXIX. Procedure cost — khong suy ra loi nhuan** — `Procedure`, `ProcedureMaterialUsage`

Khong tinh va khong hien thi 'loi nhuan' cua procedure suy ra tu vat tu tieu hao khi chua co he cost accounting that. Chi ghi nhan luong vat tu da dung, khong quy doi thanh gia von/margin.

**CCCXXX. Material traceability — salvage tu legacy** — `InventoryLot`, `ProcedureMaterialUsage`

Neu ZenithTasks da co batch/lot/expiry cho vat tu VA du lieu do quan trong ve mat lam sang: phai salvage sang he moi, uu tien muc P0 (khong duoc bo qua khi migrate).

**CCCXXXI. InventoryLot mo rong module Inventory** — `InventoryLot`, `InventoryItem`

Khi can lot: mo rong module Inventory SAN CO bang model InventoryLot voi toi thieu hai truong lotNumber va expiryDate, gan vao item ton kho hien co. Cam tao kho/ton kho trung lap ben trong Healthcare de chua lot.

**CCCXXXII. Lot usage tu procedure** — `ProcedureMaterialUsage`, `InventoryLot`

Ban ghi su dung vat tu cua procedure phai tham chieu toi InventoryLot doi voi nhung loai vat tu yeu cau truy vet lot (truy nguoc duoc tu procedure ra lot da dung).

**CCCXXXIII. Expiry alert thuoc Inventory** — `InventoryLot`

Canh bao het han la signal DETERMINISTIC thuoc module Inventory (rule tinh tren expiryDate), khong phai tinh nang Healthcare rieng va khong dung LLM.

**CCCXXXIV. Lot scoped theo Company** — `InventoryLot`, `Company`

Truy cap InventoryLot tuan thu dung quy tac tenant nhu phan con lai cua he: chi trong cung mot Company; Company A khong doc/ghi lot cua Company B, ke ca qua role Ecosystem-tier.

**CCCXXXV. Serial number cho implant/device** — `InventorySerial`, `InventoryItem`

Neu legacy co tracking implant/thiet bi theo serial number: phan loai capability nay trong capability matrix. Neu implement, lam nhu mot extension cua Inventory chu khong phai model rieng trong Healthcare.

**CCCXXXVI. Implant traceability giu o P0** — `ImplantRecord`, `InventorySerial`

Neu legacy ho tro truy vet implant VA no quan trong ve mat y khoa: bao toan nguyen ven sang he moi o muc uu tien P0 (khong duoc drop hay ha uu tien khi migrate).

**CCCXXXVII. Archaeology khong gioi han o vi du trong prompt** — `LegacyCapabilityMatrix`

Khong duoc gioi han archaeology trong pham vi cac vi du prompt neu ra. Toi thieu phai ra soat ZenithTasks 7 nhom sau: surgeon workflow, nurse checklist, pre-op screening, postoperative care, material lot, clinical photo, case accounting links. Nhom nao da mature trong legacy thi phai map vao capability matrix va ke hoach Phan 7.

### legacy-rules-agents-arch — spec dòng 4598–4816 (20 yêu cầu)

**CCCXXXVII. LEGACY SPECIAL FEATURES — khảo cổ không giới hạn ở ví dụ trong prompt** — `SurgeonWorkflow`, `NurseChecklist`, `PreOpScreening`, `PostOpCare`, `MaterialLot`, `ClinicalPhoto`, `CaseAccountingLink`, `LEGACY_CAPABILITY_MATRIX`

Khi khảo cổ ZenithTasks cho Phần 7, KHÔNG chỉ dò đúng các feature mà prompt đã nêu tên. Phải chủ động dò và map (ghi vào docs/legacy/LEGACY_CAPABILITY_MATRIX.md) 7 nhóm năng lực lâm sàng nếu legacy đã có ở mức trưởng thành (mature): (1) surgeon workflow — luồng làm việc của bác sĩ phẫu thuật; (2) nurse checklist — checklist điều dưỡng; (3) pre-op screening — sàng lọc trước mổ; (4) postoperative care — chăm sóc hậu phẫu; (5) material lot — lô vật tư; (6) clinical photo — ảnh lâm sàng; (7) case accounting links — liên kết ca lâm sàng với kế toán/tài chính. Mỗi nhóm ghi: có tồn tại không, mức trưởng thành, model/bảng dữ liệu liên quan, quyết định port/retire.

**CCCXXXVIII. CAPABILITY MATRIX THẮNG GIẢ ĐỊNH** — `LEGACY_CAPABILITY_MATRIX`

Nếu năng lực legacy có thật trong source/schema ZenithTasks thì PHẢI ghi vào capability matrix, kể cả khi Master Prompt Phần 7 không nhắc tên năng lực đó. Cấm bỏ sót một capability chỉ vì prompt không liệt kê. Capability matrix (bằng chứng từ source thật) có thẩm quyền cao hơn danh sách giả định trong prompt.

**CCCXXXIX. KHÔNG BẢO TỒN DUPLICATION XẤU** — `LEGACY_CAPABILITY_MATRIX`

Preserve jobs, không preserve mọi màn hình. Ví dụ chuẩn trong spec: legacy có 3 màn hình customer view khác nhau → target chỉ giữ lại các 'job' (việc người dùng cần làm) mà 3 màn hình đó phục vụ, hợp nhất thành thiết kế màn hình tối thiểu; không port cả 3 screen sang target. Khi hợp nhất, ghi rõ trong capability matrix: các screen legacy nào đã được gộp vào đâu và job nào được giữ.

**CCCXL. LEGACY UNUSED FEATURES — được phép RETIRE** — `LEGACY_CAPABILITY_MATRIX`

Feature legacy không có real usage, không có test, không có business value → được phép RETIRE (không port sang Phần 7). Bắt buộc DOCUMENT quyết định retire (feature nào, lý do: không dùng / không test / không giá trị nghiệp vụ) trong tài liệu khảo cổ, không im lặng bỏ qua.

**CCCXLI. DEAD CODE**

Dead code trong legacy: KHÔNG port sang target. Không copy sang codebase Phần 7 dù dưới dạng comment/file tham chiếu.

**CCCXLII. HISTORICAL BUG WORKAROUNDS**

Trước khi port bất kỳ đoạn code trông như workaround cho bug lịch sử, phải hiểu vì sao nó tồn tại. Workaround đó có thể đang mã hoá một business rule thật (quy tắc nghiệp vụ lâm sàng/kế toán). Không được xoá hoặc 'dọn dẹp' workaround theo cảm tính; phải xác định nó là bug-fix kỹ thuật hay business rule rồi mới quyết định port/bỏ.

**CCCXLIII. LEGACY TESTS AS SPEC**

Test legacy mô tả hành vi nghiệp vụ có ý nghĩa được coi là bằng chứng mạnh (strong evidence) về đặc tả nghiệp vụ. Khi khảo cổ, đọc test legacy như một nguồn spec để rút yêu cầu cho Phần 7, không chỉ đọc source.

**CCCXLIV. XUNG ĐỘT GIỮA SOURCE VÀ TEST LEGACY** — `LEGACY_CAPABILITY_MATRIX`

Khi source legacy và test legacy mâu thuẫn nhau: phải điều tra, không chọn bừa một bên. Xác định (a) hành vi hiện tại thật sự của source và (b) business intent đằng sau. Ghi lại (record) kết luận điều tra và lựa chọn hành vi cho target vào tài liệu khảo cổ.

**CCCXLV. CLINICAL MIGRATION EVIDENCE**

Quyết định migration lâm sàng KHÔNG được dựa duy nhất vào nhãn UI (UI labels) của legacy. Phải kiểm tra schema và quan hệ dữ liệu thật (bảng, khoá ngoại, cardinality) để xác định ý nghĩa thực của một khái niệm lâm sàng trước khi map sang model target.

**CCCXLVI. REAL PRODUCTION DATA INSPECTION**

Không truy cập dữ liệu production thật trừ khi (1) được cho phép tường minh VÀ (2) đã được provisioning an toàn. Phần 7 mặc định làm việc chỉ trên schema và source code legacy, không trên dữ liệu production.

**CCCXLVII. SCHEMA SPIKE**

Được phép làm schema spike: dựng fixture migration tổng hợp (synthetic) dựa trên schema legacy để thử nghiệm mapping, thay cho việc dùng dữ liệu thật.

**CCCXLVIII. MIGRATION ADAPTERS** — `LegacyClinicReader`, `TargetHealthcareImporter`

Được phép (nếu hữu ích) tạo hai interface adapter cho migration: `LegacyClinicReader` (đọc dữ liệu lâm sàng từ nguồn legacy) và `TargetHealthcareImporter` (nạp vào model healthcare của target). Ràng buộc cứng: KHÔNG kết nối các adapter này tới production.

**CCCXLIX. VỊ TRÍ CODE CÔNG CỤ MIGRATION** — `LegacyClinicReader`, `TargetHealthcareImporter`

Code công cụ migration phải nằm tách biệt khỏi code runtime của ứng dụng (thư mục/package riêng, không nằm trong đường dẫn runtime của app Next.js). Runtime không được import code migration.

**CCCL. HEALTHCARE TEST DATA GENERATOR** — `HealthcareTestDataGenerator`

Xây generator dữ liệu test healthcare để sinh kịch bản synthetic phong phú (rich synthetic scenarios) phục vụ test và seed, thay cho dữ liệu thật.

**CCCLI. FRESH DB TEST** — `HealthcareTestDataGenerator`

Phải có bài kiểm tra fresh-DB chạy được từ database target rỗng theo đúng chuỗi: migrate → seed dữ liệu healthcare synthetic → chạy toàn bộ test → build. Kết quả bắt buộc: PASS toàn chuỗi.

**CCCLII. LEGACY PARITY TEST** — `LegacyClinicReader`, `TargetHealthcareImporter`

Phải có test parity: cho một fixture legacy synthetic tương đương, output của hệ target phải bảo toàn các fact (dữ kiện nghiệp vụ) của legacy — không mất, không biến dạng dữ kiện khi qua migration/adapter.

**CCCLIII. CLINICAL ACCESS RED TEAM** — `Company`, `Ecosystem`

Phải có một reviewer chuyên trách (dedicated reviewer) làm red team về access control lâm sàng, thử tối thiểu 9 vector: (1) đoán ID (ID guessing); (2) truy cập trực tiếp URL file; (3) rò rỉ qua search; (4) truy cập qua API; (5) đọc được qua cached response; (6) rò rỉ qua chức năng export; (7) gọi trực tiếp server action; (8) truy cập từ sai Company; (9) truy cập từ sai Ecosystem. Mỗi vector phải bị chặn.

**CCCLIV. CLINICAL INTEGRITY RED TEAM** — `ClinicalNote`, `Consent`, `Procedure`, `MaterialIssue`, `ClinicalPhoto`, `Case`

Phải red team về toàn vẹn dữ liệu lâm sàng, thử tối thiểu 7 kịch bản và tất cả đều phải bị hệ thống từ chối: (1) finalize hai lần; (2) sửa clinical note đã final; (3) thực hiện procedure khi chưa có consent; (4) xuất/issue vật tư hai lần (material double issue); (5) làm mất version của consent; (6) hoán đổi quan hệ của clinical photo (gắn ảnh sang bệnh nhân/ca khác); (7) đóng case khi state không hợp lệ.

**CCCLV. UX REVIEWER**

Phải có bước review UX dùng personas. Tiêu chí đạt: bác sĩ không phải điều hướng qua độ phức tạp của ERP để làm việc lâm sàng — luồng lâm sàng phải tách khỏi/che đi tầng ERP nền (Finance/Inventory/Payroll...).

**CCCLVI. LEGACY CLINIC USER REVIEW**

Phải so sánh các critical flow lâm sàng của target với UX cũ của phòng khám legacy. Tiêu chí đạt: trải nghiệm target bằng hoặc tốt hơn legacy trên từng critical flow; nếu kém hơn phải sửa trước khi coi là xong.

### orchestration-events-reports — spec dòng 4960–5165 (24 yêu cầu)

**CCCLXIX. Clinical Event Model — không event sourcing** — `ClinicalCase`, `Encounter`, `Procedure`, `FollowUp`, `ApplicationEvent`

Không xây event sourcing cho domain Healthcare: trạng thái lâm sàng (Case, Encounter, Procedure, Follow-up...) được lưu dưới dạng current-state rows trong Prisma như các Phần 3-6, KHÔNG dựng event store / event replay / projection để tái tạo state. Chỉ được phép dùng 'application events' nhẹ (in-process domain event / hook sau transaction) khi thực sự có ích cho việc kích hoạt side-effect (vd tạo Work item, gửi nhắc follow-up, ghi audit) — và event đó không phải nguồn sự thật của state.

**CCCLXX. No Kafka — vẫn modular monolith** — `HealthcareModule`, `ModularMonolith`

Không đưa Kafka hay bất kỳ message broker ngoài nào vào kiến trúc cho Phần 7. Healthcare vertical phải chạy trong cùng modular monolith Next.js 16 + Prisma 7 + PostgreSQL đã có: giao tiếp giữa module bằng service call in-process theo ranh giới module, không qua hạ tầng streaming/queue phân tán.

**CCCLXXI. Không universal medical form builder** — `ClinicalForm`, `ConsentForm`, `FormSchema`

Không xây form builder y tế tổng quát (metadata-driven, người dùng tự định nghĩa field/validation runtime). Các biểu mẫu có cấu trúc (bệnh án, phiếu khám, phiếu thủ thuật, consent...) được implement dạng code/domain-specific: schema Prisma + type + validation TypeScript cụ thể cho từng loại form. Chỉ cân nhắc form builder nếu sau này có nhu cầu sản phẩm thực tế được xác nhận.

**CCCLXXII. Dynamic form metadata — không phải ưu tiên phase này** — `FormMetadata`

Cơ chế form metadata động (định nghĩa field/section/validation lưu trong DB, render runtime) không nằm trong phạm vi Phần 7. Không thiết kế bảng metadata form, không thêm cột JSON 'formDefinition' để mở đường cho nó. Ghi nhận là hướng tương lai, không implement.

**CCCLXXIII. Template versioning cho Consent/clinical template** — `ConsentTemplate`, `ConsentTemplateVersion`, `ClinicalTemplate`, `ClinicalTemplateVersion`

Áp dụng versioning cho template Consent và các clinical template: mỗi template có nhiều version (version number, nội dung, trạng thái active/retired, thời điểm hiệu lực); bản ghi đã ký/đã dùng phải trỏ tới đúng version tại thời điểm sử dụng và version đó là immutable. KHÔNG áp versioning cho mọi form/template trong hệ thống — chỉ nhóm Consent và clinical template.

**CCCLXXIV. Clinical document versioning — chỉ nơi thực sự cần** — `ClinicalDocument`, `DocumentVersion`

Chỉ bật versioning cho các clinical document mà việc giữ lịch sử là thực sự có ý nghĩa (vd tài liệu đã ký, tài liệu pháp lý/consent). Không mặc định versioning toàn bộ clinical document; những document còn lại chỉ cần cập nhật tại chỗ + audit trail thông thường. Danh sách document nào được versioning phải được chốt tường minh (xem decisionsNeeded).

**CCCLXXV. Healthcare reports — tối thiểu, hướng vận hành** — `ClinicalCase`, `Procedure`, `FollowUp`, `HealthcareReport`

Chỉ implement 3 báo cáo vận hành tối thiểu cho Healthcare: (1) số case được mở (cases opened) theo kỳ, (2) danh sách/số lượng procedure trong ngày (procedures today), (3) follow-up quá hạn (follow-ups overdue). Mọi báo cáo scope theo Company và theo permission người xem. Không xây BI platform kiểu bệnh viện (cube, drill-down đa chiều, dashboard builder, data warehouse).

**CCCLXXVI. Medical outcome metrics — không tự bịa** — `OutcomeMetric`

Không tự định nghĩa/không tự tính bất kỳ chỉ số kết quả điều trị (medical outcome metric: tỷ lệ thành công, cải thiện lâm sàng, recovery rate...). Không thêm field/report cho nhóm chỉ số này khi chưa có định nghĩa nghiệp vụ do phía y tế cung cấp.

**CCCLXXVII. Clinical quality metrics — để tương lai** — `ClinicalQualityMetric`

Bộ chỉ số chất lượng lâm sàng (clinical quality metrics) không thuộc phạm vi Phần 7. Không thiết kế model, không thêm report, không thêm cột dữ liệu chuẩn bị cho nó.

**CCCLXXVIII. Founder healthcare summary — operational, hạn chế PHI** — `FounderSummary`, `PHI`, `Ecosystem`, `Company`

Màn hình tổng hợp Healthcare ở tầng Founder/Ecosystem chỉ hiển thị dữ liệu vận hành (số liệu tổng hợp, đếm, ngoại lệ quy trình) và phải tránh lộ PHI không cần thiết: không hiển thị nội dung lâm sàng chi tiết, chẩn đoán, ghi chú khám, hay danh tính bệnh nhân nếu không cần cho mục đích vận hành. Việc Founder xem được summary này KHÔNG cấp quyền đọc dữ liệu lâm sàng chi tiết của Company (giữ nguyên invariant CompanyMembership tường minh).

**CCCLXXIX. Company manager summary — counts + workflow exceptions** — `CompanyManagerSummary`, `WorkflowException`, `ClinicalNote`

Màn hình tổng hợp cho quản lý cấp Company hiển thị: các con số đếm (case, appointment, procedure, follow-up...) và các ngoại lệ quy trình (workflow exception: quá hạn, thiếu bước, chờ xử lý). Mặc định KHÔNG hiển thị clinical note chi tiết; muốn xem chi tiết lâm sàng phải có permission lâm sàng tường minh riêng.

**CCCLXXX. Doctor home** — `DoctorHome`, `Appointment`, `ClinicalCase`, `FollowUp`

Trang home cho người có permission bác sĩ gồm 4 khối chính: (1) 'Hôm nay' — việc/lịch trong ngày, (2) Appointments của bác sĩ đó, (3) Cases requiring action — case cần bác sĩ xử lý, (4) Follow-ups. Dữ liệu lọc theo Company context hiện tại và theo permission, không hard-code theo tên role.

**CCCLXXXI. Nurse home** — `NurseHome`, `Work`, `Procedure`

Trang home cho điều dưỡng hiển thị: các Work item liên quan tới người dùng đó và phần chuẩn bị thủ thuật (procedure prep) — danh sách procedure sắp diễn ra cần chuẩn bị. Tái dùng module Work đã có ở Phần 3-6, không tạo hệ task riêng cho healthcare.

**CCCLXXXII. Reception home** — `ReceptionHome`, `Appointment`, `Customer`

Trang home cho lễ tân hiển thị các tác vụ vận hành về lịch hẹn và khách hàng: appointment trong ngày/sắp tới và các việc vận hành liên quan customer (check-in, xác nhận, tiếp đón). Không hiển thị nội dung lâm sàng chi tiết trừ khi có permission.

**CCCLXXXIII. Care home** — `CareHome`, `FollowUp`, `Customer`

Trang home cho bộ phận chăm sóc khách hàng hiển thị follow-up cần thực hiện và các tác vụ customer care (tái dùng CRM follow-up của Phần 3-6), giới hạn ở phạm vi thông tin cần cho chăm sóc.

**CCCLXXXIV. Role-based nav dựa trên permission** — `Navigation`, `Permission`, `Position`, `PositionPreset`, `CompanyMembership`

Điều hướng/menu và việc chọn home screen phải quyết định bằng permission đã resolve (src/lib/permissions + authorization context), TUYỆT ĐỐI không viết điều kiện dạng `if (role === 'DOCTOR')` trong UI hay API. Position và preset của Position đóng góp permission vào tập quyền hiệu dụng của người dùng trong Company; nav chỉ đọc tập permission đó.

**CCCLXXXV. Migration role phòng khám legacy** — `LegacyClinicRole`, `CompanyMembership`, `Position`, `PermissionPack`, `User`

6 role legacy của hệ phòng khám cũ — DOCTOR, NURSE, RECEPTION, CONSULTANT, CARE, TELESALE — được ánh xạ thành tổ hợp: CompanyMembership (trên đúng Company) + Position + gói permission Healthcare/CRM tương ứng. KHÔNG tạo global role mới, không thêm enum role toàn hệ thống, không thêm cột role trên User. Cần bảng ánh xạ legacy-role → (Position, permission pack) và migration script/seed tương ứng.

**CCCLXXXVI. Consultant role** — `Position`, `PermissionPack`

CONSULTANT được mô hình hóa như một Position (thuộc nhánh Sales hoặc Healthcare) chứ không phải role toàn cục. Trước khi chốt nhánh, phải đánh giá dữ liệu/hành vi thực tế của role này trong hệ legacy (assess source) để quyết định gói permission.

**CCCLXXXVII. Telesale** — `Position`, `PermissionPack`, `CRM`, `Sales`

TELESALE là Position thuộc CRM/Sales, không phải role healthcare core: gói permission mặc định chỉ gồm quyền CRM/Sales, không cấp quyền truy cập dữ liệu lâm sàng.

**CCCLXXXVIII. Care** — `Position`, `PermissionPack`, `FollowUp`, `Policy`

CARE có thể là tổ hợp quyền CRM follow-up + một phần ngữ cảnh healthcare bị giới hạn. Ranh giới 'limited healthcare context' phải được viết thành policy tường minh (permission cụ thể: được đọc gì, không được đọc gì), không để ngầm định theo UI.

**CCCLXXXIX. Manager** — `Permission`, `Company`, `OrganizationUnit`

MANAGER được biểu diễn bằng permission ở phạm vi Company/Unit (Organization) đã có sẵn, và không mặc định kèm quyền lâm sàng: quyền quản lý không tự động cho phép đọc dữ liệu clinical.

**CCCXC. Admin** — `LegacyClinicRole`, `Founder`, `EcosystemMembership`, `CompanyMembership`

Role ADMIN của hệ legacy KHÔNG được tự động ánh xạ thành Founder/Ecosystem-tier. Migration phải map ADMIN thành quyền ở tầng Company (hoặc quyền quản trị hạn chế) trừ khi có quyết định tường minh cho từng người dùng cụ thể.

**CCCXCI. Shareholder** — `Shareholder`, `Company`, `Permission`

SHAREHOLDER không phải role healthcare: không cấp bất kỳ permission Healthcare nào cho quan hệ cổ đông; nó chỉ là quan hệ sở hữu/tài chính ở tầng Company.

**CCCXCII. Collaborator** — `Collaborator`, `Referral`, `CompanyMembership`

COLLABORATOR có thể là quan hệ bên ngoài / quan hệ giới thiệu (referral) chứ không phải nhân sự nội bộ; không mặc định cấp CompanyMembership nội bộ hay permission lâm sàng cho collaborator. Mô hình cụ thể (external party vs referral partner) cần được chốt trước khi implement.

### roles-tail — spec dòng 5119–6191 (86 yêu cầu)

**CCCLXXXVI. Legacy role CONSULTANT mapping** — `LegacyRole:CONSULTANT`, `RoleMigrationMap`, `PermissionPack`

Trong role migration map (legacy ZenithTasks Clinic -> target), role CONSULTANT phai duoc danh gia theo nguon goc thuc te ('assess source') truoc khi map: no co the la vi tri Sales hoac vi tri Healthcare. Khong duoc map cung nhac vao mot ben; phai ghi ro ket luan mapping + ly do vao role migration map. Neu la Sales thi chi cap permission pack CRM/Sales, neu la Healthcare thi cap healthcare permission pack tuong ung.

**CCCLXXXVII. Legacy role TELESALE mapping** — `LegacyRole:TELESALE`, `RoleMigrationMap`, `CRM`, `Sales`

Role TELESALE la vi tri CRM/Sales, KHONG phai healthcare core role. Map sang permission pack CRM/Sales cua Core (Phan 3-6), khong cap quyen doc clinical record/consultation/photo mac dinh.

**CCCLXXXVIII. Legacy role CARE mapping** — `LegacyRole:CARE`, `MedicalFollowUp`, `PermissionPolicy`

Role CARE co the ket hop CRM follow-up + healthcare context GIOI HAN. Phai co policy tuong minh (explicit policy) dinh nghia chinh xac phan healthcare nao CARE duoc thay (vd: chi lich follow-up, khong doc clinical note day du); khong de mac dinh/ngam hieu. Policy nay phai enforce bang permission check + test.

**CCCLXXXIX. Legacy role MANAGER mapping** — `LegacyRole:MANAGER`, `Company`, `OrganizationUnit`

Role MANAGER map sang quyen o tang Company/Unit (Organization), KHONG mac nhien la vai tro lam sang (clinical). Khong tu dong cap quyen doc/ghi clinical record cho MANAGER chi vi ten role.

**CCCXC. Legacy role ADMIN mapping** — `LegacyRole:ADMIN`, `Founder`, `EcosystemMembership`, `CompanyMembership`

KHONG map tu dong legacy role ADMIN sang Founder/Ecosystem-tier role. Mapping ADMIN phai duoc quyet dinh tuong minh va van tuan invariant: khong role Ecosystem-tier nao tu dong ghi duoc vao mot Company cu the neu khong co CompanyMembership tuong minh.

**CCCXCI. Legacy role SHAREHOLDER mapping** — `LegacyRole:SHAREHOLDER`, `RoleMigrationMap`

SHAREHOLDER khong phai healthcare role. Khong cap bat ky healthcare permission pack nao; giu o pham vi Core (company/shareholder view) trong role migration map.

**CCCXCII. Legacy role COLLABORATOR mapping** — `LegacyRole:COLLABORATOR`, `RoleMigrationMap`, `Referral`

COLLABORATOR co the la quan he external/referral (cong tac vien gioi thieu ben ngoai). Phan 7 KHONG duoc ep COLLABORATOR vao mot clinical role. Map theo quan he external/referral trong Core, khong cap quyen lam sang mac dinh.

**CCCXCIII. Legacy parity report cuoi Phan 7** — `LegacyCapabilityMatrix`, `ParityReport`

Cuoi Phase 7 phai xuat bao cao parity liet ke: tong so capability cua Legacy Clinic; so luong Ported; so luong Merged into Core; so luong Implemented Healthcare; so luong Deferred; so luong Retired; so luong Unknown. Bao cao phai cong du tong (khong duoc co gap khong giai thich) — 'no silent gaps'.

**CCCXCIV. P0 parity phai dong truoc Phan 8** — `ParityReport`, `P0`

Khong duoc con bat ky healthcare capability muc P0 nao o trang thai UNKNOWN truoc khi sang Part 8, tru khi co blocker that su va da document ro rang (ly do + huong xu ly).

**CCCXCV. P1 duoc defer** — `ParityReport`, `P1`

Cac hang muc P1 (polish) duoc phep defer sang sau, mien la duoc ghi vao muc Deferred cua parity report/checkpoint.

**CCCXCVI. Clinical security la P0** — `PHI`, `Company`, `SecurityTest`

Bat ky ro ri PHI qua bien Company (cross-company leak) nao deu la P0 va BLOCK phase — khong duoc advance Phan 7 khi con ton tai. Phai co security test chung minh.

**CCCXCVII. Clinical integrity la P0** — `MedicalCase`, `Consultation`, `Procedure`, `AuditLog`

Mat du lieu lam sang hoac sua doi lich su (history mutation) la P0 va block phase. Lich su clinical record phai bat bien/traceable sau finalization.

**CCCXCVIII. Material traceability P0 co dieu kien** — `ProcedureMaterialUsage`, `StockMovement`, `Inventory`

Truy vet vat tu (material traceability) duoc xep P0 NEU legacy hoac nghiep vu yeu cau. Phai xac dinh dieu kien nay tu legacy archaeology roi ghi ket luan; neu la P0 thi ProcedureMaterialUsage + StockMovement phai truy vet duoc day du.

**CCCXCIX. Mat file anh lam sang la P0** — `ClinicalPhoto`, `MigrationSpec`

Kien truc migration anh lam sang (clinical photo) phai bao toan file — khong duoc lam mat anh trong qua trinh chuyen doi. File loss la P0.

**CD. Mat du lieu form la P0** — `Consultation`, `ConsultationDraft`

Ban nhap tu van dai (long consultation draft) khong duoc bien mat trong luong save binh thuong. Neu khong co autosave thi phai co UX save tuong minh (nut save ro rang, canh bao khi roi trang chua luu).

**CDI. UX P0 — hanh dong lam sang phai truy cap duoc** — `UX`, `ClinicalAction`

Neu mot hanh dong lam sang quan trong khong the truy cap duoc tu UI thi day la loi P0.

**CDII. Backend-only khong tinh la DONE** — `Procedure`, `API`, `UI`

API ton tai nhung khong clinician nao cham toi duoc qua UI thi KHONG duoc tinh la DONE. Vi du: Procedure API co nhung khong co man hinh/nut cho bac si -> chua DONE. Moi capability healthcare phai end-to-end UI -> policy -> domain -> data -> verify.

**CDIII. Ho tro mobile/tablet cho form lam sang** — `UX`, `Responsive`, `ClinicalForm`

Nhan vien lam sang co the dung tablet/mobile, nen cac form quan trong phai dung duoc tren tablet/mobile. Khong bat buoc lam EMR hoan hao tren dien thoai neu khong thuc te.

**CDIV. Desktop cho tu van phuc tap** — `UX`, `Responsive`, `Consultation`

Man hinh tu van phuc tap uu tien desktop; layout phai responsive nhung khong duoc vo/mat chuc nang khi thu nho (no destructive layout).

**CDV. Accessibility toi thieu** — `Accessibility`, `UX`

Moi form/man hinh healthcare phai co: label cho input, dieu huong duoc bang ban phim, do tuong phan mau doc duoc.

**CDVI. Clinical photo viewer** — `ClinicalPhoto`, `PhotoViewer`, `FileSecurity`

Trinh xem anh lam sang phai dung duoc (zoom/xem binh thuong) va KHONG duoc vo tinh lo duong download truc tiep file goc (no accidental download exposure).

**CDVII. Empty states huu ich** — `UX`, `EmptyState`

Cac man hinh healthcare khi khong co du lieu phai hien empty state huu ich (giai thich va goi y hanh dong tiep theo), khong de trong tron.

**CDVIII. Warning bang ngon ngu nghiep vu** — `UX`, `ConsentRecord`, `Procedure`

Thong bao canh bao dung ngon ngu nghiep vu, khong dung ngon ngu ky thuat. Vi du dung: 'Chua co phieu dong y phu hop cho thu thuat nay.' Vi du SAI: 'Consent FK missing.'

**CDIX. Confirmation cho finalization** — `Consultation`, `Procedure`, `Finalization`

Cac hanh dong finalize lam sang co tac dong lon phai co buoc xac nhan ro rang khi viec do huu ich (vd finalize consultation/procedure record).

**CDX. Khong gay alert fatigue** — `UX`, `Warning`

Khong canh bao o moi field. Chi canh bao tai cac diem thuc su quan trong (vd thieu consent truoc thu thuat), tranh lam nguoi dung bo qua canh bao.

**CDXI. Healthcare module settings toi thieu** — `HealthcareSettings`, `ConsentTemplate`

Man hinh cai dat module Healthcare giu toi thieu, vi du: ten co so (facility name), chuyen khoa mac dinh (default specialty), mau phieu dong y (consent templates). Khong expose setting cua framework ra UI.

**CDXII. Advanced settings an di** — `HealthcareSettings`

Cau hinh ky thuat (technical config) phai duoc an, khong hien trong UI cai dat thong thuong cua module Healthcare.

**CDXIII. AI config thuoc Part 8** — `AIConfig`

Khong lam AI configuration trong Phan 7 — de sang Part 8.

**CDXIV. Healthcare template la onboarding preset** — `CompanyOnboarding`, `HealthcareTemplate`

Cau hinh Healthcare co the tro thanh preset onboarding cua Company sau nay. Trong Phan 7 KHONG xay dung template marketplace.

**CDXV. Company thong thuong khong thay bang healthcare** — `Company`, `HealthcareModule`, `UI`

Voi Company khong bat Healthcare: khong bang/man hinh healthcare nao duoc xuat hien trong UI. Viec cac model healthcare nam chung mot database vat ly la chap nhan duoc.

**CDXVI. Chinh sach disable module Healthcare** — `HealthcareModule`, `ModuleToggle`

Neu module Healthcare da co du lieu that thi khong duoc tuy tien disable roi an mat quyen truy cap quan trong. Chinh sach co the: chan tao thao tac moi (disable new operations) nhung van giu quyen doc/quyen admin. Chi tiet quan tri de sang Part 9.

**CDXVII. Khong cho xoa module** — `HealthcareModule`

Khong ho tro xoa (delete) module Healthcare.

**CDXVIII. Schema migration duoc version control** — `PrismaMigration`, `Schema`

Moi thay doi schema healthcare phai qua migration duoc version control trong repo target (Prisma migrations), khong sua truc tiep DB.

**CDXIX. Fresh migration phai PASS** — `PrismaMigration`, `FreshDB`

Chay migration tu database trong (fresh) phai thanh cong het (PASS) — la gate bat buoc.

**CDXX. Khong duplicate schema cua Core** — `ClinicCustomer`, `MedicalAppointment`, `ClinicPayment`, `ClinicPayroll`, `ClinicInventory`, `ClinicTask`

Phai search trong schema/code target cac ten: ClinicCustomer, MedicalAppointment, ClinicPayment, ClinicPayroll, ClinicInventory, ClinicTask. Neu tim thay -> hoac giai trinh ly do chinh dang, hoac xoa va dung model Core (Customer, Appointment, Payment, Payroll, Inventory, Task).

**CDXXI. Khong dung prefix legacy** — `NamingConvention`

Khong dat ten model kieu ZHealthcare* chi de bat chuoc legacy. Dung tu vung target sach (HealthcareProfile, MedicalCase, Consultation, Procedure, ConsentRecord, ClinicalPhoto, MedicalFollowUp, ProcedureMaterialUsage).

**CDXXII. Tai lieu domain Healthcare** — `docs/verticals/HEALTHCARE.md`

Tao hoac cap nhat file docs/verticals/HEALTHCARE.md mo ta vertical Healthcare.

**CDXXIII. Tai lieu domain model** — `docs/verticals/HEALTHCARE_DOMAIN_MODEL.md`

Tao docs/verticals/HEALTHCARE_DOMAIN_MODEL.md neu thay huu ich (mo ta cac entity va quan he cua domain healthcare).

**CDXXIV. Tai lieu legacy parity** — `docs/legacy/CLINIC_PARITY_MATRIX.md`, `LEGACY_CAPABILITY_MATRIX`

Tao/cap nhat docs/legacy/CLINIC_PARITY_MATRIX.md, hoac tich hop vao master capability matrix da co.

**CDXXV. Tai lieu bao mat du lieu lam sang** — `docs/security/HEALTHCARE_DATA_SECURITY.md`, `PHI`

Tao docs/security/HEALTHCARE_DATA_SECURITY.md neu huu ich (mo hinh bao ve PHI, file security, audit).

**CDXXVI. Tai lieu migration mapping** — `docs/migration/CLINIC_TO_HEALTHCARE_MAPPING.md`

Tao docs/migration/CLINIC_TO_HEALTHCARE_MAPPING.md — mapping tu model/logic legacy Clinic sang model Healthcare target.

**CDXXVII. Tai lieu workflow Healthcare** — `HealthcareWorkflow`, `Documentation`

Viet tai lieu mo ta cac luong nghiep vu chinh cua Healthcare (reception -> doctor -> procedure -> follow-up).

**CDXXVIII. Khong nhan ban noi dung tai lieu** — `Documentation`

Neu master docs da bao phu noi dung nao thi link toi thay vi chep lai trong tai lieu healthcare.

**CDXXIX. ADR — Healthcare la vertical** — `ADR`, `docs/architecture/DECISIONS.md`

ADR 'Healthcare as vertical' co the da ton tai tu Phase 2; cap nhat lai ADR nay theo phan implementation thuc te cua Phan 7.

**CDXXX. ADR — Patient model** — `ADR`, `HealthcareProfile`

Viet ADR cho quyet dinh patient model neu quyet dinh ve HealthcareProfile la material (co anh huong kien truc).

**CDXXXI. ADR — Case model** — `ADR`, `MedicalCase`

Viet ADR cho MedicalCase neu can.

**CDXXXII. ADR — Clinical record finalization** — `ADR`, `Finalization`, `Consultation`, `Procedure`

Viet ADR cho chinh sach finalization ban ghi lam sang — muc nay duoc danh dau la quan trong (Important), khong duoc bo qua.

**CDXXXIII. ADR — Clinical photos** — `ADR`, `ClinicalPhoto`, `FileStorage`

Viet ADR cho mo hinh luu tru va bao mat file anh lam sang (file storage/security model).

**CDXXXIV. ADR — Material usage** — `ADR`, `ProcedureMaterialUsage`, `Inventory`

Viet ADR cho tich hop material usage voi Inventory Core.

**CDXXXV. Cap nhat Data Ownership Matrix** — `HealthcareProfile`, `MedicalCase`, `Consultation`, `Procedure`, `Consent`, `ClinicalPhoto`, `MedicalFollowUp`, `ProcedureMaterialUsage`

Cap nhat data ownership matrix voi cac entity healthcare, tat ca thuoc so huu COMPANY: HealthcareProfile, MedicalCase, Consultation, Procedure, Consent, ClinicalPhoto, MedicalFollowUp, ProcedureMaterialUsage.

**CDXXXVI. Cap nhat Canonical Source Matrix** — `Consultation`, `Procedure`, `ConsentRecord`, `ClinicalPhoto`, `ProcedureMaterialUsage`, `StockMovement`, `MedicalFollowUp`

Bo sung vao canonical source matrix: su kien tu van lam sang -> Consultation; thu thuat da thuc hien -> Procedure; dong y cua benh nhan -> ConsentRecord; anh lam sang -> ClinicalPhoto; vat tu tieu hao -> ProcedureMaterialUsage + StockMovement; ket qua tai kham -> MedicalFollowUp.

**CDXXXVII. AI summary khong phai canonical** — `AISummary`, `CanonicalSourceMatrix`

Ghi ro tuong minh trong tai lieu/matrix: ban tom tat do AI sinh KHONG phai nguon canonical cua su that lam sang.

**CDXXXVIII. Cap nhat tai lieu permission** — `PermissionPack`, `docs/security/AUTHORIZATION_MODEL.md`

Cap nhat tai lieu permission voi cac healthcare permission pack moi.

**CDXXXIX. Role migration map bat buoc** — `RoleMigrationMap`

Role migration map (legacy Clinic role -> role/permission pack target) la BAT BUOC, phai ton tai va duoc document.

**CDXL. Salvage ledger** — `SalvageLedger`, `LegacyCapabilityMatrix`

Ghi lai chinh xac nhung gi da salvage tu legacy: model nao, logic nao, test nao, component nao, workflow nao.

**CDXLI. Code comment khong ke lich su** — `CodeStyle`, `Documentation`

Khong nhoi lich su/khao co legacy vao comment trong source code. Lich su thuoc ve architecture docs.

**CDXLII. Phan loai test suite** — `TestSuite`

To chuc test theo cac nhom de xuat: healthcare.unit, healthcare.integration, healthcare.security, healthcare.parity, healthcare.e2e. Cach dat ten cu the theo convention cua project.

**CDXLIII. Static gates** — `CI`, `Typecheck`, `Lint`, `Build`

typecheck, lint, build deu phai PASS.

**CDXLIV. Unit gates** — `MedicalCase`, `Procedure`, `MedicalFollowUp`, `ProcedureMaterialUsage`

Unit test bat buoc phu: chuyen trang thai (state transitions), dieu kien san sang (readiness), finalization, quy tac follow-up, so luong vat tu (material quantity).

**CDXLV. Integration gates** — `Customer`, `Appointment`, `Work`, `Inventory`, `File`, `AuditLog`

Integration test bat buoc phu tich hop voi: Customer, Appointment, Work, Inventory, File, Audit.

**CDXLVI. Security gates** — `SecurityTest`, `Company`, `Permission`

Security test phai phu ca cross-company (tenant isolation) va phan quyen theo role.

**CDXLVII. File security gates** — `ClinicalPhoto`, `FileSecurity`

Phai co test cho truong hop tai truc tiep file (direct download) — URL file khong duoc truy cap duoc neu khong qua kiem tra quyen.

**CDXLVIII. Parity gates** — `ParityTest`, `LegacyCapabilityMatrix`

Parity test phai phu cac cong viec (job) quan trong cua legacy Clinic.

**CDXLIX. Browser gates** — `E2ETest`, `Reception`, `Doctor`, `Procedure`, `MedicalFollowUp`

Browser/e2e test phai phu 4 luong: Reception, Doctor, Procedure, Follow-up.

**CDL. Fresh DB gate** — `FreshDB`, `Migration`

Chay tren database moi hoan toan phai PASS.

**CDLI. Regression Phan 3-6** — `RegressionTest`, `Company`

Toan bo test cua Phan 3-6 van phai PASS. Healthcare khong duoc lam hong cac Company thong thuong.

**CDLII. Regression cho Company thong thuong** — `CRM`, `Sales`, `Finance`, `RegressionTest`

CRM / Sales / Finance van hoat dong binh thuong khi khong bat module Healthcare — phai co test chung minh.

**CDLIII. Khong coupling module** — `Core`, `MedicalCase`

Core khong duoc phu thuoc vao MedicalCase (hay bat ky model healthcare nao). Phai co regression test chung minh khong coupling.

**CDLIV. Hieu nang case list va timeline** — `MedicalCase`, `Timeline`, `ClinicalPhoto`, `Performance`

Danh sach case va timeline phai co hieu nang hop ly; khong duoc load toan bo anh/blob khi render list hoac timeline.

**CDLV. Hieu nang file** — `ClinicalPhoto`, `Thumbnail`, `Performance`

Trang danh sach chi tai thumbnail/metadata cua anh, khong tai file goc kich thuoc lon.

**CDLVI. Review bao mat P0** — `SecurityReview`, `P0`

Khong duoc con van de bao mat P0 nao chua giai quyet (unresolved) khi ket thuc Phan 7.

**CDLVII. Review parity P0** — `ParityReview`, `P0`

Khong duoc mat bat ky capability legacy quan trong (critical) nao.

**CDLVIII. Definition of Done — Healthcare Core** — `MedicalCase`, `Consultation`, `Procedure`, `ConsentRecord`, `ClinicalPhoto`, `MedicalFollowUp`, `ProcedureMaterialUsage`, `Customer`, `Appointment`, `Work`, `Finance`, `Inventory`

Healthcare Core cua Phan 7 chi DONE khi du 21 dieu kien: (1) Healthcare la vertical; (2) tai su dung Customer Core; (3) tai su dung Appointment Core; (4) tai su dung Work Core; (5) tai su dung Finance Core; (6) tai su dung Inventory Core; (7) MedicalCase da implement; (8) Consultation da implement o nhung cho legacy yeu cau; (9) Screening/Indication da mapped; (10) Procedure da implement; (11) Consent da implement; (12) Clinical photo da implement; (13) Follow-up da implement; (14) Material usage da tich hop; (15) permissions da tich hop; (16) audit da tich hop; (17) co clinical finalization policy; (18) tenant isolation; (19) file security; (20) co role migration strategy; (21) hanh trinh e2e tren du lieu synthetic chay duoc.

**CDLIX. Definition of Done — Legacy Parity** — `LegacyCapabilityMatrix`, `ParityReport`, `MigrationMapping`

Parity chi DONE khi: (1) da nhan dien tat ca capability quan trong cua Clinic legacy; (2) moi capability duoc phan loai Core/Vertical/etc; (3) khong con P0 unknown; (4) capability generic khong bi duplicate; (5) capability dac thu healthcare da duoc map; (6) test co gia tri da duoc salvage; (7) co migration mapping; (8) KHONG migrate du lieu that; (9) khong retire ngam (no silent retirement); (10) parity summary da cap nhat.

**CDLX. Definition of Done — Safety** — `PHI`, `AuditLog`, `ClinicalPhoto`, `ProcedureMaterialUsage`, `AI`

Safety DONE khi du 10 dieu: (1) clinical record duoc bao ve; (2) ban ghi final truy vet duoc; (3) anh la private; (4) PHI khong bi ghi vao log; (5) tan cong bang ID truc tiep bi tu choi; (6) bien gioi Company duoc giu; (7) bien gioi permission duoc giu; (8) hanh dong nhay cam duoc audit; (9) tru vat tu idempotent; (10) AI khong the vuot qua tham quyen lam sang cua con nguoi.

**CDLXI. Overall Part 7 DONE** — `Part7`, `Checkpoint`, `ZenithTasks`

Phan 7 chi hoan tat khi du 21 muc: (1) Healthcare Vertical implement sach; (2) Core van generic; (3) khong tao lai 'Clinic universe'; (4) khao co legacy Clinic da lam den do sau P0/P1; (5) parity quan trong da chung minh; (6) data mapping da document; (7) role mapping da document; (8) clinical security pass; (9) cross-company test pass; (10) file security pass; (11) integration test pass; (12) browser journey pass; (13) fresh DB pass; (14) regression Phan 3-6 pass; (15) red-team khong con P0 chua giai quyet; (16) docs da cap nhat; (17) capability matrix da cap nhat; (18) da commit vao target repo; (19) ZenithTasks khong bi thay doi; (20) production khong bi dung toi; (21) checkpoint hoan tat.

**CDLXII. Bo cau hoi anti-drift truoc khi dong phase** — `AntiDriftChecklist`, `MedicalCase`, `ClinicalPhoto`, `Doctor`, `Reception`, `AI`

Truoc khi ket thuc phase phai tra loi 15 cau va ket qua phai dung nhu sau: (1) Healthcare co Customer rieng? NO; (2) co Appointment engine rieng? NO tru khi chung minh khong the tranh; (3) co Payment rieng? NO; (4) co Payroll rieng? NO; (5) co Inventory rieng? NO; (6) co Task engine rieng? NO; (7) MedicalCase co Company ownership ro? YES; (8) clinical photo private? YES; (9) ban ghi lam sang final auditable? YES; (10) Doctor con la global User role? NO; (11) Reception doc duoc toan bo clinical note chi vi ten role? NO; (12) Clinic co dang tro lai thanh Product Core? NO; (13) Company thong thuong dung duoc app ma khong biet Healthcare ton tai? YES; (14) capability Clinic quan trong cua ZenithTasks co bi mat? NO; (15) AI da duoc phep tu chan doan/finalize clinical record chua? NO.

**CDLXIII. Failure policy — P0 chan tien do** — `P0`, `FailurePolicy`

Gap loi P0 thi KHONG duoc di tiep. Danh sach vi du P0: ro ri du lieu lam sang cross-company; ro ri anh private; lich su quan trong bi sua/xoa ngam; tru vat tu thu thuat 2 lan (double deduction); mat capability legacy P0; sai quan he benh nhan - ca benh (patient-case); leo thang quyen (permission escalation); AI vuot rao lam sang.

**CDLXIV. P1 duoc dua vao backlog** — `P1`, `Backlog`

Duoc phep backlog cac hang muc P1: polish UI thuan tham my; bao cao tuy chon; so sanh anh nang cao; quan ly template nang cao.

**CDLXV. Vong lap tu sua loi (autonomous fix loop)** — `Workflow`, `AutonomousFixLoop`

Ap dung vong lap: IMPLEMENT -> TEST -> (FAIL) -> ROOT CAUSE -> FIX -> TARGET TEST -> REGRESSION -> SECURITY TEST -> PARITY TEST. Khong hoi nguoi dung ve cac lua chon ky thuat thong thuong.

**CDLXVI. Dieu kien HARD BLOCK duy nhat** — `HardBlock`, `Workflow`

Chi duoc dung lai (hard block) khi: can du lieu benh nhan tren production; can thuc hien hanh dong pha huy tren production; khong xac dinh duoc ngu nghia lam sang legacy va rui ro mat du lieu la dang ke; yeu cau phap ly/lam sang can quyet dinh chinh sach cua con nguoi ma khong co phuong an an toan/dao nguoc duoc; thieu credential khong the gia lap; phu thuoc ngoai co phi khong the tranh. Ngoai cac truong hop nay -> tiep tuc lam.

**CDLXVII. Cam dung du lieu production** — `ProductionData`

Bat buoc: khong dung du lieu production trong Phan 7.

**CDLXVIII. Cam lien he benh nhan that** — `Notification`, `Patient`

Khong gui SMS/Zalo/email toi benh nhan that trong bat ky luong nao cua Phan 7.

**CDLXIX. Cam hanh dong lam sang that** — `ClinicalAction`, `SyntheticData`

Chi duoc thuc hien hanh dong lam sang tren du lieu test/synthetic.

**CDLXX. Khong cutover production** — `Deploy`, `Production`

Khong deploy/cutover production trong Phan 7 — viec do thuoc Part 10.

**CDLXXI. Noi dung checkpoint bat buoc** — `Checkpoint`, `docs/checkpoints/LATEST.md`

Checkpoint cuoi Phan 7 phai chua day du cac muc: PART 7; HEALTHCARE / AESTHETICS VERTICAL + CLINIC LEGACY PARITY; TARGET HEAD; HEALTHCARE DOMAIN MODEL; CUSTOMER INTEGRATION; APPOINTMENT INTEGRATION; WORK INTEGRATION; FINANCE INTEGRATION; INVENTORY INTEGRATION; MEDICAL CASE; CONSULTATION; SCREENING; INDICATION; PROCEDURE; CONSENT; CLINICAL PHOTO; FOLLOW-UP; MATERIAL USAGE; CLINICAL FINALIZATION POLICY; HEALTHCARE PERMISSIONS; LEGACY CLINIC CAPABILITY COUNT; CORE-MAPPED CAPABILITIES; HEALTHCARE-MAPPED CAPABILITIES; RETIRED CAPABILITIES; DEFERRED CAPABILITIES; UNKNOWN CAPABILITIES; LEGACY ROLE MAP; CLINICAL SECURITY TESTS; TENANT TESTS; FILE SECURITY TESTS; PARITY TESTS; BROWSER TESTS; FRESH DB TEST; REGRESSION TESTS; MIGRATION MAPPING STATUS; OPEN RISKS; DEFERRED ITEMS; DO NOT REDO; NEXT.

