import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

describe("password hashing", () => {
  it("hash rồi verify đúng mật khẩu → true", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(await verifyPassword("correct-horse-battery", hash)).toBe(true);
  });

  it("verify sai mật khẩu → false", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("từ chối mật khẩu ngắn hơn MIN_PASSWORD_LENGTH", async () => {
    await expect(hashPassword("short")).rejects.toThrow();
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(8);
  });

  it("hash không phải plaintext (không reversible encryption)", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(hash).not.toBe("correct-horse-battery");
    expect(hash.startsWith("$2")).toBe(true); // bcrypt format
  });
});
