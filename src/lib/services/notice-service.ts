import { prisma } from "../db";
import { writeAudit } from "../audit";
import { notifyUsers } from "../notifications";
import { ForbiddenError, ValidationError } from "../errors";
import { Actor, authorize } from "../permissions";
import type { NoticeInput } from "../validation";

/**
 * Route that shows notices to the given role. There is no shared `/notices`
 * page — each role has its own — so notification links must be role-aware or
 * they lead to a 404.
 */
export function noticesLinkFor(role: string): string {
  if (role === "ADMIN") return "/admin/notices";
  if (role === "FACULTY") return "/faculty/notices";
  return "/student/notices";
}

/** Resolve the users who should receive a notice for its audience. */
async function recipientUserIds(input: {
  audience: string;
  courseId?: string | null;
  batchId?: string | null;
}): Promise<string[]> {
  switch (input.audience) {
    case "ALL":
      return (await prisma.user.findMany({ where: { isActive: true }, select: { id: true } })).map(
        (u) => u.id,
      );
    case "STUDENT":
      return (
        await prisma.user.findMany({ where: { role: "STUDENT" }, select: { id: true } })
      ).map((u) => u.id);
    case "FACULTY":
      return (
        await prisma.user.findMany({ where: { role: "FACULTY" }, select: { id: true } })
      ).map((u) => u.id);
    case "ADMIN":
      return (
        await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })
      ).map((u) => u.id);
    case "COURSE": {
      if (!input.courseId) return [];
      const batches = await prisma.batch.findMany({
        where: { courseId: input.courseId },
        select: { id: true },
      });
      const batchIds = batches.map((b) => b.id);
      const students = await prisma.studentProfile.findMany({
        where: { batchId: { in: batchIds } },
        select: { userId: true },
      });
      const faculty = await prisma.subjectOffering.findMany({
        where: { batchId: { in: batchIds } },
        select: { facultyId: true },
      });
      return [...students.map((s) => s.userId), ...faculty.map((f) => f.facultyId)];
    }
    case "BATCH": {
      if (!input.batchId) return [];
      const students = await prisma.studentProfile.findMany({
        where: { batchId: input.batchId },
        select: { userId: true },
      });
      const faculty = await prisma.subjectOffering.findMany({
        where: { batchId: input.batchId },
        select: { facultyId: true },
      });
      return [...students.map((s) => s.userId), ...faculty.map((f) => f.facultyId)];
    }
    default:
      return [];
  }
}

/** Admin publishes institution notices; Faculty publishes course/batch notices. */
export async function createNotice(actor: Actor, input: NoticeInput) {
  const isGlobal = ["ALL", "ADMIN", "FACULTY", "STUDENT"].includes(input.audience);
  if (isGlobal) {
    authorize(actor, "notice:create:global");
  } else {
    // Course/batch notices: faculty must be assigned to an offering in scope.
    authorize(actor, "notice:create:course", { assignedFacultyId: actor.id });
    if (actor.role === "FACULTY") {
      const scope = await prisma.subjectOffering.findFirst({
        where:
          input.audience === "BATCH"
            ? { facultyId: actor.id, batchId: input.batchId ?? "__none__" }
            : {
                facultyId: actor.id,
                batchId: input.batchId ?? undefined,
                subject: { courseId: input.courseId ?? "__none__" },
              },
      });
      if (!scope) {
        throw new ForbiddenError(
          "You can only post notices for batches/courses you teach.",
        );
      }
    }
  }

  if (input.audience === "COURSE" && !input.courseId) {
    throw new ValidationError("A course must be selected for a course notice.");
  }
  if (input.audience === "BATCH" && !input.batchId) {
    throw new ValidationError("A batch must be selected for a batch notice.");
  }

  const notice = await prisma.notice.create({
    data: {
      title: input.title,
      body: input.body,
      audience: input.audience,
      courseId: input.courseId ?? null,
      batchId: input.batchId ?? null,
      createdById: actor.id,
      isPublished: true,
    },
  });

  const recipients = await recipientUserIds({
    audience: input.audience,
    courseId: input.courseId ?? null,
    batchId: input.batchId ?? null,
  });
  if (recipients.length > 0) {
    // Group by role so each recipient deep-links to the notices page that
    // actually exists for them.
    const users = await prisma.user.findMany({
      where: { id: { in: recipients } },
      select: { id: true, role: true },
    });
    const byRole = new Map<string, string[]>();
    for (const user of users) {
      const list = byRole.get(user.role);
      if (list) list.push(user.id);
      else byRole.set(user.role, [user.id]);
    }
    for (const [role, ids] of byRole) {
      await notifyUsers(ids, {
        type: "NOTICE",
        title: input.title,
        body: input.body.slice(0, 160),
        link: noticesLinkFor(role),
      });
    }
  }

  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "notice.create",
    entityType: "Notice",
    entityId: notice.id,
    summary: `Notice "${input.title}" for ${input.audience}`,
  });
  return notice;
}

/** Notices visible to the current actor, newest first. */
export async function listNotices(actor: Actor) {
  if (actor.role === "ADMIN") {
    return prisma.notice.findMany({ orderBy: { createdAt: "desc" } });
  }
  if (actor.role === "FACULTY") {
    return prisma.notice.findMany({
      where: { audience: { in: ["ALL", "FACULTY", "COURSE", "BATCH"] } },
      orderBy: { createdAt: "desc" },
    });
  }
  // Student: global student notices, own course and own batch.
  let courseId: string | null = null;
  if (actor.batchId) {
    const batch = await prisma.batch.findUnique({ where: { id: actor.batchId } });
    courseId = batch?.courseId ?? null;
  }
  return prisma.notice.findMany({
    where: {
      OR: [
        { audience: "ALL" },
        { audience: "STUDENT" },
        { audience: "COURSE", courseId: courseId ?? "__none__" },
        { audience: "BATCH", batchId: actor.batchId ?? "__none__" },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
}
