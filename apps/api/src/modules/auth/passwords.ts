import { createHash, randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

/**
 * Password hashing (§40): scrypt with per-password random salt.
 * Stored format: scrypt$<saltHex>$<hashHex> — never store raw credentials.
 */
const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password.normalize("NFKC"), salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1]!, "hex");
  const expected = Buffer.from(parts[2]!, "hex");
  const actual = await scryptAsync(password.normalize("NFKC"), salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Opaque session/token strings (sessions, email verification, password reset). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  // Tokens are high-entropy; a fast SHA-256 hash is sufficient and indexable.
  return createHash("sha256").update(token).digest("hex");
}
