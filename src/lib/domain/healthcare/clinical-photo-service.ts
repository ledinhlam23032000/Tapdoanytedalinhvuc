import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyContextForActor } from "@/lib/authorization/company-context";
import { AuthorizationError } from "@/lib/authorization/errors";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { assertHealthcareModuleEnabled } from "@/lib/domain/healthcare/module-service";
import {
  assertSameCompanyClinicalPhoto,
  assertSameCompanyCustomer,
  assertSameCompanyMedicalCase,
  assertSameCompanyProcedure,
} from "@/lib/domain/scope-guards";
import type { ClinicalPhotoType } from "@/generated/prisma";

/**
 * Domain service — ClinicalPhoto (ADR-041). Master Prompt Phần 7, cụm
 * consent-photo-file.
 *
 * PHẠM VI: file này CHỈ quản lý METADATA. Không đọc/ghi binary, không `fs`,
 * không tính checksum, không sinh URL. Tầng trên (route upload) đã ghi file
 * xuống storage và tính sẵn `storageKey`/`sizeBytes`/`checksumSha256` rồi mới
 * gọi vào đây — giữ đúng ADR-041 "DB chỉ giữ metadata, binary nằm ngoài DB".
 *
 * BẤT BIẾN #150 (CCCXXII) — ẢNH GỐC LÀ BẤT BIẾN: trong file này KHÔNG có và
 * KHÔNG ĐƯỢC THÊM bất kỳ hàm nào sửa `storageKey`/`checksumSha256`/`sizeBytes`
 * của một bản ghi đã tồn tại. `registerClinicalPhoto` là đường DUY NHẤT ghi
 * các trường đó, và chỉ ghi đúng một lần lúc create. Muốn thay ảnh thì đăng ký
 * bản ghi MỚI rồi archive bản cũ — bản dẫn xuất (crop/annotate sau này) phải
 * là record riêng trỏ về original, không được ghi đè original.
 *
 * BẤT BIẾN #35/#55 — KHÔNG log/audit `storageKey` và `fileName`: storageKey là
 * locator truy cập file, fileName do người dùng đặt nên có thể chứa tên bệnh
 * nhân. Metadata audit chỉ chứa ID và thuộc tính kỹ thuật an toàn (#78).
 */

/** Giới hạn kỹ thuật cho ảnh lâm sàng (bất biến #114 — chặn sai type/size
 *  thật ở server, không tin extension từ client). Export để route upload dùng
 *  chung đúng một nguồn sự thật thay vì tự khai lại một bộ số khác. */
export const CLINICAL_PHOTO_MAX_BYTES = 25 * 1024 * 1024;
export const CLINICAL_PHOTO_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

type ClinicalPhotoMimeType = (typeof CLINICAL_PHOTO_ALLOWED_MIME_TYPES)[number];

/** Metadata trả ra ngoài — plain field, không có Decimal, không có URL. */
export type ClinicalPhotoMetadata = {
  id: string;
  companyId: string;
  medicalCaseId: string;
  procedureId: string | null;
  photoType: ClinicalPhotoType;
  bodyArea: string | null;
  capturedAt: Date;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  status: "ACTIVE" | "ARCHIVED";
  uploadedByUserId: string;
  createdAt: Date;
};

// ===== Chuẩn hoá & kiểm tra storageKey (bất biến #115 / CCXVII) =====

/** Bỏ dấu tiếng Việt + hạ chữ thường để so khớp tên bệnh nhân không bị lách
 *  bằng dấu ("Nguyễn" vs "nguyen"). NFD tách dấu thành combining mark rồi xoá
 *  dải U+0300–U+036F; `đ/Đ` không có dạng NFD nên phải thay tay. */
function normalizeForNameCheck(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[Đđ]/g, "d")
    .toLowerCase();
}

/**
 * storageKey phải là ID opaque. Từ chối nếu:
 * - chứa `/` hoặc `\` (đường dẫn, không phải ID) hoặc `..` (path traversal);
 * - chứa mảnh tên bệnh nhân (bất biến #115 — path/tên file không được chứa
 *   danh tính; ai có quyền đọc tên thư mục storage cũng không được suy ra
 *   bệnh nhân là ai).
 * Ném AuthorizationError vì đây là vi phạm ràng buộc bảo mật dữ liệu bệnh
 * nhân, không phải lỗi trạng thái nghiệp vụ.
 */
function assertOpaqueStorageKey(storageKey: string, customerName: string) {
  if (storageKey.includes("/") || storageKey.includes("\\") || storageKey.includes("..")) {
    throw new AuthorizationError("Khoá lưu trữ ảnh không hợp lệ: phải là mã định danh, không phải đường dẫn.");
  }

  const normalizedKey = normalizeForNameCheck(storageKey);
  // Chỉ xét token >= 3 ký tự: token ngắn ("An", "Le") gần như chắc chắn trùng
  // ngẫu nhiên với chuỗi cuid/uuid và sẽ chặn nhầm mọi key hợp lệ.
  const nameTokens = normalizeForNameCheck(customerName)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
  if (nameTokens.some((token) => normalizedKey.includes(token))) {
    throw new AuthorizationError("Khoá lưu trữ ảnh không được chứa tên bệnh nhân — hãy dùng mã định danh ngẫu nhiên.");
  }
}

/** fileName được trả về cho route để đặt Content-Disposition — chặn ký tự
 *  đường dẫn để không có đường lách xuống thư mục khác ở tầng trên. */
function assertSafeFileName(fileName: string) {
  if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
    throw new Error("Tên tệp không hợp lệ: không được chứa ký tự đường dẫn.");
  }
}

function toMetadata(record: {
  id: string;
  companyId: string;
  medicalCaseId: string;
  procedureId: string | null;
  photoType: ClinicalPhotoType;
  bodyArea: string | null;
  capturedAt: Date;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  status: "ACTIVE" | "ARCHIVED";
  uploadedByUserId: string;
  createdAt: Date;
}): ClinicalPhotoMetadata {
  return {
    id: record.id,
    companyId: record.companyId,
    medicalCaseId: record.medicalCaseId,
    procedureId: record.procedureId,
    photoType: record.photoType,
    bodyArea: record.bodyArea,
    capturedAt: record.capturedAt,
    fileName: record.fileName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    checksumSha256: record.checksumSha256,
    status: record.status,
    uploadedByUserId: record.uploadedByUserId,
    createdAt: record.createdAt,
  };
}

// ===== registerClinicalPhoto =====

const registerClinicalPhotoSchema = z.object({
  companyId: z.string().min(1),
  medicalCaseId: z.string().min(1),
  procedureId: z.string().min(1).optional(),
  photoType: z.enum(["BEFORE", "AFTER", "PROGRESS", "CLINICAL_FINDING", "OTHER"]).optional(),
  bodyArea: z.string().trim().min(1).max(200).optional(),
  capturedAt: z.coerce.date().optional(),
  storageKey: z.string().trim().min(8).max(200),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(CLINICAL_PHOTO_ALLOWED_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(CLINICAL_PHOTO_MAX_BYTES),
  // SHA-256 hex = đúng 64 ký tự. Ép định dạng ở đây để bất biến #119 (toàn vẹn
  // ảnh xác minh bằng checksum) có dữ liệu dùng được, không phải chuỗi rỗng.
  checksumSha256: z
    .string()
    .trim()
    .regex(/^[0-9a-f]{64}$/i, "Checksum SHA-256 phải là 64 ký tự hex."),
});

/**
 * Đăng ký metadata cho một ảnh lâm sàng đã được tầng trên ghi xuống storage.
 * Trả về `{ id }` — Server Action không cần (và không được) nhận nguyên object
 * Prisma kèm storageKey.
 */
export async function registerClinicalPhoto(actorId: string, input: z.input<typeof registerClinicalPhotoSchema>) {
  const parsed = registerClinicalPhotoSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "healthcare.photo.manage");
  await assertHealthcareModuleEnabled(company.id);

  // companyId đọc thẳng từ MedicalCase (ADR-038) — KHÔNG suy qua
  // customerId -> Customer.companyId.
  const medicalCase = await assertSameCompanyMedicalCase(company.id, parsed.medicalCaseId);
  // Nạp Customer chỉ để lấy tên phục vụ kiểm tra bất biến #115; đồng thời
  // tái khẳng định #53 (Case.companyId === Customer.companyId) ở đường ghi.
  const customer = await assertSameCompanyCustomer(company.id, medicalCase.customerId);

  assertOpaqueStorageKey(parsed.storageKey, customer.name);
  assertSafeFileName(parsed.fileName);

  if (parsed.procedureId) {
    const procedure = await assertSameCompanyProcedure(company.id, parsed.procedureId);
    // Ảnh gắn Procedure phải thuộc đúng ca bệnh của Procedure đó — nếu không,
    // ảnh của case này sẽ hiện trong hồ sơ case khác dù cùng Company.
    if (procedure.medicalCaseId !== medicalCase.id) {
      throw new AuthorizationError("Thủ thuật không thuộc hồ sơ bệnh án này.");
    }
  }

  try {
    return await db.$transaction(async (tx) => {
      const photo = await tx.clinicalPhoto.create({
        data: {
          companyId: company.id,
          medicalCaseId: medicalCase.id,
          procedureId: parsed.procedureId,
          photoType: parsed.photoType as ClinicalPhotoType | undefined,
          bodyArea: parsed.bodyArea,
          capturedAt: parsed.capturedAt,
          storageKey: parsed.storageKey,
          fileName: parsed.fileName,
          mimeType: parsed.mimeType satisfies ClinicalPhotoMimeType,
          sizeBytes: parsed.sizeBytes,
          checksumSha256: parsed.checksumSha256.toLowerCase(),
          uploadedByUserId: actor.id,
        },
      });
      // Audit trong CÙNG transaction (bất biến #75/#126): ảnh được thêm là sự
      // kiện lâm sàng phải truy nguyên được. Metadata cố tình KHÔNG có
      // storageKey/fileName/bodyArea — chỉ ID + thuộc tính kỹ thuật (#78).
      await recordAudit(tx, {
        actorUserId: actor.id,
        action: AUDIT_ACTIONS.CLINICAL_PHOTO_UPLOADED,
        targetType: "ClinicalPhoto",
        targetId: photo.id,
        companyId: company.id,
        metadata: {
          medicalCaseId: photo.medicalCaseId,
          procedureId: photo.procedureId ?? undefined,
          photoType: photo.photoType,
          mimeType: photo.mimeType,
          sizeBytes: photo.sizeBytes,
        },
      });
      return { id: photo.id };
    });
  } catch (err) {
    // @unique(storageKey) — cùng một tệp vật lý không được đăng ký hai lần
    // (ảnh sẽ nhân đôi trong hồ sơ, và archive bản này không giấu được bản kia).
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      throw new Error("Ảnh này đã được đăng ký trước đó.");
    }
    throw err;
  }
}

// ===== getClinicalPhotoList =====

const getClinicalPhotoListSchema = z.object({
  companyId: z.string().min(1),
  medicalCaseId: z.string().min(1).optional(),
  procedureId: z.string().min(1).optional(),
  photoType: z.enum(["BEFORE", "AFTER", "PROGRESS", "CLINICAL_FINDING", "OTHER"]).optional(),
  /** Mặc định chỉ trả ảnh ACTIVE — ảnh đã archive coi như đã "xoá" ở luồng
   *  thường; muốn xem lại phải chủ động yêu cầu. */
  includeArchived: z.boolean().optional(),
});

/**
 * Danh sách metadata ảnh theo Company scope. KHÔNG trả `storageKey`: danh sách
 * dùng để render UI, mà locator file thì chỉ cần đúng lúc tải ảnh — càng ít
 * chỗ mang locator đi qua càng ít chỗ nó rơi vào log/HTML (#35).
 */
export async function getClinicalPhotoList(
  actorId: string,
  input: z.input<typeof getClinicalPhotoListSchema>,
): Promise<Omit<ClinicalPhotoMetadata, "checksumSha256">[]> {
  const parsed = getClinicalPhotoListSchema.parse(input);
  const { company } = await requireCompanyContextForActor(actorId, parsed.companyId, "healthcare.photo.view");
  await assertHealthcareModuleEnabled(company.id);

  // Validate mọi ID client gửi lên thuộc đúng Company TRƯỚC khi query (#86):
  // ID lọt qua filter không được phép làm lộ sự tồn tại của dữ liệu Company khác.
  if (parsed.medicalCaseId) await assertSameCompanyMedicalCase(company.id, parsed.medicalCaseId);
  if (parsed.procedureId) await assertSameCompanyProcedure(company.id, parsed.procedureId);

  const records = await db.clinicalPhoto.findMany({
    // companyId luôn nằm trong where — không có nhánh nào query không scope.
    where: {
      companyId: company.id,
      medicalCaseId: parsed.medicalCaseId,
      procedureId: parsed.procedureId,
      photoType: parsed.photoType as ClinicalPhotoType | undefined,
      status: parsed.includeArchived ? undefined : "ACTIVE",
    },
    orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }],
  });

  // checksum CỐ Ý không trả ra danh sách: nó chỉ cần cho việc xác minh toàn
  // vẹn file lúc tải/migrate, không phải dữ liệu hiển thị. Bớt bề mặt lộ.
  return records.map((record) => {
    const meta = toMetadata(record);
    return { ...meta, checksumSha256: undefined };
  });
}

// ===== getClinicalPhotoForDownload =====

const getClinicalPhotoForDownloadSchema = z.object({
  companyId: z.string().min(1),
  clinicalPhotoId: z.string().min(1),
  /** Tải lại ảnh đã archive — chỉ dành cho người có `healthcare.photo.manage`. */
  includeArchived: z.boolean().optional(),
});

export type ClinicalPhotoDownloadTicket = ClinicalPhotoMetadata & {
  /** Locator để route TỰ đọc file từ storage. KHÔNG phải URL, không public,
   *  không được ghi vào log/response header nào. */
  storageKey: string;
};

/**
 * CỔNG DUY NHẤT cho route tải ảnh lâm sàng (ADR-041 / bất biến #32/#55/#92/
 * #127/#191). Bốn lớp kiểm tra, không lớp nào được bỏ:
 *   1. authenticated — `requireCompanyContextForActor` chỉ trả context cho
 *      User còn ACTIVE, và ném nếu không;
 *   2. Company scope — company resolve từ session ở tầng route, mọi truy vấn
 *      dưới đây đều so `companyId` đọc thẳng từ entity;
 *   3. Healthcare permission — `healthcare.photo.view` tường minh (role tier
 *      Ecosystem/Founder KHÔNG tự có, bất biến #81);
 *   4. case access — ảnh phải thuộc MedicalCase cùng Company.
 * Cộng thêm cổng thứ hai độc lập: module Healthcare phải đang bật (#59/#87).
 *
 * Biết `clinicalPhotoId` KHÔNG đủ để tải (#127): kiểm tra chạy tại THỜI ĐIỂM
 * request chứ không dựa vào quyền đã check lúc render trang (#79).
 *
 * Trả `storageKey` cho route tự đọc file — KHÔNG bao giờ trả URL public/CDN
 * (#33/#84) và KHÔNG phát signed URL (ADR-041: target chưa có storage provider).
 * Cũng KHÔNG ghi audit ở đây: AUDIT_ACTIONS chưa có action đọc/tải ảnh, và
 * việc ghi log truy cập file phải được thiết kế sao cho không lọt locator (#35).
 */
export async function getClinicalPhotoForDownload(
  actorId: string,
  input: z.input<typeof getClinicalPhotoForDownloadSchema>,
): Promise<ClinicalPhotoDownloadTicket> {
  const parsed = getClinicalPhotoForDownloadSchema.parse(input);
  const { company, permissions } = await requireCompanyContextForActor(
    actorId,
    parsed.companyId,
    "healthcare.photo.view",
  );
  await assertHealthcareModuleEnabled(company.id);

  const photo = await assertSameCompanyClinicalPhoto(company.id, parsed.clinicalPhotoId);
  // Lớp 4 — case access: đọc companyId thẳng từ MedicalCase (ADR-038). Nếu
  // photo.companyId đúng nhưng case lại thuộc Company khác thì dữ liệu đã hỏng
  // — vẫn phải từ chối, không phục vụ file.
  await assertSameCompanyMedicalCase(company.id, photo.medicalCaseId);

  if (photo.status === "ARCHIVED") {
    if (!parsed.includeArchived || !permissions.has("healthcare.photo.manage")) {
      throw new AuthorizationError("Ảnh này đã được lưu trữ và không còn phục vụ ở luồng xem thông thường.");
    }
  }

  return { ...toMetadata(photo), storageKey: photo.storageKey };
}

// ===== archiveClinicalPhoto =====

const archiveClinicalPhotoSchema = z.object({
  companyId: z.string().min(1),
  clinicalPhotoId: z.string().min(1),
  // Lý do BẮT BUỘC (bất biến #36/LVI) — archive là hành vi thay cho xoá, phải
  // giải trình được về sau.
  archiveReason: z.string().trim().min(1).max(2000),
});

/**
 * "Xoá" ảnh lâm sàng = archive, KHÔNG hard delete (bất biến #36/#141/#77).
 * Bản ghi và tệp vật lý vẫn còn: ảnh lâm sàng có giá trị pháp lý, và legacy đã
 * mắc lỗi ngược lại (xoá bản ghi mà không xoá tệp → kho tệp phình vĩnh viễn,
 * mất luôn dấu vết ảnh từng tồn tại).
 *
 * Hàm này chỉ đụng bộ trường archive — KHÔNG đụng storageKey/checksum/sizeBytes
 * (bất biến #150: ảnh gốc bất biến).
 */
export async function archiveClinicalPhoto(actorId: string, input: z.input<typeof archiveClinicalPhotoSchema>) {
  const parsed = archiveClinicalPhotoSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "healthcare.photo.manage");
  await assertHealthcareModuleEnabled(company.id);

  const photo = await assertSameCompanyClinicalPhoto(company.id, parsed.clinicalPhotoId);
  await assertSameCompanyMedicalCase(company.id, photo.medicalCaseId);

  if (photo.status === "ARCHIVED") {
    throw new Error("Ảnh này đã được lưu trữ trước đó.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.clinicalPhoto.update({
      where: { id: photo.id },
      data: {
        status: "ARCHIVED",
        archiveReason: parsed.archiveReason,
        archivedAt: new Date(),
        archivedByUserId: actor.id,
      },
    });
    // Audit cùng transaction: archive không kèm audit thì đúng bằng xoá ngầm
    // (#36/#187). `archiveReason` được lưu ở đây vì bất biến yêu cầu lý do
    // truy nguyên được; storageKey/fileName vẫn không xuất hiện.
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.CLINICAL_PHOTO_ARCHIVED,
      targetType: "ClinicalPhoto",
      targetId: updated.id,
      companyId: company.id,
      metadata: {
        medicalCaseId: updated.medicalCaseId,
        photoType: updated.photoType,
        archiveReason: parsed.archiveReason,
      },
    });
    return { id: updated.id };
  });
}
