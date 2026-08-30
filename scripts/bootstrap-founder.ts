// Bootstrap Ecosystem + Founder đầu tiên (Master Prompt Phần 3 mục XCIX-C).
// KHÔNG hard-code trong app runtime, KHÔNG seed password cố định — đọc từ
// env. Chạy: npm run bootstrap:founder
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import { hashPassword } from "../src/lib/auth/password";

async function main() {
  const email = requireEnv("BOOTSTRAP_FOUNDER_EMAIL");
  const password = requireEnv("BOOTSTRAP_FOUNDER_PASSWORD");
  const ecosystemCode = requireEnv("BOOTSTRAP_ECOSYSTEM_CODE");
  const ecosystemName = requireEnv("BOOTSTRAP_ECOSYSTEM_NAME");

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });

  const existingEcosystem = await db.ecosystem.findUnique({ where: { code: ecosystemCode } });
  if (existingEcosystem) {
    console.log(`Ecosystem "${ecosystemCode}" đã tồn tại — bỏ qua bootstrap.`);
    await db.$disconnect();
    return;
  }

  const passwordHash = await hashPassword(password);

  await db.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email },
      update: {},
      create: { displayName: "Founder", email, passwordHash, status: "ACTIVE" },
    });

    const ecosystem = await tx.ecosystem.create({
      data: { code: ecosystemCode, name: ecosystemName, status: "ACTIVE" },
    });

    await tx.ecosystemMembership.create({
      data: {
        ecosystemId: ecosystem.id,
        userId: user.id,
        rolePreset: "FOUNDER",
        status: "ACTIVE",
      },
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: user.id,
        action: "ECOSYSTEM_CREATED",
        targetType: "Ecosystem",
        targetId: ecosystem.id,
        ecosystemId: ecosystem.id,
        metadata: { bootstrap: true },
      },
    });

    console.log(`Đã tạo Ecosystem "${ecosystem.name}" (${ecosystem.code}) và Founder ${email}.`);
  });

  await db.$disconnect();
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
