import { prisma } from "./db";
import { NotificationType } from "./constants";

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  /** When provided, duplicate notifications with the same key are suppressed. */
  idempotencyKey?: string | null;
}

/**
 * Create a single in-app notification. Idempotent when an idempotencyKey is
 * supplied (requirements M08-R03, 03 §2.4 — "fires once, no duplicates").
 */
export async function createNotification(
  input: NotificationInput,
): Promise<void> {
  const data = {
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link ?? null,
  };
  if (input.idempotencyKey) {
    // Upsert on the unique key so concurrent retries cannot create duplicates.
    await prisma.notification.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      create: { ...data, idempotencyKey: input.idempotencyKey },
      update: {},
    });
    return;
  }
  await prisma.notification.create({ data });
}

/** Fan out the same notification to many users. */
export async function notifyUsers(
  userIds: string[],
  input: Omit<NotificationInput, "userId"> & { keySuffix?: string },
): Promise<void> {
  const unique = Array.from(new Set(userIds));
  for (const userId of unique) {
    await createNotification({
      ...input,
      userId,
      idempotencyKey: input.idempotencyKey
        ? `${input.idempotencyKey}:${userId}`
        : undefined,
    });
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

/** The current user's notifications, newest first (M08). */
export async function listNotifications(userId: string, take = 50) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
