# Phần 7 — Phân loại model legacy (ĐÃ XÁC MINH bằng đọc định nghĩa thật)

Nguồn: `C:\Users\PC\ZenithTasks` @ `e420e380` — `web/prisma/schema.prisma`.
Sinh từ workflow `part7-understand` (4 agent khảo cổ, scope tách bạch theo mục CCCLVIII).
Mọi dòng đều có `evidence` là trích dẫn field/relation thật đã đọc — **không suy đoán từ tên model**
(đây là điều kiện của mục VI: *"Không classification → không migrate"*).

**12 model** đã phân loại. Bảng tổng hợp:

| Model | Dòng | Phân loại | Ánh xạ target |
|---|---|---|---|
| `CaseRecord` | 597 | HEALTHCARE_VERTICAL | PHẢI TÁCH, không map 1-1 được: (a) khối tài chính totalAmount/discountAmount/paidAmount/debtAmount/voucher* → Sale (đã có, Phần 3-6) — đây là phần LEGACY_DUPLIC |
| `ConsultationRecord` | 1154 | HEALTHCARE_VERTICAL | KHONG duoc phu boi bat ky entity nao trong Phan 3-6 (CustomerInteraction/Appointment khong chua sinh hieu hay sang loc benh su) -> can entity MOI o Phan 7, vi d |
| `ConsentTemplate` | 928 | HEALTHCARE_VERTICAL | CHƯA có entity tương ứng ở Phần 3-6 (CatalogItem là hàng hoá/dịch vụ bán, không phải mẫu văn bản). Đề xuất Phần 7: tách 2 tầng — (a) GENERIC_CORE `DocumentTempl |
| `CaseConsent` | 940 | HEALTHCARE_VERTICAL | KHÔNG được phủ bởi bất kỳ entity nào ở Phần 3-6 (WorkItem/Appointment/Sale/CatalogItem đều không mang ngữ nghĩa đồng thuận y khoa). Cần entity MỚI ở tầng health |
| `Photo` | 704 | AESTHETICS_SPECIALIZATION | CHƯA CÓ trong danh sách Phần 3-6 (không có entity Attachment/Document/MediaAsset nào). Đề xuất tách 2 tầng: (1) GENERIC_CORE `Attachment` (owner đa hình + url/m |
| `CaseDocument` | 978 | GENERIC_CORE | KHÔNG có entity nào ở Phần 3-6 phủ việc đính kèm tệp. Đề xuất Phần 7: một entity đính kèm dùng chung `Attachment` (companyId, ownerType, ownerId, title, fileNam |
| `StaffAgreement` | 1188 | GENERIC_CORE | KHÔNG có entity nào ở Phần 3-6 phủ (PayrollProfile là lương, CompanyMembership là tư cách thành viên, Assignment là phân công — không cái nào mang chứng từ pháp |
| `CaseRevenueAllocation` | 1031 | GENERIC_CORE | CHƯA có entity tương đương 1-1 trong Phần 3-6, nhưng thuộc tầng generic. Gần nhất: **CommissionRule** (chính sách) và **CommissionCalculation** (kết quả) — mode |
| `CaseService` | 646 | LEGACY_DUPLICATE | SaleLine (đã có ở Phần 3-6) cho toàn bộ phần giá/số lượng/chiết khấu/snapshot; serviceId → CatalogItem; doctorId/nurseId → KHÔNG giữ dạng cột, chuyển sang Assig |
| `Service` | 525 | LEGACY_DUPLICATE | CatalogItem (đã có ở Phần 3-6) — toàn bộ 7 trường map thẳng, không thiếu gì. Phần mở rộng duy nhất cần bổ sung: quan hệ materials (ServiceMaterial/BOM) → nối Ca |
| `FollowUp` | 719 | LEGACY_DUPLICATE | Appointment (da co san o Phan 3-6). FollowUp KHONG phai mot khai niem nghiep vu khac Appointment — no ton tai chi vi khiem khuyet mo hinh du lieu legacy: Appoin |
| `MaterialUsage` | 687 | LEGACY_DUPLICATE | Đã được phủ bởi **StockMovement** (Phần 3-6, đã implement) + **InventoryItem**. Mỗi MaterialUsage hiện đang được ghi ĐÔI cùng một StockMovement OUT trong cùng t |

## HEALTHCARE_VERTICAL

### `CaseRecord` — `web/prisma/schema.prisma:597`

**Bản chất.** God-model gộp 5 trách nhiệm khác nhau vào 1 bảng: (1) đầu mục đơn hàng/hoá đơn (totalAmount, discountAmount, paidAmount, debtAmount, voucherCode/voucherAmount); (2) tập y khoa/lâm sàng (chiefComplaint, doctorId, quan hệ consultation/consents/photos/followUps); (3) kết quả phễu bán hàng (consultResult PENDING|AGREED|CONSIDERING|DECLINED, comment ghi rõ 'Phục vụ tính tỉ lệ chốt tư vấn'); (4) hoa hồng giới thiệu CTV (collaboratorId, commissionAmount nhập tay, collaboratorAssignedAt); (5) khoá bản ghi tự chế (locked/lockedAt/lockedById). Nó là trục trung tâm mà 12 model khác treo vào.

**Ánh xạ target.** PHẢI TÁCH, không map 1-1 được: (a) khối tài chính totalAmount/discountAmount/paidAmount/debtAmount/voucher* → Sale (đã có, Phần 3-6) — đây là phần LEGACY_DUPLICATE rõ rệt; (b) payments → Payment (đã có); (c) consultResult → giai đoạn phễu của Lead (đã có) hoặc trường stage trên Sale; (d) collaboratorId + commissionAmount + revenueAllocations → CommissionRule/CommissionCalculation (đã có), bỏ hẳn kiểu nhập tay; (e) locked/lockedAt/lockedById → ApprovalRequest + AuditEvent (đã có); (f) customer → Customer (đã có), appointment → Appointment (đã có); (g) PHẦN CÒN LẠI chưa có target: chiefComplaint + doctorId lâm sàng + consultation/consents/photos/followUps → cần entity mới thuộc tầng HEALTHCARE_VERTICAL của Phần 7 (kiểu ClinicalEncounter / EpisodeOfCare) liên kết 1-n với Sale; (h) debtPlan (lịch trả góp) KHÔNG có entity tương ứng trong Phần 3-6 → khoảng trống cần bổ sung.

**Field chính.**
- `id: String @id @default(cuid())`
- `code: String @unique — mã hồ sơ (vd HS000123), trường duy nhất có ràng buộc unique trong cả 3 model`
- `customerId: String (bắt buộc, FK Customer)`
- `consultantId: String? / doctorId: String? — 2 slot vai trò cố định, quan hệ đặt tên "CaseConsultant" / "CaseDoctor"`
- `status: CaseStatus @default(OPEN) — enum: OPEN, CONSULTED, SERVICED, COMPLETED, CANCELLED (dòng 78-84)`
- `consultResult: ConsultResult @default(PENDING) — enum: PENDING, AGREED, CONSIDERING, DECLINED (dòng 86-91)`
- `chiefComplaint: String? — comment 'Nhu cầu / lý do của khách'`
- `totalAmount / discountAmount / paidAmount / debtAmount: Decimal @default(0) @db.Decimal(14,0) — comment 'Số tiền (VND, không phần lẻ). totalAmount = tổng finalPrice các dịch vụ', 'debtAmount = total - paid'`
- `voucherCode: String? + voucherAmount: Decimal @db.Decimal(14,0)`
- `commissionAmount: Decimal @db.Decimal(14,0) — comment 'Hoa hồng cộng tác viên giới thiệu khách (số tiền nhập tay)'`
- `collaboratorId: String? + collaboratorAssignedAt: DateTime?`
- `locked: Boolean @default(false) + lockedAt: DateTime? + lockedById: String? — comment 'sau khi khóa, nhân viên không sửa được (chỉ quản trị mở lại)'`
- `createdById: String?, createdAt, updatedAt, completedAt: DateTime?`
- `KHÔNG có companyId / ecosystemId / tenantId`
- `KHÔNG có bất kỳ khối @@index / @@unique nào (đã grep vùng 595-675: không có dòng @@ nào)`

**Quan hệ.**
- customer: Customer (bắt buộc, không onDelete → chặn xoá khách còn hồ sơ)
- consultant / doctor / createdBy: User? qua 3 relation đặt tên riêng CaseConsultant, CaseDoctor, CaseCreatedBy
- collaborator: Collaborator? @relation(onDelete: SetNull)
- services: CaseService[] (con, Cascade từ phía CaseService)
- payments: Payment[] (Cascade)
- materials: MaterialUsage[] (Cascade)
- photos: Photo[] (caseId nullable phía Photo)
- followUps: FollowUp[]
- appointment: Appointment? — quan hệ 1-1 (phía Appointment caseId là @unique)
- consents: CaseConsent[]
- documents: CaseDocument[]
- debtPlan: DebtPlan? — 1-1, kế hoạch trả góp/hẹn nợ
- revenueAllocations: CaseRevenueAllocation[] — bảng phụ chia doanh thu theo userId/role/shareBps (model ở dòng 1031)
- consultation: ConsultationRecord? — 1-1, sổ tư vấn điện tử

**Bằng chứng.** Trích trực tiếp dòng 606-617: 'status CaseStatus @default(OPEN)' / 'consultResult ConsultResult @default(PENDING) // Phục vụ tính tỉ lệ chốt tư vấn' / 'chiefComplaint String? // Nhu cầu / lý do của khách' / '// Số tiền (VND, không phần lẻ). totalAmount = tổng finalPrice các dịch vụ.' / 'debtAmount Decimal ... // = total - paid' / '// Voucher giảm thêm trên tổng hồ sơ (giảm cả công nợ lẫn doanh thu tính hoa hồng).'. Dòng 623-631: '// Khóa hồ sơ: sau khi khóa, nhân viên không sửa được (chỉ quản trị mở lại). locked Boolean @default(false)' và '// Hoa hồng cộng tác viên giới thiệu khách (số tiền nhập tay). commissionAmount Decimal'. Quan hệ lâm sàng ở dòng 636-643: 'photos Photo[]', 'consents CaseConsent[]', 'consultation ConsultationRecord?'. Đường ghi thật: C:/Users/PC/ZenithTasks/web/src/app/(app)/tiep-nhan/actions.ts:108-119 tạo CaseRecord ngay lúc tiếp nhận khách với 'status: "OPEN"' và 'note: "Hồ sơ nháp tự tạo khi tiếp nhận khách mới"'. Toán tiền do app giữ, không do DB: C:/Users/PC/ZenithTasks/web/src/app/(app)/ho-so/actions.ts:59-70 hàm recalc() đọc caseService + payment rồi 'db.caseRecord.update({ data: { totalAmount, discountAmount, paidAmount, debtAmount } })'.

**Rủi ro khi migrate.**
- 4 cột tiền là số denormalize, chỉ đúng nếu MỌI đường ghi đều đi qua recalc() (ho-so/actions.ts:59). Bất kỳ chỗ nào ghi CaseService/Payment mà quên gọi recalc là hồ sơ lệch tiền vĩnh viễn — DB không có ràng buộc nào bảo vệ.
- KHÔNG có một @@index nào dù đây là bảng nóng nhất. ho-so/page.tsx:46-70 lọc theo consultantId/doctorId/status rồi 'orderBy: { createdAt: "desc" }' + phân trang skip/take — toàn bộ chạy trên cột không index.
- Không có companyId/ecosystemId → khoá cứng single-tenant, không phục vụ được mô hình Ecosystem/Company của Phần 3-6.
- commissionAmount nhập tay (comment ghi rõ) → hoa hồng giới thiệu không truy vết được về quy tắc nào; Phần 3-6 đã có CommissionRule/CommissionCalculation nên đây là nợ kỹ thuật phải bỏ, không được bê nguyên.
- appointment: Appointment? là 1-1 (caseId @unique phía Appointment) → 1 hồ sơ không thể có nhiều lịch hẹn; hệ thống đã phải đẻ ra model FollowUp riêng để lách. Khi map sang Appointment của Phần 3-6 phải chuyển thành 1-n, nếu không sẽ tái tạo đúng khuyết tật cũ.
- Vai trò nhân sự bị đóng cứng thành 2 cột consultantId/doctorId; đã phải vá bằng bảng phụ CaseRevenueAllocation (dòng 642, 1031) — bằng chứng thiết kế slot cố định đã thất bại ngay trong chính legacy.
- Decimal(14,0) không phần lẻ, không có cột currency → chỉ VND. Cũng không có bất kỳ trường thuế/VAT nào.
- tiep-nhan/actions.ts:108 tạo hồ sơ NHÁP tự động cho mọi khách mới → số lượng CaseRecord KHÔNG bằng số đơn hàng thật. Nếu migrate thẳng CaseRecord → Sale sẽ sinh ra hàng loạt Sale rỗng giả.

### `ConsultationRecord` — `web/prisma/schema.prisma:1154`

**Bản chất.** Phieu kham/tu van lam sang gan 1-1 voi CaseRecord: luu sinh hieu (mach, huyet ap, nhiet do, nhip tho, SpO2), the trang (can nang, chieu cao, nhom mau), nguoi lien he khan cap, bang sang loc benh su dang Json, xac nhan cua benh nhan, mong muon / hien trang / ket qua du tinh / chi dinh cua bac si, va noi dung de-len rieng cho ban in. Duoc tao TU DONG ngay khi tiep nhan khach (tiep-nhan/actions.ts:120 va :175, cung transaction voi CaseRecord) va sua qua saveConsultationRecord (ho-so/actions.ts:153-194); render ban in qua lib/consultation-sheet.ts voi tieu de 'HO SO DICH VU THAM MY' va 18 muc sang loc.

**Ánh xạ target.** KHONG duoc phu boi bat ky entity nao trong Phan 3-6 (CustomerInteraction/Appointment khong chua sinh hieu hay sang loc benh su) -> can entity MOI o Phan 7, vi du ClinicalEncounter (hoac ConsultationRecord) thuoc module healthcare vertical, gan vao entity thay the CaseRecord. Cac field mang tinh tham my thuan tuy (wants, expectedResult, serviceSnapshot, tieu de 'HO SO DICH VU THAM MY') nen tach ra thanh phan mo rong AESTHETICS_SPECIALIZATION, khong tron vao lop lam sang chung. Tuyet doi khong anh xa vao CustomerInteraction.

**Field chính.**
- `id:String @id @default(cuid())`
- `caseId:String @unique (khoa 1-1 voi CaseRecord, onDelete: Cascade)`
- `weightKg:Decimal? @db.Decimal(5,2)`
- `heightCm:Decimal? @db.Decimal(5,2)`
- `bloodType:String?`
- `emergencyName:String?`
- `emergencyPhone:String?`
- `pulse:Int?`
- `bloodPressure:String?`
- `temperatureC:Decimal? @db.Decimal(4,1)`
- `respiratoryRate:Int?`
- `spo2:Int?`
- `screening:Json? (khong co schema DB; app ep kieu {[key]:{abnormal:boolean,note:string}} qua normalizeScreening/defaultScreening, 18 muc CONSULTATION_SCREENING_ITEMS: Huyet ap, Tim mach, Tieu duong, Ho hap, Benh truyen nhiem, Tuyen giap, Mau kho dong, Di ung thuoc, Di ung thuc an/cao su, Thuoc chong dong, Thuoc nam/bac/TPCN, Thuoc la/ruou bia, Chat kich thich, Phau thuat truoc day, Bien chung gay te/gay me, Mang thai, Cho con bu, Ky kinh nguyet)`
- `patientConfirmed:Boolean @default(false)`
- `patientConfirmedAt:DateTime?`
- `wants:String?`
- `currentCondition:String?`
- `expectedResult:String?`
- `doctorIndication:String?`
- `serviceSnapshot:Json? (thuc te chi luu {autoCreatedFromCustomer:true} hoac {initialInterest:...})`
- `printOverrides:Json? (comment trong schema: 'Noi dung de rieng cho ban in; khong thay doi du lieu y khoa/ho so nguon')`
- `createdById:String?`
- `createdAt:DateTime @default(now())`
- `updatedAt:DateTime @updatedAt`
- `finalizedAt:DateTime?`
- `finalizedById:String?`

**Quan hệ.**
- case CaseRecord @relation(fields: [caseId], references: [id], onDelete: Cascade) — 1-1, caseId @unique; phia CaseRecord la 'consultation ConsultationRecord?' (schema dong 643)
- createdBy User? @relation("ConsultationCreatedBy", fields: [createdById], references: [id])
- finalizedById: KHONG co quan he khai bao (khong co field finalizedBy User?) — la cot rong khong duoc rang buoc
- Index duy nhat: @@index([createdAt])

**Bằng chứng.** Dinh nghia that dong 1154-1186: 'pulse Int?', 'bloodPressure String?', 'temperatureC Decimal? @db.Decimal(4,1)', 'respiratoryRate Int?', 'spo2 Int?', 'screening Json?', 'doctorIndication String?' — day la du lieu y khoa (sinh hieu + sang loc benh su + chi dinh bac si), khong phai du lieu ban hang/CRM chung. Rang buoc 'caseId String @unique' + 'case CaseRecord @relation(..., onDelete: Cascade)' chung to day la ho so lam sang gan chat vao 1 ca dieu tri. Muc dich duoc xac nhan boi lib/consultation-sheet.ts:7-26 (18 cau sang loc y te: 'Cao huyet ap hoac huyet ap thap', 'Di ung thuoc (khang sinh, thuoc te, thuoc me...)', 'Dang mang thai hoac nghi ngo mang thai?') va ho-so/actions.ts:154 'requireCap("case.clinical")'.

**Rủi ro khi migrate.**
- finalizedById (dong 1183) KHONG co quan he khai bao va KHONG duoc ghi o bat ky dau trong src (grep chi tim thay finalizedById trong lib/v2-payroll-governance-actions.ts:77 — do la ZWorkspacePayrollRun, model khac). Chi finalizedAt duoc ghi (ho-so/actions.ts:184). => cot chet, khong the truy ai la nguoi chot phieu.
- createdById bi GHI DE moi lan sua: object 'data' o ho-so/actions.ts:178-185 chua 'createdById: user.id' va duoc dung cho CA hai nhanh update (dong 188) lan create (dong 189). => 'createdBy' thuc chat la 'nguoi sua cuoi cung', khong phai nguoi tao; khong co truong updatedById rieng. Phan 7 phai tach createdBy/updatedBy.
- 3 khoi Json khong co schema DB (screening, serviceSnapshot, printOverrides). screening chi duoc chuan hoa o tang ung dung (normalizeScreening, con doc tuong thich kieu boolean cu tai consultation-sheet.ts:35-40) => du lieu y khoa lich su co the ton tai o 2 dinh dang khac nhau trong cung 1 cot.
- printOverrides cho phep de noi dung ban in khac du lieu nguon; DB khong rang buoc gi. Chi co kiem soat o tang action (saveConsultationPrintOverrides, ho-so/actions.ts:223-232). Voi ho so y te day la rui ro toan ven/phap ly can duoc mo hinh hoa tuong minh (versioning ban in) o Phan 7 thay vi 1 cot Json tu do.
- Rang buoc 1-1 (caseId @unique) khoa cung 'moi ca dieu tri chi co 1 phieu tu van'. Khong luu duoc nhieu lan tu van/tai kham lam sang theo thoi gian tren cung 1 ca — Phan 7 nen cho N encounter tren 1 case.
- onDelete: Cascade tren caseId => xoa CaseRecord la mat toan bo du lieu y khoa. Ho so y te thuong co nghia vu luu tru; khong co soft-delete hay archive.
- Khong co cot dinh danh don vi/cong ty (khong co companyId/ecosystemId) => gia dinh 1 phong kham duy nhat, khong tuong thich voi Company/Ecosystem da co o Phan 3-6.
- Chi co @@index([createdAt]); khong co index theo createdById du co truy van/audit theo nguoi tao.

### `ConsentTemplate` — `web/prisma/schema.prisma:928`

**Bản chất.** Thư viện MẪU văn bản đồng ý/cam kết soạn sẵn (thân bài có placeholder thay thế lúc lập phiếu). Không gắn với khách/hồ sơ nào; chỉ là nguồn để sinh ra CaseConsent. Quan hệ 1-n duy nhất của nó là tới CaseConsent nên phạm vi sử dụng bị khoá vào nghiệp vụ phiếu đồng ý điều trị, không phải kho tài liệu dùng chung.

**Ánh xạ target.** CHƯA có entity tương ứng ở Phần 3-6 (CatalogItem là hàng hoá/dịch vụ bán, không phải mẫu văn bản). Đề xuất Phần 7: tách 2 tầng — (a) GENERIC_CORE `DocumentTemplate` (companyId, kind, title, body, placeholders, version, active) vì cấu trúc field hoàn toàn trung tính; (b) tầng healthcare chỉ dùng kind='CONSENT'. KHÔNG bê nguyên ConsentTemplate sang vì nó đang ràng buộc cứng vào CaseConsent.

**Field chính.**
- `id:String @id @default(cuid())`
- `title:String — comment: 'Tên phiếu, vd "Phiếu đồng ý phẫu thuật thẩm mỹ"'`
- `body:String — comment: 'Nội dung phiếu (văn bản). Có thể chứa {{tên}}, {{ngày}}, {{dịch vụ}}'`
- `active:Boolean @default(true)`
- `createdAt:DateTime @default(now())`
- `updatedAt:DateTime @updatedAt`

**Quan hệ.**
- consents CaseConsent[] (1-n, quan hệ DUY NHẤT của model này)
- KHÔNG có createdById/User, KHÔNG có companyId/ecosystemId — không có bất kỳ trường chủ sở hữu hay tenant nào

**Bằng chứng.** Dòng 928-936: `model ConsentTemplate { id String @id ...; title String // Tên phiếu, vd "Phiếu đồng ý phẫu thuật thẩm mỹ"; body String // Nội dung phiếu (văn bản). Có thể chứa {{tên}}, {{ngày}}, {{dịch vụ}}.; active Boolean @default(true); ...; consents CaseConsent[] }`. Comment header dòng 927: 'Mẫu phiếu (đồng ý phẫu thuật, cam kết, mẫu hồ sơ y khoa…) — quản trị soạn sẵn nội dung.' Sử dụng thật: `web/src/app/(app)/mau-phieu/actions.ts:20` `prisma.consentTemplate.create({ data: parsed.data })`, `:47` `prisma.consentTemplate.delete(...)`; `web/src/app/(app)/ho-so/[id]/page.tsx:114` `prisma.consentTemplate.findMany({ where: { active: true }, orderBy: { title: "asc" }, select: { id, title, body } })` rồi truyền `templates={consentTemplates}` (dòng 470) cho widget lập phiếu đồng ý trong hồ sơ.

**Rủi ro khi migrate.**
- MỒ CÔI GIAO DIỆN QUẢN TRỊ: `mau-phieu/page.tsx:17` gọi `await requireCap("mod:mau-phieu")` nhưng grep `mau-phieu` trong `web/src/lib/permissions.ts` KHÔNG có kết quả nào → module key không còn tồn tại, route quản lý mẫu bị chặn. Trong khi đó `ho-so/[id]/page.tsx:114` VẪN đọc template active. Hệ quả: không ai tạo/sửa/tắt được mẫu nữa, chỉ dùng được các mẫu đã có sẵn trong DB. Khi migrate phải quyết: khôi phục màn quản trị hay coi dữ liệu template là read-only di sản.
- Không có version/hiệu lực theo thời gian: sửa `body` là ghi đè tại chỗ (`updateTemplate` dòng 30). An toàn hiện tại CHỈ nhờ CaseConsent snapshot lại nội dung; nếu Phần 7 bỏ snapshot mà trỏ FK thì mất tính pháp lý.
- Không có tenant/company scope → sang mô hình đa công ty của Phần 7 sẽ rò mẫu giữa các cơ sở nếu bê nguyên.
- `deleteTemplate` xoá cứng (`prisma.consentTemplate.delete`), không soft-delete, dù đã có sẵn cờ `active` để vô hiệu hoá.

### `CaseConsent` — `web/prisma/schema.prisma:940`

**Bản chất.** Bản ghi phiếu đồng ý ĐÃ ký gắn vào một hồ sơ điều trị (CaseRecord). Lưu SNAPSHOT title+body tại thời điểm ký nên độc lập với mẫu gốc về sau. Ghi nhận người ký và quan hệ nhân thân của người ký (trường hợp người giám hộ ký thay). Đây là chứng từ đồng thuận y khoa (informed consent), không phải hợp đồng thương mại.

**Ánh xạ target.** KHÔNG được phủ bởi bất kỳ entity nào ở Phần 3-6 (WorkItem/Appointment/Sale/CatalogItem đều không mang ngữ nghĩa đồng thuận y khoa). Cần entity MỚI ở tầng healthcare Phần 7, vd `ConsentRecord` gắn vào entity 'episode điều trị' (bản kế thừa của CaseRecord), giữ nguyên nguyên tắc snapshot nội dung + bổ sung trạng thái thu hồi/hết hiệu lực. Placeholder engine dùng lại `web/src/lib/consent.ts` (`fillConsentTemplate`, có test).

**Field chính.**
- `id:String @id @default(cuid())`
- `caseId:String (bắt buộc)`
- `templateId:String? (tuỳ chọn — cho phép phiếu tự do không theo mẫu)`
- `title:String — comment 'snapshot tên phiếu'`
- `body:String — comment 'snapshot nội dung'`
- `signerName:String — comment 'người ký (khách hoặc người giám hộ)'`
- `relationship:String? — comment 'quan hệ với khách nếu người giám hộ ký (vd "Mẹ", "Vợ")'`
- `signedAt:DateTime @default(now())`
- `note:String?`
- `createdById:String?`
- `createdAt:DateTime @default(now())`
- `@@index([caseId])`

**Quan hệ.**
- case CaseRecord @relation(fields: [caseId], references: [id], onDelete: Cascade) — phía CaseRecord là `consents CaseConsent[]` (dòng 639)
- template ConsentTemplate? @relation(fields: [templateId], references: [id]) — optional, không khai onDelete
- createdBy User? @relation(fields: [createdById], references: [id]) — phía User là `consentsRecorded CaseConsent[]` (dòng 305)

**Bằng chứng.** Dòng 940-957: `model CaseConsent { caseId String; case CaseRecord @relation(fields:[caseId], references:[id], onDelete: Cascade); templateId String?; template ConsentTemplate?; title String // snapshot tên phiếu; body String // snapshot nội dung; signerName String // người ký (khách hoặc người giám hộ); relationship String? // quan hệ với khách nếu người giám hộ ký (vd "Mẹ", "Vợ"); signedAt DateTime @default(now()); ... @@index([caseId]) }`. Comment dòng 938-939 nói rõ bản chất: 'Lưu SNAPSHOT nội dung tại thời điểm ký (mẫu có thể đổi sau). "Ký" ở đây là ghi nhận khách đã đồng ý/ký giấy — in ra cho khách ký tay.' Ghi thật: `ho-so/consent-actions.ts:49` `tx.caseConsent.create({ data: { caseId, templateId: d.templateId || null, title: d.title, ... } })` sau khi kiểm `canAccessCase(user, record, "clinical")` (dòng 46); xoá tại `:75` `tx.caseConsent.deleteMany({ where: { id, caseId } })` kèm audit `DELETE_CONSENT` (`:76`). Đọc để in: `ho-so/[id]/consent/[consentId]/page.tsx:17`.

**Rủi ro khi migrate.**
- `onDelete: Cascade` từ CaseRecord (dòng 943): xoá hồ sơ điều trị là XOÁ LUÔN phiếu đồng ý — mất chứng cứ pháp lý về đồng thuận y khoa. Phần 7 nên đổi sang Restrict/soft-delete hoặc lưu chứng từ ở kho bất biến.
- KHÔNG có trạng thái/thu hồi: không có `revokedAt`, `status`, `withdrawnBy`. Khách rút lại đồng ý thì hệ thống chỉ có cách XOÁ bản ghi (`deleteConsent`) — tức là xoá cả bằng chứng đã từng đồng ý. Đây là lỗ hổng nghiệp vụ, không phải chỉ thiếu field.
- `signedAt DateTime @default(now())` và không có chữ ký số/ảnh chữ ký/OTP: đây chỉ là GHI NHẬN nội bộ rằng khách đã ký giấy, giá trị pháp lý nằm ở bản in giấy — Phần 7 phải giữ đúng ngữ nghĩa này, đừng quảng cáo thành e-signature.
- Không liên kết phiếu đồng ý với DỊCH VỤ/thủ thuật cụ thể (không có serviceId/caseServiceId) → không chứng minh được 'đồng ý cho đúng thủ thuật đã làm' khi hồ sơ có nhiều dịch vụ.
- Không có tenant/company scope; `templateId` optional không khai `onDelete` (mặc định Prisma là SetNull cho quan hệ optional) → xoá mẫu thì phiếu mất tham chiếu nhưng vẫn còn snapshot (chấp nhận được, nhưng cần ghi rõ khi migrate).
- `relationship` là String tự do (vd 'Mẹ', 'Vợ') chứ không phải enum → không truy vấn/kiểm soát được trường hợp vị thành niên ký thay, vốn là điểm nhạy cảm nhất của thẩm mỹ.


## AESTHETICS_SPECIALIZATION

### `Photo` — `web/prisma/schema.prisma:704`

**Bản chất.** Ảnh đính kèm theo KHÁCH HÀNG (bắt buộc) và tuỳ chọn theo hồ sơ điều trị. Không phải model file đính kèm chung: enum PhotoType phân biệt ảnh trước/sau làm (kết quả thẩm mỹ), ảnh tái khám kèm số thứ tự lần tái khám, và ảnh cận lâm sàng (X-quang/CT/siêu âm). customerId bắt buộc + caseId nullable là thiết kế CÓ CHỦ Ý để ảnh sống sót khi xoá hồ sơ (code set caseId=null thay vì xoá ảnh). Chỉ lưu đường dẫn tương đối tới file trên đĩa, không lưu mime/kích thước/checksum.

**Ánh xạ target.** CHƯA CÓ trong danh sách Phần 3-6 (không có entity Attachment/Document/MediaAsset nào). Đề xuất tách 2 tầng: (1) GENERIC_CORE `Attachment` (owner đa hình + url/mime/size/uploadedBy/uploadedAt) gắn vào WorkItem/Customer; (2) AESTHETICS_SPECIALIZATION `TreatmentPhoto` giữ type BEFORE/AFTER/FOLLOW_UP + followUpIndex, và HEALTHCARE_VERTICAL `ClinicalImage` cho type CLINICAL (ảnh cận lâm sàng có chế độ xem/lưu trữ khác hẳn ảnh kết quả thẩm mỹ). Không map thẳng vào bất kỳ entity nào đã implement.

**Field chính.**
- `id:String @id @default(cuid())`
- `customerId:String (bắt buộc, FK Customer, KHÔNG khai onDelete)`
- `caseId:String? (FK CaseRecord, KHÔNG khai onDelete)`
- `type:PhotoType @default(BEFORE) — enum dòng 100-105: BEFORE (ảnh trước làm) | AFTER (ảnh sau làm) | FOLLOW_UP (ảnh tái khám theo tháng/lần) | CLINICAL (ảnh cận lâm sàng X-quang, CT, siêu âm)`
- `url:String // Đường dẫn ảnh đã lưu`
- `caption:String?`
- `followUpIndex:Int? // Lần/tháng tái khám (1, 2, 3...)`
- `takenAt:DateTime @default(now())`
- `uploadedById:String? + uploadedBy:User?`

**Quan hệ.**
- customer: Customer @relation(fields:[customerId], references:[id]) — bắt buộc, back-ref `photos Photo[]` tại dòng 436 (Customer)
- case: CaseRecord? @relation(fields:[caseId], references:[id]) — back-ref `photos Photo[]` tại dòng 636 (CaseRecord)
- uploadedBy: User? @relation(fields:[uploadedById], references:[id]) — back-ref `photos Photo[]` tại dòng 296 (User)

**Bằng chứng.** Dòng 710 `type PhotoType @default(BEFORE)` + enum dòng 100-105 có chú thích tiếng Việt ngay trong schema: `BEFORE // Ảnh trước làm`, `AFTER // Ảnh sau làm`, `FOLLOW_UP // Ảnh tái khám theo tháng/lần`, `CLINICAL // Ảnh cận lâm sàng (X-quang, CT, siêu âm…)`. Dòng 713 `followUpIndex Int? // Lần/tháng tái khám (1, 2, 3...)`. Bằng chứng CLINICAL bị đối xử khác: `web/src/app/khach/[token]/page.tsx:43` cổng khách lọc `photos: { where: { type: { not: "CLINICAL" } } }`; `web/src/app/(app)/khach-hang/[id]/page.tsx:88-92` chia 3 nhánh theo `scopedClinical`/`canViewClinical`, người không có quyền bị ép `where: { id: "__hidden__" }`. Bằng chứng caseId nullable là cố ý: `ho-so/actions.ts:1231` `await tx.photo.updateMany({ where: { caseId: id }, data: { caseId: null } })` khi xoá hồ sơ.

**Rủi ro khi migrate.**
- Xoá bản ghi Photo KHÔNG xoá file vật lý: `ho-so/actions.ts:1065-1075` `deletePhoto` chỉ gọi `tx.photo.deleteMany` + audit, không có `fs.rm` — file rác tồn đọng vĩnh viễn trong public/uploads (trong khi `uploadPhoto` dòng 1058-1060 lại có rollback xoá file khi transaction lỗi → xử lý bất đối xứng).
- KHÔNG có @@index nào (khác CaseRevenueAllocation có 2 index). Postgres/Prisma không tự tạo index cho FK → mọi truy vấn `where: { customerId }` / `where: { caseId }` (dùng ở trang khách hàng, hồ sơ, cổng khách) là seq scan; xoá khách hàng cũng phải quét toàn bảng.
- KHÔNG khai onDelete trên cả 2 quan hệ → mặc định Prisma: customer (bắt buộc) = Restrict, case (optional) = SetNull. Ứng dụng đang tự tay dọn (`khach-hang/actions.ts:176` `tx.photo.deleteMany({ where: { customerId: id } })`) — logic vòng đời nằm ở tầng code chứ không ở DB, dễ lệch nếu có đường ghi khác (vd `tro-ly/agent.ts:435` cũng phải lặp lại y hệt).
- Không có createdAt/updatedAt: chỉ có `takenAt @default(now())` mang ngữ nghĩa nghiệp vụ (thời điểm chụp) — không truy vết được thời điểm bản ghi thực sự được tạo/sửa. Ảnh y khoa mà thiếu cột kiểm toán là rủi ro tuân thủ.
- Không có mime/size/checksum/width/height, không có cờ đồng ý (consent) hay hạn lưu trữ cho ảnh cận lâm sàng.


## GENERIC_CORE

### `CaseDocument` — `web/prisma/schema.prisma:978`

**Bản chất.** Tệp giấy tờ hành chính đính kèm 1 hồ sơ điều trị (PDF/ảnh/Word/Excel) — cách thay thế cho việc gõ tay nội dung: nhân viên tải file đã soạn/đã ký lên rồi bấm xem qua /media/<tệp>. Cấu trúc field HOÀN TOÀN trung tính về ngành: chỉ là metadata tệp + chủ sở hữu là caseId.

**Ánh xạ target.** KHÔNG có entity nào ở Phần 3-6 phủ việc đính kèm tệp. Đề xuất Phần 7: một entity đính kèm dùng chung `Attachment` (companyId, ownerType, ownerId, title, fileName, storageKey, mime, sizeBytes, uploadedById, createdAt) thay cho BA model song song hiện có: CaseDocument (978), CollaboratorDocument (994, cấu trúc gần như trùng khít), và cặp fileName/fileUrl nhúng thẳng trong StaffAgreement (1200-1201). CaseDocument khi đó = Attachment với ownerType='CASE'.

**Field chính.**
- `id:String @id @default(cuid())`
- `caseId:String`
- `title:String — comment 'tiêu đề giấy tờ (vd "Phiếu đồng ý phẫu thuật")'`
- `fileName:String — comment 'tên tệp gốc để hiển thị'`
- `url:String — comment 'đường dẫn phục vụ qua /media/<tệp>'`
- `mime:String`
- `uploadedById:String?`
- `createdAt:DateTime @default(now())`
- `@@index([caseId])`

**Quan hệ.**
- case CaseRecord @relation(fields: [caseId], references: [id], onDelete: Cascade) — phía CaseRecord là `documents CaseDocument[]` (dòng 640)
- uploadedBy User? @relation("DocUploadedBy", fields: [uploadedById], references: [id]) — phía User là `documentsUploaded CaseDocument[] @relation("DocUploadedBy")` (dòng 308)

**Bằng chứng.** Dòng 978-991: `model CaseDocument { caseId String; case CaseRecord @relation(..., onDelete: Cascade); title String // tiêu đề giấy tờ; fileName String // tên tệp gốc để hiển thị; url String // đường dẫn phục vụ qua /media/<tệp>; mime String; uploadedById String?; uploadedBy User? @relation("DocUploadedBy", ...); @@index([caseId]) }` — KHÔNG có một field nào mang ngữ nghĩa y khoa. So sánh trực tiếp `model CollaboratorDocument` dòng 994-1004 có ĐÚNG bộ field `title/fileName/url/mime/uploadedById/uploadedBy/createdAt`, chỉ khác khoá ngoại là `collaboratorId`. Ghi thật: `ho-so/actions.ts:1102` `tx.caseDocument.create({ data: { caseId, title, fileName: file.name.slice(0,200), url: `/media/${fname}`, mime: file.type, uploadedById: user.id } })`, chặn 15MB + `isAllowedDocMime` + `isDocumentBufferValid` (dòng 1088-1091), audit `UPLOAD_DOCUMENT` (:1105). Xoá tại `:1120` `tx.caseDocument.deleteMany({ where: { id, caseId } })`.

**Rủi ro khi migrate.**
- RÒ TỆP MỒ CÔI: `deleteCaseDocument` (dòng 1114-1124) chỉ `deleteMany` bản ghi DB, KHÔNG có `fs.rm` xoá tệp vật lý (đối chiếu chính `uploadCaseDocument` dòng 1108 có `fs.rm` khi rollback). Cộng thêm `onDelete: Cascade` từ CaseRecord → xoá hồ sơ là mất hết hàng đính kèm trong DB nhưng file vẫn nằm mãi trong public/uploads. Phần 7 phải có vòng đời lưu trữ (storage lifecycle) chứ không chỉ FK.
- Không có `sizeBytes`/`checksum` dù action đã kiểm 15MB — không đối soát được tệp hỏng/thiếu, không tính được dung lượng theo công ty.
- `url` lưu đường dẫn ứng dụng (`/media/<tệp>`) chứ không phải storage key trung tính → khoá chặt vào cách phục vụ file hiện tại (thư mục public/uploads), khó chuyển sang S3/đối tượng lưu trữ ở Phần 7.
- Không có tenant/company scope; quyền truy cập tệp phụ thuộc hoàn toàn vào tầng route (/media + proxy) chứ không có trên dữ liệu.
- Trùng lặp mô hình 3 chỗ (CaseDocument / CollaboratorDocument / StaffAgreement.fileName+fileUrl) → mỗi chỗ một luật xoá, một luật kiểm mime, dễ lệch.

### `StaffAgreement` — `web/prisma/schema.prisma:1188`

**Bản chất.** Thoả thuận pháp lý giữa công ty và NHÂN SỰ (bảo mật / không cạnh tranh), có đánh version, snapshot nội dung, vòng đời trạng thái và khoảng hiệu lực. Kèm tuỳ chọn đính kèm bản scan đã ký. Đây là nghiệp vụ HR/pháp chế thuần tuý, không có yếu tố y khoa hay thẩm mỹ nào trong cấu trúc.

**Ánh xạ target.** KHÔNG có entity nào ở Phần 3-6 phủ (PayrollProfile là lương, CompanyMembership là tư cách thành viên, Assignment là phân công — không cái nào mang chứng từ pháp lý ký kết). Đề xuất Phần 7 ở tầng generic HR: entity `PartyAgreement`/`StaffAgreement` neo vào **CompanyMembership** (không neo thẳng User) để đúng đa công ty, dùng chung `Attachment` cho bản scan thay cho cặp fileName/fileUrl, và mở rộng `type` thành danh mục cấu hình được (không hardcode 2 giá trị) vì hợp đồng lao động/uỷ quyền/bàn giao đều cùng hình dạng.

**Field chính.**
- `id:String @id @default(cuid())`
- `userId:String`
- `type:StaffAgreementType — enum (dòng 219-222): CONFIDENTIALITY | NON_COMPETE`
- `status:StaffAgreementStatus @default(DRAFT) — enum (dòng 224-229): DRAFT | SIGNED | EXPIRED | REVOKED`
- `title:String`
- `version:Int @default(1)`
- `contentSnapshot:String`
- `signedAt:DateTime?`
- `effectiveFrom:DateTime?`
- `effectiveUntil:DateTime?`
- `fileName:String?`
- `fileUrl:String?`
- `note:String?`
- `createdById:String?`
- `createdAt/updatedAt:DateTime`
- `@@unique([userId, type, version])`
- `@@index([userId, type, status])`

**Quan hệ.**
- user User @relation("StaffAgreementSubject", fields: [userId], references: [id], onDelete: Cascade)
- createdBy User? @relation("StaffAgreementCreatedBy", fields: [createdById], references: [id])
- KHÔNG có companyId/contractId/positionId — chỉ neo vào User

**Bằng chứng.** Dòng 1188-1210: `model StaffAgreement { userId String; user User @relation("StaffAgreementSubject", ..., onDelete: Cascade); type StaffAgreementType; status StaffAgreementStatus @default(DRAFT); title String; version Int @default(1); contentSnapshot String; signedAt DateTime?; effectiveFrom DateTime?; effectiveUntil DateTime?; fileName String?; fileUrl String?; ...; @@unique([userId, type, version]); @@index([userId, type, status]) }`. Enum đọc trực tiếp tại dòng 219-229. Dùng thật: `nhan-su/[id]/thoa-thuan/actions.ts:19-22` — `const last = await prisma.staffAgreement.findFirst({ where: { userId, type }, orderBy: { version: "desc" }, select: { version: true } }); const version = (last?.version ?? 0) + 1;` rồi `tx.staffAgreement.create({ data: { ..., version, contentSnapshot: buildAgreementTemplate(...), createdById: user.id } })` + audit `CREATE_STAFF_AGREEMENT`; ký `:38-40` `if (!item || item.status !== "DRAFT") return { error: "Chỉ bản nháp mới được ký." }` → `update({ data: { status: "SIGNED", signedAt: new Date(), effectiveFrom, effectiveUntil } })`; thu hồi `:53` `update({ data: { status: "REVOKED" } })`. Toàn bộ action đều `requireUser(["ADMIN"])` (`:47`). Trang `thoa-thuan/page.tsx:22-23` liệt kê theo `[{type:asc},{version:desc}]` với tone `{ DRAFT, SIGNED, EXPIRED, REVOKED }`.

**Rủi ro khi migrate.**
- TRẠNG THÁI CHẾT: enum có `EXPIRED` nhưng grep toàn bộ `nhan-su/**` chỉ thấy ghi `"SIGNED"` (actions.ts:40) và `"REVOKED"` (:53) — KHÔNG có nơi nào set EXPIRED, không có job/cron so `effectiveUntil` với hiện tại. Thoả thuận hết hạn vẫn hiển thị 'Đã ký' vô thời hạn. Phần 7 phải suy trạng thái từ ngày (hàm thuần) thay vì lưu cột trạng thái không ai cập nhật.
- ĐUA VERSION (cùng lớp lỗi với cạm bẫy #1 trong BAN-GIAO): `version = (findFirst orderBy version desc)?.version + 1` chạy NGOÀI transaction (actions.ts:19, transaction chỉ bắt đầu ở :21) trong khi có `@@unique([userId, type, version])` → hai lần tạo đồng thời sẽ đâm P2002 và không có retry. Phần 7 nên dùng sequence/khoá hàng hoặc `nextSeq` có retry.
- `onDelete: Cascade` trên `user` (dòng 1191): xoá tài khoản nhân sự là XOÁ SẠCH mọi thoả thuận bảo mật/không cạnh tranh đã ký — đúng loại dữ liệu phải giữ lại LÂU HƠN quan hệ lao động. Ràng buộc này ngược hoàn toàn với yêu cầu lưu trữ pháp lý.
- Neo vào `userId` chứ không phải quan hệ lao động/công ty: không biết thoả thuận thuộc pháp nhân nào, không gắn với vị trí/hợp đồng nào, không có ngày ký của phía công ty ai đại diện. Sang mô hình đa công ty của Phần 7 là mơ hồ ngay.
- `type` là enum cứng 2 giá trị (CONFIDENTIALITY, NON_COMPETE) → thêm loại văn bản mới phải migrate enum; nghiệp vụ HR thực tế cần danh mục mở.
- `fileName`/`fileUrl` nhúng thẳng, không FK tới bảng tệp nào → không kiểm soát được vòng đời tệp scan (giống rủi ro tệp mồ côi ở CaseDocument).

### `CaseRevenueAllocation` — `web/prisma/schema.prisma:1031`

**Bản chất.** Phân bổ doanh số của MỘT hồ sơ cho nhiều nhân sự phối hợp, theo tỷ lệ điểm cơ bản (basis points). Là dữ liệu ĐẦU VÀO cho hai nhánh tính toán khác nhau: (a) tính hoa hồng thực thu (`commission-data.ts`) và (b) quy doanh thu về từng nhân sự cho báo cáo hiệu suất (`performance.ts` → `revenue-attribution.ts`). Khi hồ sơ KHÔNG có dòng phân bổ nào, hệ thống fallback về `CaseRecord.consultantId`/`doctorId` với 100%.

**Ánh xạ target.** CHƯA có entity tương đương 1-1 trong Phần 3-6, nhưng thuộc tầng generic. Gần nhất: **CommissionRule** (chính sách) và **CommissionCalculation** (kết quả) — model này nằm GIỮA hai cái đó: nó là bản ghi quy kết doanh thu (attribution) theo giao dịch, không phải rule cũng không phải kết quả tính. Đề xuất Phần 7: entity GENERIC_CORE `RevenueAttribution` (hoặc `SaleAttribution`) gắn vào **Sale**/**WorkItem** thay vì CaseRecord, giữ nguyên shareBps + unique[sale,user,role], làm đầu vào cho CommissionCalculation. Không có gì đặc thù y tế/thẩm mỹ trong model này.

**Field chính.**
- `id:String @id @default(cuid())`
- `caseId:String (onDelete: Cascade)`
- `userId:String (onDelete: Restrict)`
- `role:RevenueAllocationRole — enum dòng 238-243: CONSULTANT | DOCTOR | NURSE | OTHER`
- `shareBps:Int — chú thích schema dòng 1030: '10000 = 100%; tổng phải đúng 10000 khi hồ sơ chốt'`
- `note:String?`
- `createdById:String? + createdBy:User? @relation("RevenueAllocationCreatedBy")`
- `createdAt:DateTime @default(now())`
- `updatedAt:DateTime @updatedAt`
- `@@unique([caseId, userId, role])`
- `@@index([caseId]) + @@index([userId])`

**Quan hệ.**
- case: CaseRecord @relation(fields:[caseId], onDelete: Cascade) — back-ref `revenueAllocations CaseRevenueAllocation[]` dòng 642
- user: User @relation(fields:[userId], onDelete: Restrict) — back-ref dòng 310
- createdBy: User? @relation("RevenueAllocationCreatedBy") — back-ref dòng 319, quan hệ ĐẶT TÊN để tách khỏi quan hệ user chính

**Bằng chứng.** Không có trường nào mang ngữ nghĩa y khoa: dòng 1037-1038 `role RevenueAllocationRole` + `shareBps Int`, enum dòng 238-243 chỉ gồm CONSULTANT/DOCTOR/NURSE/**OTHER** (giá trị OTHER cho thấy đây là khung chia doanh thu tổng quát). Chú thích schema dòng 1029-1030: 'Phân bổ doanh số nội bộ cho một hồ sơ giữa các nhân sự phối hợp. shareBps: phần trăm theo điểm cơ bản, 10000 = 100%'. Đường ghi duy nhất: `ho-so/actions.ts:314-352` `saveCaseRevenueAllocations` — `requireUser(["ADMIN"])`, xoá sạch rồi `createMany` trong `withCaseLock`, ghi audit `UPDATE_REVENUE_ALLOCATION` (đăng ký ở `lib/status.ts:124` và nằm trong `AUDIT_SENSITIVE_EXTRA` dòng 223). Fallback legacy: `commission-data.ts:72-78` `allocationFor()` — `if (explicit.length) return explicit; if (role === "CONSULTANT" && caseRow.consultantId) return [{ userId, shareBps: 10_000 }]`.

**Rủi ro khi migrate.**
- **Bất biến 'tổng = 10000' KHÔNG được ràng buộc ở DB**, chỉ ở 1 server action (`validateAllocations(parsed.data.allocations, true)`, actions.ts:325). Kết hợp với `commission-data.ts:83` `const totalBps = shares.reduce((sum, item) => sum + item.shareBps, 0)` rồi chia cho `totalBps` (KHÔNG chia cho 10000): nếu dữ liệu vào bằng đường khác (seed, tool AI, SQL trực tiếp) mà tổng chỉ 5000, tiền vẫn được chia HẾT 100% cho nhóm đó — sai lệch tiền lương một cách im lặng, không có cảnh báo.
- **Role NURSE và OTHER được lưu nhưng KHÔNG ảnh hưởng hoa hồng.** `allocationFor()` chỉ được gọi đúng một lần với đối số "CONSULTANT" (`commission-data.ts:180`); nhánh bác sĩ dùng `allocateDoctorServiceBase` theo `CaseService.doctorId`. Các dòng NURSE/OTHER chỉ chảy vào `performance.ts:85,200` `summarizeStaffRevenue`. → Admin nhập tỷ lệ cho điều dưỡng và tin rằng đã ảnh hưởng lương, thực tế chỉ đổi báo cáo hiệu suất.
- Hai nguồn sự thật song song cho cùng câu hỏi 'ai làm ca này': bảng này VÀ `CaseRecord.consultantId/doctorId`. Fallback ngầm 100% (`commission-data.ts:75-76`) nghĩa là xoá hết dòng phân bổ sẽ âm thầm quay về hành vi cũ thay vì báo lỗi.
- `onDelete: Restrict` trên userId chặn xoá nhân sự đã từng được phân bổ (có chủ ý, giữ lịch sử tiền) — nhưng bất đối xứng với `onDelete: Cascade` của caseId: xoá hồ sơ thì xoá luôn chứng cứ phân bổ doanh thu đã từng dùng để tính lương.
- Không có mốc hiệu lực (effectiveFrom/version): action ghi đè bằng `deleteMany` + `createMany` (actions.ts:335-338), lịch sử phiên bản cũ chỉ còn trong `AuditLog.meta.before` — không truy vấn lại được bằng quan hệ.


## LEGACY_DUPLICATE

### `CaseService` — `web/prisma/schema.prisma:646`

**Bản chất.** Dòng chi tiết của hồ sơ: mỗi dòng = 1 dịch vụ được chốt bán, có snapshot tên + giá tại thời điểm chốt, số lượng, chiết khấu, thành tiền. Kiêm thêm 2 việc ngoài phạm vi 'dòng đơn hàng': (a) gán người thực hiện để tính hoa hồng (doctorId = bác sĩ trực tiếp làm, nurseId = điều dưỡng phụ trách, căn cứ tính 100k/ca); (b) cờ chống trừ kho 2 lần khi áp định mức vật tư (bomApplied).

**Ánh xạ target.** SaleLine (đã có ở Phần 3-6) cho toàn bộ phần giá/số lượng/chiết khấu/snapshot; serviceId → CatalogItem; doctorId/nurseId → KHÔNG giữ dạng cột, chuyển sang Assignment (ai làm việc gì) và để CommissionCalculation đọc từ đó; bomApplied + materialUsages → StockMovement / InventoryItem (đã có). Không cần entity mới nào cho model này.

**Field chính.**
- `id: String @id @default(cuid())`
- `caseId: String (bắt buộc)`
- `serviceId: String? — NULLABLE, cho phép dòng tự do không thuộc danh mục`
- `name: String — comment 'Tên dịch vụ tại thời điểm chốt (snapshot)'`
- `listPrice: Decimal @default(0) @db.Decimal(14,0) — 'Giá gốc (niêm yết) tại thời điểm chốt'`
- `unitPrice: Decimal @default(0) @db.Decimal(14,0) — 'Giá ưu đãi thực thu (đơn giá)'`
- `quantity: Int @default(1)`
- `discount: Decimal @default(0) @db.Decimal(14,0)`
- `finalPrice: Decimal @default(0) @db.Decimal(14,0) — số lưu sẵn, không phải cột tính`
- `doctorId: String? — bác sĩ trực tiếp thực hiện`
- `nurseId: String? — điều dưỡng phụ trách dòng này, comment nói rõ KHÔNG tự sao chép từ CaseRecord, phải chọn tay`
- `performedAt: DateTime?`
- `note: String?`
- `bomApplied: Boolean @default(false) — 'Đã trừ vật tư theo định mức (BOM) cho dòng dịch vụ này chưa — tránh trừ kho 2 lần'`
- `createdAt: DateTime @default(now())`
- `KHÔNG có @@index nào, kể cả trên caseId`

**Quan hệ.**
- case: CaseRecord @relation(onDelete: Cascade)
- service: Service? @relation — optional, không cascade
- doctor: User? @relation("CaseServiceDoctor")
- nurse: User? @relation("CaseServiceNurse")
- materialUsages: MaterialUsage[] — vật tư đã dùng cho đúng dòng dịch vụ này

**Bằng chứng.** Trích dòng 652-657: 'name String // Tên dịch vụ tại thời điểm chốt (snapshot)', 'listPrice ... // Giá gốc (niêm yết) tại thời điểm chốt', 'unitPrice ... // Giá ưu đãi thực thu (đơn giá)', 'quantity Int @default(1)', 'discount', 'finalPrice' — đúng khuôn một dòng đơn hàng chuẩn, không có gì y khoa trong phần giá. Dòng 660-664 nói rõ mục đích 2 cột nhân sự: '// Điều dưỡng phụ trách dòng dịch vụ này (căn cứ tính "Tiền dịch vụ phụ" 100k/ca — xem lib/commission.ts). Khác doctorId: KHÔNG tự sao chép từ CaseRecord lúc tạo, phải chọn tay'. Dòng 667-668: '// Đã trừ vật tư theo định mức (BOM) ... bomApplied Boolean @default(false)'. Xác nhận cách dùng thật: C:/Users/PC/ZenithTasks/web/src/lib/commission-data.ts:142 select đúng bộ 'finalPrice, unitPrice, listPrice, quantity, discount, doctorId, nurseId' và dòng 226-228 'if (!service.nurseId) continue; ... amount: 100_000'. Công thức thành tiền nằm ở app chứ không ở DB: ho-so/actions.ts:412 'const finalPrice = Math.max(unitPrice * qty - discount, 0);'.

**Rủi ro khi migrate.**
- Không có @@index([caseId]) dù mọi lần recalc đều quét theo caseId: ho-so/actions.ts:61 'db.caseService.findMany({ where: { caseId }, ... })'. Bảng này lớn nhanh nhất hệ thống.
- finalPrice là giá trị lưu sẵn chứ không phải generated column → có thể lệch khỏi unitPrice*quantity-discount nếu một đường ghi nào đó bỏ qua công thức ở ho-so/actions.ts:412.
- serviceId nullable → dòng có thể không trỏ về danh mục nào; khi migrate sang SaleLine/CatalogItem phải giữ được kiểu dòng tự do này, nếu ép NOT NULL sẽ mất dữ liệu lịch sử.
- doctorId/nurseId là 2 slot cứng: không biểu diễn được ca có 2 bác sĩ, có kỹ thuật viên, hay vai trò mới. Đây chính là lý do CaseRevenueAllocation phải tồn tại song song.
- Không có cột thuế, không có currency, Decimal(14,0) không phần lẻ → không chia được tỉ lệ lẻ khi tách hoa hồng/phân bổ.
- bomApplied là cờ idempotency thủ công nằm trên dòng bán hàng — trộn trách nhiệm tồn kho vào bảng doanh thu. Ở Phần 7 việc này thuộc StockMovement, không nên bê cột này sang SaleLine.

### `Service` — `web/prisma/schema.prisma:525`

**Bản chất.** Danh mục dịch vụ bán ra, 2 mức giá: listPrice (niêm yết/giá gốc) và defaultPrice (giá ưu đãi mặc định thực thu). Có category dạng chuỗi tự do để nhóm, cờ active để ngừng bán, và liên kết định mức vật tư mặc định (BOM) qua ServiceMaterial.

**Ánh xạ target.** CatalogItem (đã có ở Phần 3-6) — toàn bộ 7 trường map thẳng, không thiếu gì. Phần mở rộng duy nhất cần bổ sung: quan hệ materials (ServiceMaterial/BOM) → nối CatalogItem với InventoryItem qua một bảng định mức; Phần 3-6 hiện có InventoryItem/StockMovement nhưng CHƯA có entity BOM tương ứng.

**Field chính.**
- `id: String @id @default(cuid())`
- `name: String`
- `category: String? — chuỗi tự do, KHÔNG phải FK sang bảng danh mục`
- `listPrice: Decimal @default(0) @db.Decimal(14,0) — comment 'Giá niêm yết (giá gốc)'`
- `defaultPrice: Decimal @default(0) @db.Decimal(14,0) — comment 'Giá ưu đãi (thực thu mặc định)'`
- `active: Boolean @default(true)`
- `createdAt: DateTime @default(now())`
- `KHÔNG có @@index / @@unique — tên dịch vụ có thể trùng hoàn toàn`

**Quan hệ.**
- caseServices: CaseService[] — các dòng đã bán tham chiếu tới
- materials: ServiceMaterial[] — comment 'Định mức vật tư tiêu hao mặc định cho dịch vụ này (BOM) — B5 giai đoạn 2'

**Bằng chứng.** Trích nguyên dòng 525-536: 'model Service { id String @id @default(cuid()); name String; category String?; listPrice Decimal @default(0) @db.Decimal(14, 0) // Giá niêm yết (giá gốc); defaultPrice Decimal @default(0) @db.Decimal(14, 0) // Giá ưu đãi (thực thu mặc định); active Boolean @default(true); createdAt DateTime @default(now()); caseServices CaseService[]; materials ServiceMaterial[] }' — không có MỘT trường nào mang tính y khoa hay thẩm mỹ (không có mã ICD, không thời lượng, không chống chỉ định, không phân loại thủ thuật). Cách đọc thật xác nhận nó chỉ là danh mục bán hàng: C:/Users/PC/ZenithTasks/web/src/lib/lookups.ts:5-10 'prisma.service.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }], select: { id, name, category, listPrice, defaultPrice } })'. Định mức BOM khai ở model ServiceMaterial dòng 560-571 với '@@unique([serviceId, materialId])'.

**Rủi ro khi migrate.**
- Không unique trên name (cũng không trên [name, category]) → dễ tạo trùng dịch vụ, và vì CaseService snapshot tên nên trùng lặp lan sang báo cáo doanh thu theo dịch vụ.
- category là String tự do, không FK → không phân cấp được nhóm dịch vụ, gõ sai chính tả là tách nhóm.
- Không có companyId/ecosystemId → một bảng giá dùng chung cho toàn hệ thống, không hỗ trợ nhiều công ty/chi nhánh khác giá.
- Không có lịch sử giá (không effectiveFrom/effectiveTo): đổi listPrice là mất giá cũ. Legacy chữa cháy bằng cách snapshot giá xuống CaseService, nên báo cáo giá vẫn đọc được nhưng bảng giá thì không có version.
- Thiếu hẳn: đơn vị tính, thời lượng thực hiện, thuế suất, mã kế toán, giá vốn dự kiến. Nếu CatalogItem của Phần 3-6 đã có các trường này thì đây là bước tiến, không phải mất mát.
- active là xoá mềm duy nhất; không có deletedAt/lý do ngừng bán.

### `FollowUp` — `web/prisma/schema.prisma:719`

**Bản chất.** Lich hen TAI KHAM gan vao 1 ca dieu tri: luu thoi diem hen (scheduledAt), trang thai vong doi, ghi chu, moc da den (doneAt) va nguoi tao. Duoc tao tay tu ho so ('Hen tai kham', ho-so/actions.ts:1157) VA tu dong khi ca chuyen COMPLETED ma chua co lich tai kham tuong lai (ho-so/actions.ts:286-295, hen sau 30 ngay). Danh dau da den qua markFollowUpArrived (ho-so/actions.ts:1194, set status ARRIVED + doneAt). Ve ban chat nghiep vu day la mot cuoc hen — trang /lich-hen phai truy van CA prisma.appointment LAN prisma.followUp roi gop lai (lich-hen/page.tsx:71-89), va chong trung lich cung phai quet ca hai (lich-hen/actions.ts:67).

**Ánh xạ target.** Appointment (da co san o Phan 3-6). FollowUp KHONG phai mot khai niem nghiep vu khac Appointment — no ton tai chi vi khiem khuyet mo hinh du lieu legacy: Appointment.caseId la 'String? @unique' (schema dong 514, trong model Appointment 489-524) nen 1 ca dieu tri chi gan duoc DUNG 1 lich hen, khong the co nhieu lan tai kham. O Phan 7 phai hop nhat vao Appointment voi quan he N-1 toi entity thay the CaseRecord + phan biet bang truong type (FOLLOW_UP), roi migrate du lieu FollowUp sang Appointment va RETIRE bang cu.

**Field chính.**
- `id:String @id @default(cuid())`
- `caseId:String (bat buoc)`
- `customerId:String (bat buoc, trung lap vi CaseRecord da co customerId)`
- `scheduledAt:DateTime`
- `status:AppointmentStatus @default(BOOKED) — dung LAI nguyen enum cua Appointment, 8 gia tri: BOOKED, CONFIRMED, ARRIVED, IN_CONSULT, IN_SERVICE, DONE, CANCELLED, NO_SHOW (schema dong 67-76)`
- `note:String?`
- `doneAt:DateTime?`
- `createdById:String?`
- `createdAt:DateTime @default(now())`

**Quan hệ.**
- case CaseRecord @relation(fields: [caseId], references: [id], onDelete: Cascade)
- customer Customer @relation(fields: [customerId], references: [id]) — KHONG khai bao onDelete (mac dinh Restrict)
- createdBy User? @relation(fields: [createdById], references: [id]); phia User la 'followUpsCreated FollowUp[]' (schema dong 298)
- Phia CaseRecord: 'followUps FollowUp[]' (dong 637); phia Customer: 'followUps FollowUp[]' (dong 438)
- Index duy nhat: @@index([scheduledAt])

**Bằng chứng.** Dinh nghia that dong 719-734 gan nhu la mot ban sao thu gon cua lich hen: 'scheduledAt DateTime', 'status AppointmentStatus @default(BOOKED)' — dung LAI CHINH XAC enum AppointmentStatus cua Appointment (schema dong 67-76), 'doneAt DateTime?', 'note String?'. Chung cu ung dung coi 2 bang la CUNG mot mien lich: lich-hen/page.tsx:71-77 truy van 'prisma.followUp.findMany({where:{scheduledAt: dayRange(day)}})' va 'prisma.followUp.count(...)' song song voi appointment de dung chung 1 khung ngay/thang; lich-hen/actions.ts:65-69 co comment 'Trang /lich-hen da gop hien thi 2 nguon nay (cam bay #18) nhung chong trung lich truoc day chi xet Appointment, bo sot FollowUp' roi truy van 'prisma.followUp.findMany({where:{status:{in: ACTIVE_STATUSES}...}})'. Ly do ton tai rieng duoc chung minh boi 'caseId String? @unique' o dong 514 trong model Appointment (489-524) — rang buoc 1-1 khien khong the co nhieu lan tai kham tren 1 ca.

**Rủi ro khi migrate.**
- Trung lap voi Appointment: MOI tinh nang lich/nhac viec phai truy van va dong bo 2 bang (lich-hen/page.tsx:71-89, lich-hen/actions.ts:67, workqueue-summary.ts:20, khach/[token]/page.tsx, dashboard.ts). Da tung gay loi that: lich tai kham hoan toan khong hien o /lich-hen (cam bay #18 ghi trong BAN-GIAO, comment con nam trong lich-hen/page.tsx:69-70).
- Ngu nghia xoa KHONG nhat quan trong cung 1 model: caseId co 'onDelete: Cascade' nhung customerId khong khai bao onDelete (mac dinh Restrict). Hau qua: code phai tu cascade bang tay truoc khi xoa khach — khach-hang/actions.ts:175 'tx.followUp.deleteMany({where:{customerId: id}})' va tro-ly/agent.ts:434 lam y het. Quen 1 cho la xoa khach that bai hoac mo coi du lieu.
- customerId bi denormalize canh caseId trong khi CaseRecord da co customerId => co the lech. Code phai tu phong ve: ho-so/actions.ts:1155-1156 doc lai chu ho so va nem loi neu 'lockedOwner.customerId !== d.customerId'. DB khong co rang buoc nao ep 2 gia tri nay khop nhau.
- status khai kieu AppointmentStatus voi 8 gia tri nhung ung dung CHI ghi duoc ARRIVED (ho-so/actions.ts:1194 'data: { status: "ARRIVED", doneAt: new Date() }'); khong co duong ghi CONFIRMED/CANCELLED/NO_SHOW cho FollowUp. => khong do duoc ty le khach hen tai kham ma khong den, du enum co san NO_SHOW.
- Khong co truong updatedAt (khac ConsultationRecord co @updatedAt) => khong biet lan doi trang thai gan nhat, chi lan theo AuditLog (MARK_FOLLOW_UP_ARRIVED / DELETE_FOLLOW_UP / CREATE_FOLLOW_UP / AUTO_CREATE_FOLLOW_UP).
- Chi co @@index([scheduledAt]) trong khi truy van thuc te loc dong thoi scheduledAt + status + doneAt (workqueue-summary.ts:20) va theo caseId (ho-so/actions.ts:286-288) => thieu index tong hop, khong co index tren caseId/customerId.
- Khong co cot dinh danh don vi/cong ty (companyId/ecosystemId) => khong tuong thich voi Company/Ecosystem cua Phan 3-6.

### `MaterialUsage` — `web/prisma/schema.prisma:687`

**Bản chất.** Dòng ghi nhận VẬT TƯ ĐÃ DÙNG cho một hồ sơ điều trị, tuỳ chọn quy về một dòng dịch vụ cụ thể (caseServiceId). Lưu snapshot tên + đơn vị để bản ghi vẫn đọc được sau khi vật tư bị xoá khỏi danh mục. Mỗi lần ghi bản ghi này, code LUÔN ghi song song một StockMovement type OUT và trừ tồn kho trong cùng transaction — tức nó là 'chân nghiệp vụ' của một sự kiện xuất kho, còn StockMovement là 'chân kho'.

**Ánh xạ target.** Đã được phủ bởi **StockMovement** (Phần 3-6, đã implement) + **InventoryItem**. Mỗi MaterialUsage hiện đang được ghi ĐÔI cùng một StockMovement OUT trong cùng transaction. Target: gộp về 1 StockMovement duy nhất, bổ sung `sourceType/sourceId` trỏ tới WorkItem (hồ sơ) và SaleLine (dòng dịch vụ), giữ lại `performedBy` + snapshot `name/unit` làm cột của StockMovement. Không cần entity riêng ở Phần 7.

**Field chính.**
- `id:String @id @default(cuid())`
- `caseId:String (bắt buộc, onDelete: Cascade)`
- `materialId:String? (nullable — cho phép ghi tay vật tư ngoài danh mục)`
- `caseServiceId:String? (onDelete: SetNull)`
- `name:String // Tên vật tư (snapshot)`
- `unit:String @default("cái")`
- `quantity:Decimal @default(1) @db.Decimal(10, 2)`
- `performedById:String? + performedBy:User?`
- `performedAt:DateTime @default(now())`
- `note:String?`

**Quan hệ.**
- case: CaseRecord @relation(fields:[caseId], onDelete: Cascade) — back-ref `materials MaterialUsage[]` dòng 635
- material: Material? @relation(fields:[materialId]) — back-ref `usages MaterialUsage[]` dòng 550
- caseService: CaseService? @relation(fields:[caseServiceId], onDelete: SetNull) — back-ref `materialUsages MaterialUsage[]` dòng 671
- performedBy: User? — back-ref `materialUsages MaterialUsage[]` dòng 295

**Bằng chứng.** Ghi đôi được chứng minh ở 3 điểm ghi trong `web/src/app/(app)/ho-so/actions.ts`: (1) dòng 507-522 `await tx.materialUsage.create({...})` ngay sau đó `await tx.material.update({ data: { stock: { decrement: n.need } } })` và `await tx.stockMovement.create({ data: { materialId, type: "OUT", quantity, unitCost: outUnitCost, note: "Định mức dịch vụ" } })`; (2) dòng 872-895 cùng cặp create + stockMovement OUT note "Dùng cho hồ sơ"; (3) dòng 908-919 `removeMaterial` xoá usage rồi `stockMovement.create({ type: "IN", note: "Hoàn kho (xóa vật tư)" })`. Snapshot: dòng 695 `name String // Tên vật tư (snapshot)` khớp code `khach-hang`/`ho-so` dòng 865 `if (!mat) materialId = null; // vật tư đã bị xóa → lưu như nhập tay (snapshot tên), không trừ kho`. Cascade: dòng 690 `onDelete: Cascade` từ CaseRecord.

**Rủi ro khi migrate.**
- KHÔNG có trường giá vốn/thành tiền. Giá vốn (`outUnitCost = avgCost tại thời điểm xuất`) chỉ được ghi vào `StockMovement.unitCost` (actions.ts:506, 521, 894), mà các lệnh tạo StockMovement KHÔNG truyền bất kỳ tham chiếu hồ sơ nào (`data: { materialId, type, quantity, unitCost, note, createdById }`). Hệ quả: KHÔNG tính được COGS/lãi lỗ theo từng hồ sơ — muốn tính phải ghép 2 bảng bằng thời gian + note, không có khoá nối. Đây là hệ quả trực tiếp của việc tách đôi bản ghi.
- Đồng bộ 2 bảng phụ thuộc hoàn toàn vào code, không có ràng buộc DB. Khi `materialId` null (vật tư đã bị xoá khỏi danh mục), nhánh `if (materialId)` ở actions.ts:883 KHÔNG chạy → có MaterialUsage nhưng KHÔNG có StockMovement tương ứng → 2 bảng lệch nhau một cách hợp lệ về mặt schema.
- KHÔNG có @@index. `caseId` là FK Cascade dùng để xoá hàng loạt và để truy vấn theo hồ sơ (`findMany({ where: { caseServiceId } })` actions.ts:559, `where: { case: { customerId } }` khach-hang/actions.ts:170) — đều thiếu index.
- Không có createdAt/updatedAt; `performedAt` là mốc nghiệp vụ (thời điểm thực hiện) chứ không phải mốc kiểm toán. `updateMaterialUsage` (actions.ts:958) sửa được quantity mà không để lại dấu vết thời điểm sửa trên chính bản ghi.
- `quantity Decimal(10,2)` cho phép số âm về mặt schema — không có `@db.Check`; chống âm chỉ nằm ở zod/logic tồn kho ở tầng action.


## Phát hiện xuyên suốt

- [case-core] KHÔNG MỘT MODEL NÀO trong 3 model có tenant scoping (không companyId, không ecosystemId, không branchId). Toàn bộ trục nghiệp vụ cốt lõi của legacy là single-tenant cứng — đây là rào cản lớn nhất khi map sang Ecosystem/Company/CompanyMembership của Phần 3-6, và là lý do không thể 'bê nguyên schema cũ' dù chỉ một bảng.
- [case-core] KHÔNG MỘT KHỐI @@index NÀO trên cả 3 model (đã xác minh bằng grep '@@' trên vùng dòng 595-675: không trả về kết quả; và đọc trực tiếp dòng 525-536 của Service). Ràng buộc duy nhất là 'code String @unique' của CaseRecord. Trong khi đó C:/Users/PC/ZenithTasks/web/src/app/(app)/ho-so/page.tsx:46-70 lọc theo consultantId/doctorId/status rồi orderBy createdAt desc + phân trang. Các model lân cận NGOÀI phạm vi này thì lại có index đầy đủ (StockMovement dòng 591-592 có @@index([materialId]) và @@index([createdAt]); ServiceMaterial dòng 569-570 có @@unique + @@index) → chứng tỏ đây là thiếu sót cục bộ của cụm hồ sơ/dịch vụ chứ không phải quy ước chung của schema.
- [case-core] Tiền tệ: mọi cột tiền đều là Decimal(14,0) — KHÔNG phần thập phân, KHÔNG cột currency, KHÔNG cột thuế/VAT ở bất kỳ đâu trong 3 model. Hệ thống chỉ chạy được VND và không xuất được hoá đơn có thuế. Phần 7 phải quyết định dứt điểm chuẩn tiền tệ trước khi map Sale/SaleLine/CatalogItem.
- [case-core] Tính toàn vẹn tài chính phụ thuộc HOÀN TOÀN vào code ứng dụng, không có ràng buộc DB: recalc() ở ho-so/actions.ts:59-70 là nơi duy nhất giữ cho totalAmount/paidAmount/debtAmount của CaseRecord khớp với tổng CaseService.finalPrice và Payment.amount; công thức dòng thì nằm ở ho-so/actions.ts:412. Khi tái thiết kế sang Sale/SaleLine, hoặc dùng generated column/trigger, hoặc phải giữ đúng một cửa ghi duy nhất — không được để nhiều đường ghi như hiện tại.
- [case-core] Mẫu 'snapshot giá tại thời điểm chốt' (CaseService.name + listPrice + unitPrice, dòng 652-654) là quyết định ĐÚNG của legacy và phải được giữ nguyên trong SaleLine: nó là thứ duy nhất bù đắp việc Service không có lịch sử giá.
- [case-core] Gán vai trò nhân sự bị đóng cứng thành cột FK có tên vai trò: CaseRecord.consultantId/doctorId (relation 'CaseConsultant'/'CaseDoctor', dòng 602-605) và CaseService.doctorId/nurseId (relation 'CaseServiceDoctor'/'CaseServiceNurse', dòng 658-664). Chính legacy đã phải vá bằng bảng phụ CaseRevenueAllocation (userId + role + shareBps, dòng 1031) — bằng chứng nội tại rằng mô hình slot cố định không đủ. Phần 7 nên dùng Assignment + CommissionCalculation làm nguồn duy nhất, không tái tạo cột vai trò.
- [case-core] Ranh giới module bị trộn ngay trong bảng doanh thu: CaseService vừa là dòng bán hàng vừa mang cờ tồn kho bomApplied (dòng 668) và quan hệ materialUsages (dòng 671); CaseRecord vừa là đơn hàng vừa mang hồ sơ lâm sàng (consultation/consents/photos) vừa mang hoa hồng CTV. Khi tách sang Phần 7 phải cắt theo trách nhiệm (Sale | ClinicalEncounter | StockMovement | CommissionCalculation), không cắt theo tên bảng cũ.
- [case-core] Không được migrate CaseRecord → Sale theo tỉ lệ 1:1: C:/Users/PC/ZenithTasks/web/src/app/(app)/tiep-nhan/actions.ts:108-119 tự tạo một CaseRecord NHÁP (status OPEN, note 'Hồ sơ nháp tự tạo khi tiếp nhận khách mới') cho MỌI khách vừa tiếp nhận, kèm luôn một ConsultationRecord. Nghĩa là một phần đáng kể CaseRecord chưa từng là giao dịch. Tiêu chí lọc khi migrate nên dựa vào có CaseService/Payment thật, không dựa vào sự tồn tại của bản ghi.
- [case-core] Hai model CaseRecord và CaseService phụ thuộc lẫn nhau chặt (Cascade + recalc + snapshot) nên phải migrate trong CÙNG một đợt; ngược lại Service gần như độc lập (chỉ bị CaseService tham chiếu qua serviceId nullable) nên có thể map sang CatalogItem trước, rủi ro thấp nhất trong 3 model.
- [case-core] Khoảng trống thật sự của Phần 3-6 lộ ra từ cụm này (không phải model nào cũng có chỗ đáp): (a) chưa có entity BOM/định mức nối CatalogItem với InventoryItem — legacy có ServiceMaterial; (b) chưa có entity lịch trả góp/hẹn nợ — legacy có DebtPlan 1-1 với CaseRecord (dòng 641, 962); (c) chưa có entity hồ sơ lâm sàng (chiefComplaint, ConsultationRecord, CaseConsent) — đây đúng là phần HEALTHCARE_VERTICAL cần thiết kế mới ở Phần 7.
- [consult-followup] Ca hai model deu la con cua CaseRecord voi 'onDelete: Cascade' tren caseId (ConsultationRecord dong 1157, FollowUp dong 722). Xoa 1 ca dieu tri la xoa vinh vien ca ho so y khoa lan lich su tai kham, khong co soft-delete/archive. Voi du lieu y te day la rui ro tuan thu; Phan 7 nen dung soft-delete + luu tru thay vi cascade cung.
- [consult-followup] Khong model nao co cot dinh danh to chuc (khong co companyId / ecosystemId / tenantId). Ca hai gia dinh he thong 1 phong kham. Muon dung Company/Ecosystem/CompanyMembership da implement o Phan 3-6 thi bat buoc them cot scope + backfill; phan quyen hien nay hoan toan nam o tang ung dung (requireCap("case.clinical"), hasCaseAccess, isLockedFor trong ho-so/actions.ts), khong co rang buoc nao o DB.
- [consult-followup] Ca hai chi co createdById -> User, khong co updatedById. ConsultationRecord con te hon: createdById bi ghi de moi lan update (ho-so/actions.ts:178-189 dung chung object 'data' cho ca create lan update), nen truong nay dang mang y nghia sai. Phan 7 nen chuan hoa cap createdBy/updatedBy cho moi entity nghiep vu.
- [consult-followup] Bang thoi gian bi phan manh 3 nguon cho cung 1 mien 'cuoc hen': Appointment (1-1 voi case do caseId @unique, dong 514), FollowUp (N-1 voi case) va ConsultationRecord (moc kham 1-1). Hop nhat ve Appointment cua Phan 3-6 (N-1, phan loai bang type) se xoa duoc toan bo lop code gop tay hien nay o lich-hen/page.tsx, lich-hen/actions.ts va workqueue-summary.ts.
- [consult-followup] Agent AI ghi truc tiep vao CA HAI model: tro-ly/agent.ts:736 doc consultationRecord.findUnique de merge du lieu so tu van, tro-ly/agent.ts:434 goi followUp.deleteMany khi xoa khach. Bat ky viec doi ten/tach model nao o Phan 7 deu phai cap nhat dong bo registry tool cua agent, neu khong agent se im lang that bai hoac thao tac nham bang.
- [consult-followup] Prisma client duoc sinh ra trong src/generated/prisma (co ca models/ConsultationRecord.ts va models/FollowUp.ts). Doi ten model se lan sang code sinh + moi noi goi; theo quy uoc du an (BAN-GIAO muc 8.8) migration phai viet tay va additive, chay bang 'prisma migrate deploy', khong duoc 'db push'/'migrate reset'. => lo trinh an toan la them bang moi + backfill + doc song song, roi moi RETIRE bang cu.
- [consult-followup] Du lieu nghiep vu quan trong dang nam trong cot Json khong schema (ConsultationRecord.screening / serviceSnapshot / printOverrides). Bat bien duy nhat la ham normalizeScreening o lib/consultation-sheet.ts:35-40, va ham nay con phai doc tuong thich nguoc dinh dang boolean cu — tuc trong DB dang co it nhat 2 the he du lieu khac nhau trong cung 1 cot. Phan 7 can chuan hoa thanh bang con (vd EncounterScreeningItem) hoac it nhat co version cho payload Json.
- [consent-doc] KHÔNG một model nào trong 4 model được giao có trường tenant (companyId/ecosystemId/organizationUnitId). Cả 4 đều neo trực tiếp vào CaseRecord hoặc User. Khi ánh xạ sang Phần 7 (đã có Ecosystem/Company/CompanyMembership) thì phải THÊM khoá tenant ở tầng thiết kế, không thể bê nguyên, nếu không sẽ rò chứng từ pháp lý và giấy tờ y khoa giữa các cơ sở.
- [consent-doc] CẢ 4 MODEL đều nằm trên đường xoá dây chuyền huỷ chứng từ: CaseConsent (dòng 943) và CaseDocument (dòng 981) `onDelete: Cascade` từ CaseRecord; StaffAgreement (dòng 1191) `onDelete: Cascade` từ User. Ba loại tài liệu có giá trị pháp lý cao nhất trong hệ thống lại bị buộc phải chết theo bản ghi cha. Phần 7 cần tách kho chứng từ bất biến (append-only) khỏi vòng đời bản ghi nghiệp vụ.
- [consent-doc] BA hình dạng lưu tệp song song, cùng semantics: CaseDocument (978: title/fileName/url/mime/uploadedById), CollaboratorDocument (994-1004: y hệt, chỉ đổi khoá ngoại sang collaboratorId), và cặp fileName/fileUrl nhúng trong StaffAgreement (1200-1201). Đây là bằng chứng đủ mạnh để Phần 7 gom thành MỘT entity `Attachment` đa hình (ownerType/ownerId) thay vì nhân bản model theo từng chủ sở hữu mới.
- [consent-doc] Không model nào có sizeBytes/checksum/storage key trung tính; `url` lưu đường dẫn ứng dụng `/media/<tệp>`. Việc xoá bản ghi không xoá tệp vật lý (`deleteCaseDocument` ho-so/actions.ts:1114-1124 không có fs.rm, trong khi nhánh rollback của uploadCaseDocument dòng 1108 lại có) → kho tệp phình vĩnh viễn. Phần 7 cần lớp lưu trữ có vòng đời riêng.
- [consent-doc] MẪU 'snapshot nội dung tại thời điểm ký' xuất hiện độc lập ở HAI chỗ với hai cách gọi khác nhau: CaseConsent.title+body (dòng 946-947, comment 'snapshot') và StaffAgreement.contentSnapshot (dòng 1196). Đây là một khái niệm chung — 'văn bản đã ký là bất biến, mẫu có thể đổi' — nên chuẩn hoá thành một khuôn chung ở Phần 7 (agreement/consent = snapshot + version + khoảng hiệu lực + trạng thái) thay vì hai lược đồ rời.
- [consent-doc] QUẢN TRỊ MẪU PHIẾU ĐANG ĐỨT: `mau-phieu/page.tsx:17` gọi `requireCap("mod:mau-phieu")` nhưng grep chuỗi `mau-phieu` trong `web/src/lib/permissions.ts` trả về KHÔNG kết quả → module đã bị gỡ khỏi MODULES, route bị chặn. Trong khi đó `ho-so/[id]/page.tsx:114` vẫn đọc `consentTemplate.findMany({ where: { active: true } })`. Tức ConsentTemplate hiện là dữ liệu CHỈ ĐỌC trên thực tế: dùng được, không quản trị được. Cần chốt ý định trước khi migrate.
- [consent-doc] LỆCH TÀI LIỆU ↔ SCHEMA: BAN-GIAO.md mục 13.7 viết 'Không xóa `ConsentRecord`, `ConsentTemplate` khỏi schema', nhưng grep `^model ConsentRecord` trong schema.prisma KHÔNG có kết quả — model thật tên là `CaseConsent` (dòng 940); thứ tồn tại là `ConsultationRecord` (dòng 1154, sổ tư vấn, khác nghiệp vụ). Không được dùng tài liệu làm nguồn tên entity khi lập bản đồ Phần 7.
- [consent-doc] Kiểm soát quyền của 4 model KHÔNG đồng nhất và nằm ở tầng ứng dụng chứ không ở dữ liệu: CaseConsent/CaseDocument dùng `requireCap("case.clinical")` + `canAccessCase(...)` + `withCaseLock` + audit (DELETE_CONSENT, UPLOAD_DOCUMENT, DELETE_DOCUMENT); StaffAgreement dùng `requireUser(["ADMIN"])` + audit (CREATE/SIGN/REVOKE_STAFF_AGREEMENT); ConsentTemplate dùng `requireUser([...ROLES])` và có nhánh `.catch(() => {})` nuốt lỗi ở updateTemplate/deleteTemplate (mau-phieu/actions.ts:30, :47) — sửa/xoá mẫu KHÔNG ghi audit và thất bại im lặng. Phần 7 nên đưa audit thành ràng buộc chung cho mọi chứng từ, không tuỳ từng màn hình.
- [consent-doc] Không model nào ghi nhận 'thu hồi/rút lại' đúng nghĩa ở phía KHÁCH HÀNG: StaffAgreement có REVOKED cho nhân sự, nhưng CaseConsent thì cách duy nhất để phản ánh khách rút đồng ý là xoá bản ghi (`deleteConsent`, consent-actions.ts:75). Đây là khoảng trống nghiệp vụ thật (không phải thiếu field trang trí) và cần được thiết kế lại ở Phần 7 chứ không migrate 1-1.
- [photo-material-revenue] Cả 3 model đều treo vào CaseRecord — aggregate legacy gộp cả 'ca điều trị' (WorkItem) lẫn 'đơn bán' (Sale). Khi tách theo Phần 3-6, mỗi model phải chọn lại cha: MaterialUsage → StockMovement tham chiếu WorkItem/SaleLine; Photo → attachment của WorkItem + Customer; CaseRevenueAllocation → attribution của Sale. Bằng chứng: back-ref `materials`(635), `photos`(636), `revenueAllocations`(642) đều nằm trong cùng model CaseRecord.
- [photo-material-revenue] KHÔNG model nào có cột đa chi nhánh/đa pháp nhân (companyId/ecosystemId/organizationUnitId). Target đã có Company/Ecosystem/OrganizationUnit → migration bắt buộc phải backfill tenant, hiện chỉ suy ra gián tiếp qua CaseRecord.
- [photo-material-revenue] Mức độ chín của schema rất lệch nhau dù cùng phạm vi hồ sơ: CaseRevenueAllocation (viết sau, dòng 1031) có @@unique + 2 @@index + createdAt/updatedAt + createdById; còn Photo (704) và MaterialUsage (687) KHÔNG có index nào, không có createdAt/updatedAt, không có unique constraint. Chuẩn hoá lại toàn bộ khi làm Phần 7, đừng bê nguyên.
- [photo-material-revenue] Bất biến nghiệp vụ quan trọng nhất của cả 3 đều nằm ở tầng server action chứ không ở DB: tổng shareBps = 10000 (chỉ trong `validateAllocations`), đồng bộ MaterialUsage ↔ StockMovement ↔ Material.stock (chỉ trong `withCaseLock`), quyền xem ảnh CLINICAL (chỉ trong where-clause từng trang). Mọi đường ghi mới — đặc biệt tool của Trợ lý AI (`tro-ly/agent.ts:429-435` đã tự lặp lại logic dọn dữ liệu của `khach-hang/actions.ts:170-176`) — đều có thể phá bất biến mà DB không chặn.
- [photo-material-revenue] Vòng đời file vật lý không gắn với vòng đời bản ghi: `uploadPhoto` có rollback xoá file khi transaction lỗi (actions.ts:1058-1060) nhưng `deletePhoto` (1065-1075) và `deleteMany` theo customer (khach-hang/actions.ts:176) đều không xoá file → rác tích luỹ trong volume `zenith_uploads`. Thiết kế lại Phần 7 nên có bảng asset riêng + job dọn rác, không để đường dẫn trần trong cột `url`.
- [photo-material-revenue] Hai model (Photo, MaterialUsage) dùng thời điểm NGHIỆP VỤ (`takenAt`, `performedAt`) làm mốc thời gian duy nhất, trong khi báo cáo/quyết toán lại cần mốc GHI NHẬN. Phần 7 nên tách rõ occurredAt vs recordedAt cho mọi bản ghi có ảnh hưởng tiền/kho/hồ sơ.
- [photo-material-revenue] Không model nào bị bỏ hoang: cả 3 đều có đường ghi thật đang chạy production (ho-so/actions.ts) và đường đọc thật (performance.ts, commission-data.ts, các trang khach-hang/ho-so/khach). Không có model nào đủ căn cứ xếp RETIRE.
