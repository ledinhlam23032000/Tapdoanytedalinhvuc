import "dotenv/config";
import { defineConfig } from "vitest/config";
import path from "node:path";

// Lane riêng cho *.itest.ts — cần Postgres thật (docker compose up -d).
// Tách khỏi vitest.config.ts (unit, không cần DB) theo đúng convention đã
// chứng minh tốt ở ZenithTasks. fileParallelism:false vì các test cùng
// dùng chung 1 DB (tránh đụng độ dữ liệu giữa các file chạy song song).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.itest.ts"],
    fileParallelism: false,
    testTimeout: 30000,
  },
});
