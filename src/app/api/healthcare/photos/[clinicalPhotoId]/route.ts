import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { getClinicalPhotoForDownload } from "@/lib/domain/healthcare/clinical-photo-service";
import { AuthorizationError } from "@/lib/authorization/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/healthcare/photos/[clinicalPhotoId]?companyId=...
 *
 * CỔNG DUY NHẤT phục vụ binary ảnh lâm sàng (ADR-041). Không có route nào
 * khác đọc `.data/clinical-photos/` — mọi truy cập PHẢI qua đây để chạy đủ
 * 4 lớp kiểm tra của `getClinicalPhotoForDownload` tại THỜI ĐIỂM request
 * (bất biến #79: không dựa vào quyền đã check lúc render trang).
 *
 * Biết `clinicalPhotoId` không đủ để tải (#127) — thiếu companyId hợp lệ,
 * sai quyền, hoặc ảnh thuộc Company khác đều nhận 403/404 giống nhau, không
 * lộ ảnh có tồn tại hay không (chống resource enumeration, cùng nguyên tắc
 * 404-im-lặng đã dùng cho Customer detail Phần 5).
 */
export async function GET(request: Request, { params }: { params: Promise<{ clinicalPhotoId: string }> }) {
  const { clinicalPhotoId } = await params;
  const companyId = new URL(request.url).searchParams.get("companyId");

  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (!companyId) return NextResponse.json({ error: "Thiếu companyId." }, { status: 400 });

  let ticket;
  try {
    ticket = await getClinicalPhotoForDownload(actor.id, { companyId, clinicalPhotoId });
  } catch (err) {
    // AuthorizationError = không có quyền / sai Company / không tồn tại —
    // trả 404 đồng nhất, không phân biệt lý do (#79/#92/#127).
    if (err instanceof AuthorizationError) return NextResponse.json({ error: "Không tìm thấy." }, { status: 404 });
    throw err;
  }

  const path = join(process.cwd(), ".data", "clinical-photos", ticket.storageKey);
  let buffer: Buffer;
  try {
    buffer = await readFile(path);
  } catch {
    // Bản ghi metadata tồn tại nhưng tệp vật lý mất — sự cố toàn vẹn dữ liệu
    // thật (đĩa bị dọn nhầm, di chuyển hạ tầng...), không phải lỗi người
    // dùng. 500 để phân biệt rõ với 404 "không có quyền/không tồn tại" ở trên.
    return NextResponse.json({ error: "Không đọc được tệp ảnh." }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": ticket.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(ticket.fileName)}"`,
      // KHÔNG public/CDN-cacheable (#33/#84): private = chỉ trình duyệt của
      // đúng người vừa được xác thực được cache, không proxy/CDN trung gian.
      "Cache-Control": "private, no-store",
    },
  });
}
