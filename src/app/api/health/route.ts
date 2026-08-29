import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const row = await db.healthCheck.create({ data: {} });
  return NextResponse.json({ ok: true, id: row.id, checkedAt: row.checkedAt });
}
