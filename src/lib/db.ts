import { PrismaClient } from "@prisma/client";
import { copyFileSync, existsSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Prisma client singleton. In development Next.js hot-reloads modules, so we
 * cache the client on `globalThis` to avoid exhausting SQLite connections.
 *
 * Vercel (and similar serverless hosts) mounts the deployment read-only and
 * only provides ephemeral, per-instance `/tmp` scratch space. The demo database
 * therefore cannot live at `prisma/dev.db` in production. `vercel-build`
 * generates `prisma/seed.db` and Next.js traces it into the function bundle; at
 * runtime we copy it to `/tmp` once per instance and point Prisma at that copy.
 * The copy is writable, so sign-in, sessions and demo mutations do not crash.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** True when running inside a Vercel function (not during `next build`). */
function isServerlessRuntime(): boolean {
  return (
    (process.env.VERCEL === "1" || process.env.VERCEL === "true") &&
    process.env.NEXT_PHASE !== "phase-production-build"
  );
}

/**
 * Try multiple candidate paths for a file, returning the first that exists.
 * This is defence-in-depth for Vercel where cwd may vary.
 */
function findExistingPath(candidates: string[]): string | undefined {
  return candidates.find((c) => existsSync(c));
}

/**
 * On Vercel, return a writable SQLite URL backed by the bundled seed database.
 * Every instance receives the same seeded file, so demo user IDs are stable
 * across instances and requests.
 */
function resolveDatabaseUrl(): string | undefined {
  if (!isServerlessRuntime()) return undefined;

  const target = join(tmpdir(), "smart-campus-demo.db");
  if (!existsSync(target)) {
    const cwd = process.cwd();
    const source = findExistingPath([
      join(cwd, "prisma", "seed.db"),
      join(cwd, "..", "prisma", "seed.db"),
      join(cwd, "prisma", "dev.db"),
      join(cwd, "..", "prisma", "dev.db"),
    ]);

    if (!source) {
      throw new Error(
        "Demo database not found in the deployment bundle. Run `npm run vercel-build` so prisma/seed.db is generated before `next build`.",
      );
    }

    // Copy to a temporary name and rename so a concurrent request never sees a
    // half-written database file.
    const temporary = `${target}.${process.pid}.tmp`;
    copyFileSync(source, temporary);
    renameSync(temporary, target);
  }

  return `file:${target}`;
}

const datasourceUrl = resolveDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Cache the client in every environment: serverless instances and dev
// hot-reloads should both reuse one connection pool.
globalForPrisma.prisma = prisma;

export type { PrismaClient };
