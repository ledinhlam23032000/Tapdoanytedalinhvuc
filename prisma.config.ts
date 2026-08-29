// Cấu hình Prisma CLI (Prisma 7 không tự nạp .env). URL kết nối khai báo ở
// đây chỉ dùng cho Migrate/CLI; runtime app dùng driver adapter riêng — xem
// src/lib/db.ts. Salvage pattern từ ZenithTasks/web/prisma.config.ts.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
