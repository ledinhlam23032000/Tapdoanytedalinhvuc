import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="text-lg font-semibold text-zinc-900">Không tìm thấy</h1>
      <p className="text-sm text-zinc-500">
        Trang này không tồn tại hoặc bạn không có quyền truy cập.
      </p>
      <Link href="/" className="text-sm text-zinc-700 underline">
        Về trang chủ
      </Link>
    </main>
  );
}
