import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest configuration.
 *
 * DB-backed tests run against an ISOLATED SQLite file (`prisma/test.db`) that is
 * force-reset by `tests/global-setup.ts` before the suite starts. It is never
 * pointed at the demo database (`prisma/dev.db`). Files run sequentially
 * (`fileParallelism: false`) because SQLite serialises writers and would
 * otherwise raise SQLITE_BUSY.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    // SQLite: one writer at a time.
    fileParallelism: false,
    env: {
      // Prisma resolves a relative SQLite path against the schema directory
      // (prisma/), so this points at prisma/test.db — a disposable file.
      DATABASE_URL: "file:./test.db",
    },
  },
});
