import bcrypt from "bcryptjs";

// Salvage từ ZenithTasks: bcrypt cost 12, tối thiểu 8 ký tự — đã chứng minh
// đủ an toàn cho quy mô này. Xem docs/legacy/SALVAGE_LEDGER.md.
const BCRYPT_COST = 12;
export const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
