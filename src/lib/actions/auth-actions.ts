"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie, clearSessionCookie } from "@/lib/auth/session";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Email hoặc mật khẩu không hợp lệ." };
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });

  // Không tiết lộ "email không tồn tại" vs "sai mật khẩu" — cùng 1 thông
  // báo, chống dò tài khoản. So sánh hash ngay cả khi user null (dummy
  // hash) để tránh timing attack lộ email tồn tại hay không.
  const passwordOk = user
    ? await verifyPassword(parsed.data.password, user.passwordHash)
    : await verifyPassword(parsed.data.password, DUMMY_HASH);

  if (!user || !passwordOk || user.status !== "ACTIVE") {
    if (user) {
      await recordAudit(db, {
        actorUserId: user.id,
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        targetType: "User",
        targetId: user.id,
      });
    }
    return { error: "Email hoặc mật khẩu không đúng." };
  }

  await setSessionCookie({ userId: user.id, displayName: user.displayName });
  await recordAudit(db, {
    actorUserId: user.id,
    action: AUDIT_ACTIONS.LOGIN_SUCCEEDED,
    targetType: "User",
    targetId: user.id,
  });

  redirect("/");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

// bcrypt hash hợp lệ của một chuỗi ngẫu nhiên cố định — chỉ dùng để giữ thời
// gian so sánh ổn định khi user không tồn tại, không phải mật khẩu thật.
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8vJVSXPqLLHVKvNqmT9NlKqRPbg3Bq";
