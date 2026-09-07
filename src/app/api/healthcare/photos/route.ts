import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import {
  registerClinicalPhoto,
  CLINICAL_PHOTO_ALLOWED_MIME_TYPES,
  CLINICAL_PHOTO_MAX_BYTES,
} from "@/lib/domain/healthcare/clinical-photo-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/healthcare/photos — nhận multipart upload THẬT cho ảnh lâm sàng.
 *
 * ADR-041: DB chỉ giữ metadata, binary nằm NGOÀI DB. Route này là nơi DUY
 * NHẤT ghi binary xuống đĩa — `registerClinicalPhoto` (domain service) không
 * bao giờ chạm `fs`, chỉ nhận `storageKey`/`sizeBytes`/`checksumSha256` đã
 * tính sẵn ở đây.
 *
 * Chưa có storage provider ngoài (S3/GCS) — MVP dùng local filesystem dưới
 * `.data/clinical-photos/` (gitignored). Đây KHÔNG phải quyết định cuối
 * cùng: nếu sau này có provider thật, đổi phần ghi/đọc file ở đúng route này
 * (và route [clinicalPhotoId]) là đủ — domain service không cần sửa vì nó
 * chưa từng biết tới `fs`.
 *
 * `storageKey` LUÔN là `randomUUID()` do SERVER sinh — không nhận tên/khoá
 * từ client, nên bất biến #115 (khoá lưu trữ không được chứa tên bệnh nhân)
 * đúng theo cấu trúc, không phải nhờ validate may rủi.
 */
export async function POST(request: Request) {
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  const companyId = String(formData.get("companyId") ?? "");
  const medicalCaseId = String(formData.get("medicalCaseId") ?? "");
  const procedureId = formData.get("procedureId");
  const photoType = formData.get("photoType");
  const bodyArea = formData.get("bodyArea");
  const capturedAt = formData.get("capturedAt");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu tệp ảnh." }, { status: 400 });
  }
  if (!companyId || !medicalCaseId) {
    return NextResponse.json({ error: "Thiếu companyId hoặc medicalCaseId." }, { status: 400 });
  }
  // Kiểm type/size THẬT ở server trước khi đụng đĩa (bất biến #114) — không
  // tin `file.type` do trình duyệt tự khai mà không xác minh, nhưng ở mức
  // MVP đây là điểm kiểm tra thật đầu tiên; xác định type sâu hơn (magic
  // byte) để dành cho khi có yêu cầu bảo mật cao hơn.
  if (!CLINICAL_PHOTO_ALLOWED_MIME_TYPES.includes(file.type as (typeof CLINICAL_PHOTO_ALLOWED_MIME_TYPES)[number])) {
    return NextResponse.json({ error: `Định dạng không hỗ trợ: ${file.type}` }, { status: 400 });
  }
  if (file.size > CLINICAL_PHOTO_MAX_BYTES) {
    return NextResponse.json({ error: "Ảnh vượt quá dung lượng cho phép (25MB)." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksumSha256 = createHash("sha256").update(buffer).digest("hex");
  const storageKey = randomUUID();

  const dir = join(process.cwd(), ".data", "clinical-photos");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, storageKey), buffer);

  try {
    const result = await registerClinicalPhoto(actor.id, {
      companyId,
      medicalCaseId,
      procedureId: procedureId ? String(procedureId) : undefined,
      photoType: photoType ? (String(photoType) as never) : undefined,
      bodyArea: bodyArea ? String(bodyArea) : undefined,
      capturedAt: capturedAt ? new Date(String(capturedAt)) : undefined,
      storageKey,
      fileName: file.name,
      mimeType: file.type as never,
      sizeBytes: file.size,
      checksumSha256,
    });
    return NextResponse.json({ id: result.id });
  } catch (err) {
    // Đăng ký metadata thất bại (quyền/scope/trùng) thì tệp vừa ghi trở thành
    // rác mồ côi — chấp nhận được ở MVP (job dọn rác định kỳ xử lý sau,
    // ADR-041 hệ quả); ưu tiên KHÔNG để lỗi ở bước sau xoá mất tệp vừa nhận
    // trước khi biết chắc registerClinicalPhoto có thật sự cần nó không.
    const message = err instanceof Error ? err.message : "Không thể đăng ký ảnh.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
