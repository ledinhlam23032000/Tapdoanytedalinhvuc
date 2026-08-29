import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";

describe("Phase 1 technical bootstrap smoke test", () => {
  it("connects to Postgres via Prisma and round-trips a row", async () => {
    const row = await db.healthCheck.create({ data: {} });
    expect(row.status).toBe("ok");

    const found = await db.healthCheck.findUnique({ where: { id: row.id } });
    expect(found?.id).toBe(row.id);

    await db.healthCheck.delete({ where: { id: row.id } });
  });
});
