import { describe, expect, it } from "vitest";
import { normalizePhone, hashPhone, encryptPhone, decryptPhone } from "@/lib/crypto/phone";

describe("normalizePhone", () => {
  it("chuẩn hoá +84 thành 0 (mục XVII)", () => {
    expect(normalizePhone("+84912345678")).toBe("0912345678");
  });

  it("chuẩn hoá 84 (không dấu +) thành 0", () => {
    expect(normalizePhone("84912345678")).toBe("0912345678");
  });

  it("bỏ khoảng trắng và dấu gạch ngang", () => {
    expect(normalizePhone("091 234 5678")).toBe("0912345678");
    expect(normalizePhone("091-234-5678")).toBe("0912345678");
  });

  it("số đã ở dạng 0xxx giữ nguyên", () => {
    expect(normalizePhone("0912345678")).toBe("0912345678");
  });

  it("cả 4 cách nhập cùng một số ra cùng kết quả", () => {
    const variants = ["+84912345678", "0912345678", "091 234 5678", "091-234-5678"];
    const normalized = variants.map(normalizePhone);
    expect(new Set(normalized).size).toBe(1);
  });
});

describe("hashPhone", () => {
  it("cùng số chuẩn hoá cho cùng hash, khác số cho hash khác", () => {
    const a = hashPhone(normalizePhone("+84912345678"));
    const b = hashPhone(normalizePhone("0912345678"));
    const c = hashPhone(normalizePhone("0987654321"));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("hash không phải là chính số gốc (không đảo ngược trực tiếp được)", () => {
    const hash = hashPhone("0912345678");
    expect(hash).not.toContain("0912345678");
    expect(hash).toHaveLength(64); // sha256 hex
  });
});

describe("encryptPhone / decryptPhone", () => {
  it("mã hoá rồi giải mã ra đúng số gốc", () => {
    const normalized = normalizePhone("+84912345678");
    const ciphertext = encryptPhone(normalized);
    expect(ciphertext).not.toContain("0912345678");
    expect(decryptPhone(ciphertext)).toBe(normalized);
  });

  it("2 lần mã hoá cùng 1 số ra ciphertext khác nhau (IV ngẫu nhiên) nhưng giải mã ra cùng giá trị", () => {
    const normalized = normalizePhone("0912345678");
    const c1 = encryptPhone(normalized);
    const c2 = encryptPhone(normalized);
    expect(c1).not.toBe(c2);
    expect(decryptPhone(c1)).toBe(normalized);
    expect(decryptPhone(c2)).toBe(normalized);
  });
});
