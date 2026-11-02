/**
 * Temporary local simulation of the Vercel runtime. Not part of the app.
 */
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function main() {
  process.env.VERCEL = "1";
  delete process.env.NEXT_PHASE;
  delete process.env.SESSION_SECRET;
  // Deliberately point at the normal local DB to prove the runtime override
  // chooses the bundled seed copy on Vercel.
  process.env.DATABASE_URL = "file:./dev.db";

  const target = join(tmpdir(), "smart-campus-demo.db");
  if (existsSync(target)) rmSync(target);

  const { prisma } = await import("../src/lib/db");
  const { authenticate } = await import("../src/lib/services/auth-service");
  const { createSession, validateSessionToken } = await import("../src/lib/session");

  const user = await authenticate("adm001", "Demo#Campus2026");
  console.log("authenticate:", user.role, user.email);

  const sessionsBefore = await prisma.session.count();
  const created = await createSession(user.id);
  const sessionsAfter = await prisma.session.count();

  console.log("token parts:", created.token.split(".").length);
  console.log("db session rows before/after:", sessionsBefore, sessionsAfter);

  const validated = await validateSessionToken(created.token);
  console.log("validateSessionToken userId matches:", validated?.userId === user.id);
  console.log("validateSessionToken role:", validated?.role);

  const { getCurrentActor } = await import("../src/lib/current-user");
  console.log("getCurrentActor exported:", typeof getCurrentActor === "function");

  await prisma.$disconnect();
  if (sessionsAfter !== 0) throw new Error("Expected stateless sessions (no DB row)");
  if (validated?.userId !== user.id) throw new Error("Signed session did not validate");
  console.log("VERCEL SESSION SIMULATION: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
