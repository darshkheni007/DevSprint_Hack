import { describe, expect, it } from "vitest";
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  seedRollToLoginId,
} from "@/lib/demo-accounts";
import { normalizeIdentifier } from "@/lib/password";

/**
 * Regression tests for the student sign-in failure.
 *
 * The seed stores each student's `loginId` as the lower-cased roll number
 * (`CSE-2026-A` -> `cse-26a-001`). The login screen previously advertised
 * `cse26-a-001`, which the lookup could never match, so students always got
 * "Invalid credentials". These tests pin the displayed hint to the seed formula.
 */
describe("demo account identifiers", () => {
  const student = DEMO_ACCOUNTS.find((a) => a.role === "Student")!;

  it("student hint equals the seed roll-number derivation", () => {
    expect(seedRollToLoginId("CSE-2026-A", 1)).toBe("cse-26a-001");
    expect(student.loginId).toBe(seedRollToLoginId("CSE-2026-A", 1));
  });

  it("every demo identifier is already normalised so lookup matches exactly", () => {
    for (const account of DEMO_ACCOUNTS) {
      expect(normalizeIdentifier(account.loginId)).toBe(account.loginId);
      expect(normalizeIdentifier(account.email)).toBe(account.email);
    }
  });

  it("regression: the previously shown student id does not match the stored id", () => {
    // This is the exact value the old UI displayed; it must NOT be the stored id.
    expect(normalizeIdentifier("cse26-a-001")).not.toBe(student.loginId);
  });

  it("demo password is long enough for the password policy", () => {
    expect(DEMO_PASSWORD.length).toBeGreaterThanOrEqual(10);
  });
});
