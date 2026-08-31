import crypto from "node:crypto";

// Mã hoá SĐT tại rest (ADR-023) — salvage triết lý AES-256-GCM đã chứng
// minh thật ở ZenithTasks (L-P04), viết code mới, không copy khoá/logic.
// KHÔNG có cơ chế "reveal có audit" riêng — quyền customer.view + Company
// scope đã là lớp kiểm soát truy cập (xem ADR-023 để biết lý do).

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.PHONE_ENC_KEY;
  if (!raw) throw new Error("Thiếu biến môi trường PHONE_ENC_KEY.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("PHONE_ENC_KEY phải giải mã base64 ra đúng 32 byte (AES-256).");
  }
  return key;
}

/** Chuẩn hoá SĐT Việt Nam ở mức hợp lý (mục XVII) — không xây hệ chuẩn hoá viễn thông quốc tế đầy đủ. */
export function normalizePhone(input: string): string {
  let digits = input.trim().replace(/[\s-]/g, "");
  if (digits.startsWith("+84")) digits = "0" + digits.slice(3);
  else if (digits.startsWith("84") && digits.length > 9) digits = "0" + digits.slice(2);
  return digits;
}

/** Hash dùng để tra trùng (dedup) trong phạm vi 1 Company — không đảo ngược được. */
export function hashPhone(normalizedPhone: string): string {
  return crypto.createHash("sha256").update(normalizedPhone).digest("hex");
}

export function encryptPhone(normalizedPhone: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(normalizedPhone, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptPhone(ciphertext: string): string {
  const key = getKey();
  const raw = Buffer.from(ciphertext, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
