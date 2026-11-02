/**
 * Vercel build entry point.
 *
 * Vercel's serverless filesystem is read-only except for ephemeral `/tmp`, so
 * the git-ignored `prisma/dev.db` never reaches production. This script:
 *
 *   1. generates the Prisma client,
 *   2. creates and seeds a bundled SQLite demo database (`prisma/seed.db`),
 *   3. creates a per-deployment session signing secret,
 *   4. runs the normal Next.js production build.
 *
 * `next.config.mjs` traces `prisma/seed.db` and `.vercel-session-secret` into
 * the server bundle; `src/lib/db.ts` copies the database to `/tmp` at runtime.
 *
 * Run locally with: `npm run vercel-build` (it is also what Vercel executes).
 */
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const env = { ...process.env, DATABASE_URL: "file:./seed.db" };

const prismaCli = fileURLToPath(
  new URL("../node_modules/prisma/build/index.js", import.meta.url),
);
const tsxCli = fileURLToPath(
  new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url),
);
const nextCli = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url),
);

function run(label, args) {
  console.log(`\n[vercel-build] ${label}`);
  execFileSync(process.execPath, args, {
    cwd: root,
    env,
    stdio: "inherit",
  });
}

run("prisma generate", [prismaCli, "generate"]);
run("create sqlite schema", [
  prismaCli,
  "db",
  "push",
  "--skip-generate",
]);
run("seed demo database", [tsxCli, "prisma/seed.ts"]);

const secretPath = fileURLToPath(
  new URL("../.vercel-session-secret", import.meta.url),
);
if (!existsSync(secretPath)) {
  writeFileSync(secretPath, randomBytes(48).toString("base64url"), {
    mode: 0o600,
  });
  console.log("\n[vercel-build] generated per-deployment session secret");
}

run("next build", [nextCli, "build"]);
