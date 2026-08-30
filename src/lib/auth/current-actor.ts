import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import type { User } from "@/generated/prisma";

// "Ai đang thực hiện action?" — nguồn duy nhất cho mọi authorization phía
// sau (Master Prompt Phần 3 mục XIII). Luôn đọc lại User.status mỗi lần gọi
// (fail closed — mục LXXXIV): một session JWT còn hạn không có nghĩa user
// vẫn được phép hành động nếu tài khoản đã bị SUSPENDED sau khi đăng nhập.
export async function getCurrentActor(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "ACTIVE") return null;

  return user;
}

export async function requireCurrentActor(): Promise<User> {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  return actor;
}
