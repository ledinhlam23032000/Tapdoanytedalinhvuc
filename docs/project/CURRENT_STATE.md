# Current State

Cập nhật lần cuối: cuối Phần 1 (Product Genesis + Archaeology + Memory).

## Stack đã bootstrap (ADR-006)

Next.js 16.3.3 (App Router, Turbopack) + React 19.2.8 + TypeScript (strict) +
Tailwind CSS v4 + Prisma 7.9.1 (`@prisma/adapter-pg`, client generate ra
`src/generated/prisma`, cấu hình CLI ở `prisma.config.ts` vì Prisma 7 không
còn cho `url` trực tiếp trong `datasource` của `schema.prisma`) + PostgreSQL
16 (Docker, local dev port **5442** — cố tình khác 5432 của ZenithTasks để
chạy song song không đụng nhau) + Vitest 4 (unit test).

## Lệnh quan trọng

```bash
docker compose up -d          # khởi động Postgres local (port 5442)
npm install                   # cài dependencies (tự chạy `prisma generate`)
npx prisma migrate dev        # tạo/áp migration mới khi đổi schema
npm run test                  # vitest run
npx tsc --noEmit               # typecheck
npx eslint .                   # lint
npx next build                 # build production
npx next dev -p 3417           # dev server (đổi port nếu 3417 đang bận)
```

`.env` (không commit) trỏ `DATABASE_URL` vào Postgres local port 5442 —
xem `.env.example` cho format.

## Đã verify (Phần 1)

- `npx prisma migrate dev` chạy thật, tạo migration `20260829185733_init`
  cho model bootstrap `HealthCheck`.
- `npm run test` (Vitest) PASS 1/1 — round-trip thật qua Prisma → Postgres
  (tạo/đọc/xoá 1 row `HealthCheck`).
- `npx tsc --noEmit` — 0 lỗi.
- `npx eslint .` — 0 lỗi/cảnh báo (sau khi loại `src/generated/**` khỏi lint
  scope — đây là code Prisma tự sinh, không phải code viết tay).
- `npx next build` — build production thành công, 3 route (`/`,
  `/_not-found`, `/api/health`).
- Đã tự mở trình duyệt (Browser tool) tới `http://127.0.0.1:3417/api/health`
  và `http://127.0.0.1:3417/` — xác nhận bằng mắt pipeline
  browser→Next.js→Prisma→Postgres chạy thật, không chỉ tin log server.

## KHÔNG có trong Phần 1 (đúng theo giới hạn Phiên 1 của Master Prompt)

- Chưa có Ecosystem/Company/User/Auth model nào — `schema.prisma` chỉ có
  `HealthCheck` (sẽ xoá khi Phần 3 thêm model thật).
- Chưa có UI nghiệp vụ nào — trang `/` vẫn là trang chào mặc định của
  `create-next-app`.
- Chưa cấu hình CI.

## Known issue kế thừa từ tooling (không phải do quyết định của ta)

`npm audit` báo 3 lỗi "high" (stack-exhaustion trong `deepmerge-ts`, dependency
bắc cầu của `@prisma/config` mà Prisma CLI 7.x dùng). Fix đề xuất của npm là
hạ xuống `prisma@6.12.0` — trái với ADR-006 (đồng bộ version với ZenithTasks
đang chạy production 7.9.1, cũng dính lỗi tương tự). Đây là advisory ở tầng
CLI/dev-tooling (không phải dependency runtime của app), rủi ro thấp. Theo
dõi, không phải HARD BLOCK.
