import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// Session tối thiểu (Master Prompt Phần 3 mục XI-XII): chỉ userId +
// displayName cho UX. KHÔNG nhồi permission/company scope vào token —
// authorization luôn resolve server-side từ canonical Membership store mỗi
// request, tránh session sống lâu mang quyền đã bị thu hồi.
export const SESSION_COOKIE = "tdytdlv_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 ngày, salvage convention ZenithTasks

export type SessionPayload = {
  userId: string;
  displayName: string;
};

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET is not configured (must be >= 32 chars)");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.userId !== "string" || typeof payload.displayName !== "string") {
      return null;
    }
    return { userId: payload.userId, displayName: payload.displayName };
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
