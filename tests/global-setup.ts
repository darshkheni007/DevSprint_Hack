import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Creates a fresh, isolated test database before the suite runs.
 *
 * Uses `prisma db push --force-reset` against `file:./test.db`, which resolves
 * (relative to the schema directory) to `prisma/test.db`. The demo database
 * `prisma/dev.db` is never touched.
 *
 * The Prisma CLI is invoked with the current Node binary rather than `npx`:
 * on Windows, spawning an `.cmd` shim from `execFileSync` fails with EINVAL
 * (Node's .cmd/.bat spawn mitigation), and going through a shell would add
 * fragile quoting.
 */
export default function setup() {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));

  execFileSync(
    process.execPath,
    [prismaCli, "db", "push", "--force-reset", "--skip-generate"],
    {
      cwd: root,
      // An explicitly-set DATABASE_URL wins over the one in .env (dotenv does
      // not override existing environment variables).
      env: { ...process.env, DATABASE_URL: "file:./test.db" },
      stdio: "inherit",
    },
  );
}
