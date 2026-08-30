import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Chỉ ảnh hưởng `next dev` — cần thiết vì browser test tool proxy qua
  // 127.0.0.1 với origin khác localhost, bị Next 16 chặn mặc định.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
