/**
 * Demo account metadata (local demo only — fictional data, not secrets).
 *
 * The login screen and the seed banner both display these identifiers. They MUST
 * match what `prisma/seed.ts` actually persists as `User.loginId` (which is
 * lower-cased). Previously the login screen showed `cse26-a-001` while the seed
 * stored `cse-26a-001`, so every student sign-in failed with "Invalid
 * credentials". Centralising the values here prevents that drift (see
 * tests/demo-accounts.test.ts).
 */
export interface DemoAccount {
  role: string;
  email: string;
  loginId: string;
}

/** Password for every seeded demo account. Clearly fake, shown in the UI. */
export const DEMO_PASSWORD = "Demo#Campus2026";

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: "Admin", email: "admin@campus.edu", loginId: "adm001" },
  { role: "Faculty", email: "ananya.rao@campus.edu", loginId: "fac001" },
  { role: "Student", email: "student001@campus.edu", loginId: "cse-26a-001" },
];

/**
 * Mirror of the seed's roll-number derivation for a batch so tests can prove the
 * displayed student identifier matches the stored one without a database.
 * Seed: `${batchName.replace("2026-", "26")}-${nnn}` lower-cased.
 * e.g. "CSE-2026-A" + 1 -> "cse-26a-001".
 */
export function seedRollToLoginId(batchName: string, index: number): string {
  return `${batchName.replace("2026-", "26")}-${String(index).padStart(3, "0")}`.toLowerCase();
}
