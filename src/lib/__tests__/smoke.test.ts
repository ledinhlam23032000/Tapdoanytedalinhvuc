import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";

describe("Technical bootstrap smoke test", () => {
  it("connects to Postgres via Prisma", async () => {
    const rows = await db.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
    expect(rows[0].ok).toBe(1);
  });
});
