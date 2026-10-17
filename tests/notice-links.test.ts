import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { noticesLinkFor } from "@/lib/services/notice-service";

/**
 * Regression guard for a real defect: notice notifications linked to `/notices`,
 * a route that does not exist (each role has its own notices page), so clicking
 * a notice notification produced a 404.
 */
describe("notice notification links", () => {
  it("maps each role to its real notices route", () => {
    expect(noticesLinkFor("ADMIN")).toBe("/admin/notices");
    expect(noticesLinkFor("FACULTY")).toBe("/faculty/notices");
    expect(noticesLinkFor("STUDENT")).toBe("/student/notices");
  });

  it("does not link to the non-existent bare /notices route anywhere in src", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry)) continue;
        const text = readFileSync(full, "utf8");
        if (text.includes('"/notices"') || text.includes("'/notices'")) {
          offenders.push(full);
        }
      }
    };
    walk(join(process.cwd(), "src"));

    expect(offenders).toEqual([]);
  });
});
