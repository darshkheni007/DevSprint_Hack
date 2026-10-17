import bcrypt from "bcryptjs";

/**
 * Password hashing (SEC-A01). bcrypt with cost 12 satisfies the requirement
 * ("argon2id, or bcrypt with cost >= 12"). bcryptjs is pure JS, so it needs no
 * native toolchain on Windows.
 */
const BCRYPT_COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Normalise login identifiers before lookup (SEC-A09). */
export function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Password policy (SEC-A02): minimum 10 characters, no forced composition
 * rules. A small common-password check is applied here.
 */
const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "1234567890",
  "qwertyuiop",
  "letmein123",
  "welcome123",
  "admin12345",
  "changeme123",
]);

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 10) {
    return "Password must be at least 10 characters long.";
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "This password is too common. Please choose another.";
  }
  return null;
}
