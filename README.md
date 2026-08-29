# Tapdoanytedalinhvuc

AI-native multi-company operating system. Bắt đầu đọc từ [`CLAUDE.md`](./CLAUDE.md).

- Sản phẩm là gì / vì sao: [`docs/product/PRODUCT_CONSTITUTION.md`](docs/product/PRODUCT_CONSTITUTION.md), [`docs/product/PRODUCT_VISION.md`](docs/product/PRODUCT_VISION.md)
- Kiến trúc đích: [`docs/architecture/TARGET_ARCHITECTURE.md`](docs/architecture/TARGET_ARCHITECTURE.md)
- Lộ trình: [`docs/project/MASTER_ROADMAP.md`](docs/project/MASTER_ROADMAP.md)
- Trạng thái hiện tại / lệnh chạy: [`docs/project/CURRENT_STATE.md`](docs/project/CURRENT_STATE.md)
- Legacy (ZenithTasks) đã khảo cổ những gì: [`docs/legacy/LEGACY_CAPABILITY_MATRIX.md`](docs/legacy/LEGACY_CAPABILITY_MATRIX.md)

## Chạy local

```bash
docker compose up -d
npm install
npx prisma migrate dev
npm run test
npm run dev
```
