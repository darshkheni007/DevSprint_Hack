import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import type { Actor } from "@/lib/permissions";

/** Password used for every fixture account (never a real credential). */
export const TEST_PASSWORD = "Test#Campus2026";

export interface Fixture {
  termId: string;
  departmentId: string;
  courseId: string;
  batch1Id: string;
  batch2Id: string;
  classroomIds: string[];
  versionId: string;
  facultyA: { userId: string; studentProfileId?: never; actor: Actor };
  facultyB: { userId: string; actor: Actor };
  admin: { userId: string; actor: Actor };
  student1: { userId: string; profileId: string; actor: Actor };
  student2: { userId: string; profileId: string; actor: Actor };
  offeringIds: { o1: string; o2: string; o3: string; o4: string };
  slots: { A1: string; A2: string; B1: string; B2: string; D: string };
  userIds: string[];
}

/** UTC midnight of the first date in `year` whose weekday matches (1=Mon..6=Sat). */
export function dateForWeekdayInYear(weekday: number, year: number): Date {
  const base = Date.UTC(year, 0, 1);
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(base + i * 86_400_000);
    const wd = ((d.getUTCDay() + 6) % 7) + 1;
    if (wd === weekday) return d;
  }
  throw new Error(`No date found for weekday ${weekday} in ${year}`);
}

/** UTC midnight of the first date >= 2026-01-01 whose weekday matches (1=Mon..6=Sat). */
export function dateForWeekday(weekday: number): Date {
  return dateForWeekdayInYear(weekday, 2026);
}

function toKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** A weekday different from the given one, guaranteed inside the term. */
export function otherWeekday(weekday: number): number {
  return weekday === 1 ? 2 : 1;
}

export { toKey };

/**
 * Builds a small but complete academic graph in the (isolated) test database.
 * Every code is suffixed so fixtures from different files cannot collide.
 */
export async function seedCampus(suffix: string): Promise<Fixture> {
  const passwordHash = await hashPassword(TEST_PASSWORD);

  const department = await prisma.department.create({
    data: { code: `D-${suffix}`, name: `Test Dept ${suffix}` },
  });
  const course = await prisma.course.create({
    data: { code: `C-${suffix}`, name: `Test Course ${suffix}`, departmentId: department.id },
  });
  const [s1, s2, s3] = await Promise.all([
    prisma.subject.create({
      data: { code: `S1-${suffix}`, name: `Subject One ${suffix}`, courseId: course.id, departmentId: department.id, credits: 3, semester: 1 },
    }),
    prisma.subject.create({
      data: { code: `S2-${suffix}`, name: `Subject Two ${suffix}`, courseId: course.id, departmentId: department.id, credits: 3, semester: 1 },
    }),
    prisma.subject.create({
      data: { code: `S3-${suffix}`, name: `Subject Three ${suffix}`, courseId: course.id, departmentId: department.id, credits: 3, semester: 1 },
    }),
  ]);

  const term = await prisma.academicTerm.create({
    data: {
      name: `Term-${suffix}`,
      startDate: new Date(Date.UTC(2026, 0, 1)),
      endDate: new Date(Date.UTC(2026, 11, 31)),
      isActive: true,
    },
  });

  const batch1 = await prisma.batch.create({
    data: { name: `Batch1-${suffix}`, courseId: course.id, termId: term.id, semester: 1, strength: 30 },
  });
  const batch2 = await prisma.batch.create({
    data: { name: `Batch2-${suffix}`, courseId: course.id, termId: term.id, semester: 1, strength: 30 },
  });

  const [r1, r2, r3] = await Promise.all([
    prisma.classroom.create({ data: { code: `R1-${suffix}`, name: "Room 1", capacity: 120, type: "LECTURE" } }),
    prisma.classroom.create({ data: { code: `R2-${suffix}`, name: "Room 2", capacity: 120, type: "LECTURE" } }),
    prisma.classroom.create({ data: { code: `R3-${suffix}`, name: "Room 3", capacity: 120, type: "LECTURE" } }),
  ]);

  const userIds: string[] = [];
  async function makeUser(
    role: "ADMIN" | "FACULTY" | "STUDENT",
    loginId: string,
    firstName: string,
  ) {
    const user = await prisma.user.create({
      data: {
        email: `${loginId}@test.local`,
        loginId,
        passwordHash,
        role,
        firstName,
        lastName: "Tester",
        isActive: true,
      },
    });
    userIds.push(user.id);
    return user;
  }

  const facAUser = await makeUser("FACULTY", `fa-${suffix}`, "Faculty A");
  const facBUser = await makeUser("FACULTY", `fb-${suffix}`, "Faculty B");
  const adminUser = await makeUser("ADMIN", `ad-${suffix}`, "Admin");
  const stud1User = await makeUser("STUDENT", `st1-${suffix}`, "Student One");
  const stud2User = await makeUser("STUDENT", `st2-${suffix}`, "Student Two");

  await prisma.facultyProfile.create({ data: { userId: facAUser.id, employeeNo: `E-${suffix}-A`, departmentId: department.id, designation: "Professor" } });
  await prisma.facultyProfile.create({ data: { userId: facBUser.id, employeeNo: `E-${suffix}-B`, departmentId: department.id, designation: "Professor" } });

  const p1 = await prisma.studentProfile.create({ data: { userId: stud1User.id, rollNo: `R-${suffix}-1`, departmentId: department.id, batchId: batch1.id, admissionYear: 2026 } });
  const p2 = await prisma.studentProfile.create({ data: { userId: stud2User.id, rollNo: `R-${suffix}-2`, departmentId: department.id, batchId: batch1.id, admissionYear: 2026 } });

  const o1 = await prisma.subjectOffering.create({ data: { subjectId: s1.id, batchId: batch1.id, facultyId: facAUser.id, termId: term.id, weeklySessions: 2 } });
  const o2 = await prisma.subjectOffering.create({ data: { subjectId: s2.id, batchId: batch1.id, facultyId: facBUser.id, termId: term.id, weeklySessions: 1 } });
  const o3 = await prisma.subjectOffering.create({ data: { subjectId: s3.id, batchId: batch1.id, facultyId: facBUser.id, termId: term.id, weeklySessions: 1 } });
  const o4 = await prisma.subjectOffering.create({ data: { subjectId: s1.id, batchId: batch2.id, facultyId: facAUser.id, termId: term.id, weeklySessions: 1 } });

  const version = await prisma.timetableVersion.create({
    data: { termId: term.id, versionNumber: 1, status: "PUBLISHED", createdById: adminUser.id, publishedAt: new Date() },
  });

  const mkSlot = (offeringId: string, classroomId: string, facultyId: string, batchId: string, day: number, periodIndex: number) =>
    prisma.timetableSlot.create({ data: { versionId: version.id, offeringId, classroomId, facultyId, batchId, day, periodIndex, slotType: "LECTURE" } });

  // Faculty A: A1 (day1,p1) and A2 (day3,p3) — both on offering O1.
  const A1 = await mkSlot(o1.id, r1.id, facAUser.id, batch1.id, 1, 1);
  const A2 = await mkSlot(o1.id, r1.id, facAUser.id, batch1.id, 3, 3);
  // Faculty B: B1 (day2,p2) on O2, B2 (day4,p4) on O3.
  const B1 = await mkSlot(o2.id, r2.id, facBUser.id, batch1.id, 2, 2);
  const B2 = await mkSlot(o3.id, r2.id, facBUser.id, batch1.id, 4, 4);
  // Conflict trap: faculty A already teaches batch2 at (day2,p2).
  const D = await mkSlot(o4.id, r3.id, facAUser.id, batch2.id, 2, 2);

  const facultyAActor: Actor = { id: facAUser.id, role: "FACULTY", name: "Faculty A Tester", email: facAUser.email };
  const facultyBActor: Actor = { id: facBUser.id, role: "FACULTY", name: "Faculty B Tester", email: facBUser.email };
  const adminActor: Actor = { id: adminUser.id, role: "ADMIN", name: "Admin Tester", email: adminUser.email };
  const student1Actor: Actor = { id: stud1User.id, role: "STUDENT", name: "Student One Tester", email: stud1User.email, studentProfileId: p1.id, batchId: batch1.id };
  const student2Actor: Actor = { id: stud2User.id, role: "STUDENT", name: "Student Two Tester", email: stud2User.email, studentProfileId: p2.id, batchId: batch1.id };

  return {
    termId: term.id,
    departmentId: department.id,
    courseId: course.id,
    batch1Id: batch1.id,
    batch2Id: batch2.id,
    classroomIds: [r1.id, r2.id, r3.id],
    versionId: version.id,
    facultyA: { userId: facAUser.id, actor: facultyAActor },
    facultyB: { userId: facBUser.id, actor: facultyBActor },
    admin: { userId: adminUser.id, actor: adminActor },
    student1: { userId: stud1User.id, profileId: p1.id, actor: student1Actor },
    student2: { userId: stud2User.id, profileId: p2.id, actor: student2Actor },
    offeringIds: { o1: o1.id, o2: o2.id, o3: o3.id, o4: o4.id },
    slots: { A1: A1.id, A2: A2.id, B1: B1.id, B2: B2.id, D: D.id },
    userIds,
  };
}

/** Removes everything created by `seedCampus`, in dependency order. */
export async function cleanupCampus(f: Fixture): Promise<void> {
  const slotIds = Object.values(f.slots);
  const offeringIds = Object.values(f.offeringIds);
  const userWhere = { id: { in: f.userIds } };

  await prisma.auditLog.deleteMany({ where: { actorUserId: { in: f.userIds } } });
  await prisma.lectureCancellation.deleteMany({ where: { slotId: { in: slotIds } } });
  await prisma.lectureSwapRequest.deleteMany({ where: { versionId: f.versionId } });
  await prisma.notification.deleteMany({ where: { userId: { in: f.userIds } } });
  await prisma.attendanceRecord.deleteMany({ where: { studentId: { in: [f.student1.profileId, f.student2.profileId] } } });
  await prisma.markEntry.deleteMany({ where: { studentId: { in: [f.student1.profileId, f.student2.profileId] } } });
  await prisma.classSession.deleteMany({ where: { offeringId: { in: offeringIds } } });
  await prisma.exam.deleteMany({ where: { batchId: { in: [f.batch1Id, f.batch2Id] } } });
  await prisma.enrolment.deleteMany({ where: { studentId: { in: [f.student1.profileId, f.student2.profileId] } } });
  await prisma.timetableSlot.deleteMany({ where: { versionId: f.versionId } });
  await prisma.timetableVersion.deleteMany({ where: { id: f.versionId } });
  await prisma.subjectOffering.deleteMany({ where: { id: { in: offeringIds } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: [f.student1.userId, f.student2.userId] } } });
  await prisma.facultyProfile.deleteMany({ where: { userId: { in: [f.facultyA.userId, f.facultyB.userId] } } });
  await prisma.user.deleteMany({ where: userWhere });
  await prisma.batch.deleteMany({ where: { id: { in: [f.batch1Id, f.batch2Id] } } });
  await prisma.classroom.deleteMany({ where: { id: { in: f.classroomIds } } });
  await prisma.subject.deleteMany({ where: { courseId: f.courseId } });
  await prisma.course.deleteMany({ where: { id: f.courseId } });
  await prisma.department.deleteMany({ where: { id: f.departmentId } });
  await prisma.academicTerm.deleteMany({ where: { id: f.termId } });
}
