import { prisma } from "../db";
import { writeAudit } from "../audit";
import { NotFoundError } from "../errors";
import { Actor, authorize } from "../permissions";

// --- Reads (any authenticated actor) ---------------------------------------

export async function getActiveTerm() {
  return (
    (await prisma.academicTerm.findFirst({ where: { isActive: true } })) ??
    (await prisma.academicTerm.findFirst({ orderBy: { startDate: "desc" } }))
  );
}

export async function listTerms() {
  return prisma.academicTerm.findMany({ orderBy: { startDate: "desc" } });
}

export async function listDepartments() {
  return prisma.department.findMany({ orderBy: { code: "asc" } });
}

export async function listCourses() {
  return prisma.course.findMany({
    include: { department: true },
    orderBy: { code: "asc" },
  });
}

export async function listSubjects() {
  return prisma.subject.findMany({
    include: { course: true, department: true },
    orderBy: { code: "asc" },
  });
}

export async function listBatches() {
  return prisma.batch.findMany({
    include: { course: true, term: true },
    orderBy: { name: "asc" },
  });
}

export async function listClassrooms() {
  return prisma.classroom.findMany({ orderBy: { code: "asc" } });
}

export async function listOfferings(termId?: string) {
  return prisma.subjectOffering.findMany({
    where: termId ? { termId } : {},
    include: {
      subject: true,
      batch: true,
      faculty: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { subject: { code: "asc" } },
  });
}

export async function listFacultyUsers() {
  return prisma.user.findMany({
    where: { role: "FACULTY", isActive: true },
    include: { facultyProfile: true },
    orderBy: { firstName: "asc" },
  });
}

// --- Writes (Admin) --------------------------------------------------------

export async function createDepartment(
  actor: Actor,
  input: { code: string; name: string },
) {
  authorize(actor, "academic:manage");
  const dept = await prisma.department.create({ data: input });
  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "academic.department.create",
    entityType: "Department",
    entityId: dept.id,
    summary: input.name,
  });
  return dept;
}

export async function createCourse(
  actor: Actor,
  input: {
    code: string;
    name: string;
    departmentId: string;
    durationYears: number;
  },
) {
  authorize(actor, "academic:manage");
  const course = await prisma.course.create({ data: input });
  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "academic.course.create",
    entityType: "Course",
    entityId: course.id,
    summary: input.name,
  });
  return course;
}

export async function createSubject(
  actor: Actor,
  input: {
    code: string;
    name: string;
    courseId: string;
    departmentId: string;
    credits: number;
    semester: number;
    isLab: boolean;
  },
) {
  authorize(actor, "academic:manage");
  const subject = await prisma.subject.create({ data: input });
  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "academic.subject.create",
    entityType: "Subject",
    entityId: subject.id,
    summary: `${input.code} ${input.name}`,
  });
  return subject;
}

export async function createBatch(
  actor: Actor,
  input: {
    name: string;
    courseId: string;
    termId: string;
    semester: number;
    strength: number;
  },
) {
  authorize(actor, "academic:manage");
  const batch = await prisma.batch.create({ data: input });
  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "academic.batch.create",
    entityType: "Batch",
    entityId: batch.id,
    summary: input.name,
  });
  return batch;
}

export async function createClassroom(
  actor: Actor,
  input: {
    code: string;
    name: string;
    capacity: number;
    type: "LECTURE" | "LAB";
    building?: string;
  },
) {
  authorize(actor, "academic:manage");
  const room = await prisma.classroom.create({
    data: {
      code: input.code,
      name: input.name,
      capacity: input.capacity,
      type: input.type,
      building: input.building ?? null,
    },
  });
  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "academic.classroom.create",
    entityType: "Classroom",
    entityId: room.id,
    summary: `${input.code} (${input.type}, cap ${input.capacity})`,
  });
  return room;
}

export async function createOffering(
  actor: Actor,
  input: {
    subjectId: string;
    batchId: string;
    facultyId: string;
    weeklySessions: number;
  },
) {
  authorize(actor, "academic:manage");
  const term = await getActiveTerm();
  if (!term) throw new NotFoundError("No active academic term is configured.");
  const offering = await prisma.subjectOffering.create({
    data: {
      subjectId: input.subjectId,
      batchId: input.batchId,
      facultyId: input.facultyId,
      termId: term.id,
      weeklySessions: input.weeklySessions,
    },
  });
  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "academic.offering.create",
    entityType: "SubjectOffering",
    entityId: offering.id,
    summary: "Created subject offering",
  });
  return offering;
}
