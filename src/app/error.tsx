"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="vi">
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
          <h1 className="text-lg font-semibold text-zinc-900">Đã có lỗi xảy ra</h1>
          <p className="text-sm text-zinc-500">Vui lòng thử lại. Nếu vẫn lỗi, liên hệ quản trị viên.</p>
          <button
            onClick={reset}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Thử lại
          </button>
        </main>
      </body>
    </html>
  );
}
