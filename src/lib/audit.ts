import { prisma } from "./db";

export interface AuditInput {
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  summary?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  result?: "SUCCESS" | "DENIED" | "FAILURE";
}

/**
 * Append-only audit trail (requirements/02 §7). Never throws into the caller —
 * a failed audit write must not roll back the business action, but it is
 * surfaced in server logs.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        summary: input.summary ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        result: input.result ?? "SUCCESS",
      },
    });
  } catch (error) {
    console.error("[audit] failed to write entry", {
      action: input.action,
      // never log full personal records or secrets
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

/** Most recent audit entries for the admin audit view (M13). */
export async function listAuditLog(limit = 100) {
  return prisma.auditLog.findMany({
    orderBy: { timestamp: "desc" },
    take: limit,
    include: {
      actor: { select: { firstName: true, lastName: true, email: true, role: true } },
    },
  });
}
