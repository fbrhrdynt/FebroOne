import { scrypt, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
const scryptAsync = promisify(scrypt);
export const hashToken = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = (await scryptAsync(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
// Spends the same scrypt cost as a real check so unknown emails are not
// distinguishable from wrong passwords by response time.
const DUMMY_HASH = `${"0".repeat(32)}:${"0".repeat(128)}`;
export async function verifyPasswordOrDummy(password: string, stored?: string | null) {
  const ok = await verifyPassword(password, stored || DUMMY_HASH);
  return !!stored && ok;
}
export function tokenHashEquals(token: string, storedHash?: string | null) {
  if (!storedHash) return false;
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
