/**
 * Deterministic seed data for the Smart Campus demo.
 *
 * Everything here is clearly FAKE (SEC-D09). No real institutional records and
 * no real credentials are used. The seed is idempotent: it clears demo tables
 * and recreates a fixed dataset so results are reproducible.
 *
 * Run with: npm run db:seed   (or npm run setup for generate + push + seed)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_PERIODS, SETTING_KEYS } from "../src/lib/constants";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../src/lib/demo-accounts";
import { solve } from "../src/lib/timetable/solver";

const prisma = new PrismaClient();

const BCRYPT_COST = 12;

const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Diya", "Ananya", "Ishaan",
  "Saanvi", "Kabir", "Myra", "Riya", "Arjun", "Sara",
];
const LAST_NAMES = [
  "Sharma", "Patel", "Reddy", "Nair", "Gupta", "Iyer",
  "Menon", "Singh", "Das", "Khan", "Bose", "Rao",
];

function dayDate(day: number, weekOffset: number): Date {
  // Base Monday 2026-02-02. day=1 => Monday .. day=6 => Saturday.
  const base = new Date("2026-02-02T00:00:00.000Z");
  const offset = (day - 1) + weekOffset * 7;
  return new Date(base.getTime() + offset * 24 * 60 * 60 * 1000);
}

async function clearAll() {
  // Order matters for FK constraints.
  await prisma.lectureCancellation.deleteMany();
  await prisma.lectureSwapRequest.deleteMany();
  await prisma.assistantQueryLog.deleteMany();
  await prisma.knowledgeDocument.deleteMany();
  await prisma.complaintResponse.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.borrowRecord.deleteMany();
  await prisma.book.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.notice.deleteMany();
  await prisma.markEntry.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.classSession.deleteMany();
  await prisma.timetableSlot.deleteMany();
  await prisma.timetableVersion.deleteMany();
  await prisma.facultyAvailability.deleteMany();
  await prisma.enrolment.deleteMany();
  await prisma.subjectOffering.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.facultyProfile.deleteMany();
  await prisma.period.deleteMany();
  await prisma.classroom.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.course.deleteMany();
  await prisma.department.deleteMany();
  await prisma.academicTerm.deleteMany();
  await prisma.session.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log("Seeding Smart Campus demo data...");
  await clearAll();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST);

  // --- System settings -----------------------------------------------------
  await prisma.systemSetting.create({
    data: { key: SETTING_KEYS.attendanceThreshold, value: "75" },
  });

  // --- Periods -------------------------------------------------------------
  for (const p of DEFAULT_PERIODS) {
    await prisma.period.create({
      data: {
        index: p.index,
        label: p.label,
        startTime: p.startTime,
        endTime: p.endTime,
      },
    });
  }

  // --- Academic term -------------------------------------------------------
  const term = await prisma.academicTerm.create({
    data: {
      name: "2026 Even Semester",
      startDate: new Date("2026-01-05T00:00:00.000Z"),
      endDate: new Date("2026-05-30T00:00:00.000Z"),
      isActive: true,
    },
  });

  // --- Departments ---------------------------------------------------------
  const deptCSE = await prisma.department.create({
    data: { code: "CSE", name: "Computer Science & Engineering" },
  });
  const deptECE = await prisma.department.create({
    data: { code: "ECE", name: "Electronics & Communication Engineering" },
  });
  const deptMECH = await prisma.department.create({
    data: { code: "MECH", name: "Mechanical Engineering" },
  });
  const deptSCI = await prisma.department.create({
    data: { code: "SCI", name: "Basic Sciences & Mathematics" },
  });

  // --- Courses -------------------------------------------------------------
  const courseCSE = await prisma.course.create({
    data: { code: "BTCS", name: "B.Tech Computer Science", departmentId: deptCSE.id, durationYears: 4 },
  });
  const courseECE = await prisma.course.create({
    data: { code: "BTEC", name: "B.Tech Electronics", departmentId: deptECE.id, durationYears: 4 },
  });
  const courseMECH = await prisma.course.create({
    data: { code: "BTME", name: "B.Tech Mechanical", departmentId: deptMECH.id, durationYears: 4 },
  });

  // --- Subjects ------------------------------------------------------------
  const subjectData: {
    code: string; name: string; courseId: string; departmentId: string;
    credits: number; semester: number; isLab: boolean;
  }[] = [
    { code: "CS201", name: "Data Structures", courseId: courseCSE.id, departmentId: deptCSE.id, credits: 4, semester: 4, isLab: false },
    { code: "CS202", name: "Database Systems", courseId: courseCSE.id, departmentId: deptCSE.id, credits: 4, semester: 4, isLab: false },
    { code: "CS203", name: "Operating Systems", courseId: courseCSE.id, departmentId: deptCSE.id, credits: 4, semester: 4, isLab: false },
    { code: "CS204", name: "Data Structures Lab", courseId: courseCSE.id, departmentId: deptCSE.id, credits: 2, semester: 4, isLab: true },
    { code: "CS205", name: "Database Systems Lab", courseId: courseCSE.id, departmentId: deptCSE.id, credits: 2, semester: 4, isLab: true },
    { code: "MA201", name: "Discrete Mathematics", courseId: courseCSE.id, departmentId: deptSCI.id, credits: 3, semester: 4, isLab: false },
    { code: "EC201", name: "Digital Electronics", courseId: courseECE.id, departmentId: deptECE.id, credits: 4, semester: 4, isLab: false },
    { code: "EC202", name: "Signals & Systems", courseId: courseECE.id, departmentId: deptECE.id, credits: 4, semester: 4, isLab: false },
    { code: "EC203", name: "Digital Electronics Lab", courseId: courseECE.id, departmentId: deptECE.id, credits: 2, semester: 4, isLab: true },
    { code: "ME201", name: "Thermodynamics", courseId: courseMECH.id, departmentId: deptMECH.id, credits: 4, semester: 4, isLab: false },
    { code: "ME202", name: "Fluid Mechanics", courseId: courseMECH.id, departmentId: deptMECH.id, credits: 4, semester: 4, isLab: false },
  ];
  const subjects: Record<string, { id: string; name: string; isLab: boolean }> = {};
  for (const s of subjectData) {
    const created = await prisma.subject.create({ data: s });
    subjects[s.code] = { id: created.id, name: created.name, isLab: created.isLab };
  }

  // --- Classrooms ----------------------------------------------------------
  const classroomData = [
    { code: "L101", name: "Lecture Hall 101", capacity: 70, type: "LECTURE", building: "Main Block" },
    { code: "L102", name: "Lecture Hall 102", capacity: 70, type: "LECTURE", building: "Main Block" },
    { code: "L103", name: "Lecture Hall 103", capacity: 65, type: "LECTURE", building: "Main Block" },
    { code: "L104", name: "Lecture Hall 104", capacity: 55, type: "LECTURE", building: "Annex" },
    { code: "LAB1", name: "Computer Lab 1", capacity: 70, type: "LAB", building: "CS Block" },
    { code: "LAB2", name: "Computer Lab 2", capacity: 70, type: "LAB", building: "CS Block" },
    { code: "ELAB", name: "Electronics Lab", capacity: 60, type: "LAB", building: "ECE Block" },
    { code: "MLAB", name: "Mechanics Lab", capacity: 55, type: "LAB", building: "Mech Block" },
  ];
  const classrooms: { id: string; code: string; capacity: number; type: string }[] = [];
  for (const c of classroomData) {
    classrooms.push(await prisma.classroom.create({ data: c }));
  }

  // --- Batches -------------------------------------------------------------
  const batchCSEA = await prisma.batch.create({
    data: { name: "CSE-2026-A", courseId: courseCSE.id, termId: term.id, semester: 4, strength: 60 },
  });
  const batchCSEB = await prisma.batch.create({
    data: { name: "CSE-2026-B", courseId: courseCSE.id, termId: term.id, semester: 4, strength: 58 },
  });
  const batchECEA = await prisma.batch.create({
    data: { name: "ECE-2026-A", courseId: courseECE.id, termId: term.id, semester: 4, strength: 55 },
  });
  const batchMEA = await prisma.batch.create({
    data: { name: "ME-2026-A", courseId: courseMECH.id, termId: term.id, semester: 4, strength: 50 },
  });
  const batches = [batchCSEA, batchCSEB, batchECEA, batchMEA];

  // --- Admin ---------------------------------------------------------------
  const admin = await prisma.user.create({
    data: {
      email: "admin@campus.edu",
      loginId: "adm001",
      passwordHash,
      role: "ADMIN",
      firstName: "Priya",
      lastName: "Menon",
      phone: "+91-90000-00001",
    },
  });

  // --- Faculty -------------------------------------------------------------
  const facultyData = [
    { email: "ananya.rao@campus.edu", loginId: "fac001", firstName: "Ananya", lastName: "Rao", departmentId: deptCSE.id, designation: "Associate Professor", officeRoom: "CS-201" },
    { email: "vikram.nair@campus.edu", loginId: "fac002", firstName: "Vikram", lastName: "Nair", departmentId: deptCSE.id, designation: "Assistant Professor", officeRoom: "CS-203" },
    { email: "meera.iyer@campus.edu", loginId: "fac003", firstName: "Meera", lastName: "Iyer", departmentId: deptCSE.id, designation: "Professor", officeRoom: "CS-104" },
    { email: "rahul.verma@campus.edu", loginId: "fac004", firstName: "Rahul", lastName: "Verma", departmentId: deptECE.id, designation: "Associate Professor", officeRoom: "EC-110" },
    { email: "sneha.kulkarni@campus.edu", loginId: "fac005", firstName: "Sneha", lastName: "Kulkarni", departmentId: deptMECH.id, designation: "Assistant Professor", officeRoom: "ME-210" },
    { email: "imran.khan@campus.edu", loginId: "fac006", firstName: "Imran", lastName: "Khan", departmentId: deptSCI.id, designation: "Professor", officeRoom: "SCI-12" },
  ];
  const facultyUsers: Record<string, { id: string; name: string }> = {};
  for (const f of facultyData) {
    const user = await prisma.user.create({
      data: {
        email: f.email,
        loginId: f.loginId,
        passwordHash,
        role: "FACULTY",
        firstName: f.firstName,
        lastName: f.lastName,
      },
    });
    await prisma.facultyProfile.create({
      data: {
        userId: user.id,
        employeeNo: f.loginId.toUpperCase(),
        departmentId: f.departmentId,
        designation: f.designation,
        officeRoom: f.officeRoom,
      },
    });
    facultyUsers[f.loginId] = { id: user.id, name: `${f.firstName} ${f.lastName}` };
  }

  // --- Students ------------------------------------------------------------
  const studentUsers: { id: string; profileId: string; batchId: string; name: string }[] = [];
  let globalIndex = 0;
  for (const batch of batches) {
    const deptId =
      batch.courseId === courseCSE.id ? deptCSE.id
      : batch.courseId === courseECE.id ? deptECE.id
      : deptMECH.id;
    for (let i = 0; i < 10; i++) {
      const first = FIRST_NAMES[globalIndex % FIRST_NAMES.length]!;
      const last = LAST_NAMES[(globalIndex * 3) % LAST_NAMES.length]!;
      const roll = `${batch.name.replace("2026-", "26")}-${String(i + 1).padStart(3, "0")}`;
      const user = await prisma.user.create({
        data: {
          email: `student${String(globalIndex + 1).padStart(3, "0")}@campus.edu`,
          loginId: roll.toLowerCase(),
          passwordHash,
          role: "STUDENT",
          firstName: first,
          lastName: last,
        },
      });
      // Guard: the identifier shown on the login screen must exist verbatim.
      if (globalIndex === 0 && user.loginId !== DEMO_ACCOUNTS[2]!.loginId) {
        throw new Error(
          `Seed/login-screen mismatch: stored student loginId "${user.loginId}" != demo hint "${DEMO_ACCOUNTS[2]!.loginId}"`,
        );
      }
      const profile = await prisma.studentProfile.create({
        data: {
          userId: user.id,
          rollNo: roll,
          departmentId: deptId,
          batchId: batch.id,
          admissionYear: 2024,
        },
      });
      await prisma.enrolment.create({
        data: { studentId: profile.id, batchId: batch.id },
      });
      studentUsers.push({
        id: user.id,
        profileId: profile.id,
        batchId: batch.id,
        name: `${first} ${last}`,
      });
      globalIndex++;
    }
  }

  // --- Subject offerings ---------------------------------------------------
  const offeringPlan: {
    batchId: string; code: string; facultyLogin: string; weeklySessions: number;
  }[] = [
    // CSE A
    { batchId: batchCSEA.id, code: "CS201", facultyLogin: "fac001", weeklySessions: 3 },
    { batchId: batchCSEA.id, code: "CS202", facultyLogin: "fac002", weeklySessions: 3 },
    { batchId: batchCSEA.id, code: "CS203", facultyLogin: "fac003", weeklySessions: 3 },
    { batchId: batchCSEA.id, code: "CS204", facultyLogin: "fac001", weeklySessions: 2 },
    { batchId: batchCSEA.id, code: "CS205", facultyLogin: "fac002", weeklySessions: 2 },
    { batchId: batchCSEA.id, code: "MA201", facultyLogin: "fac006", weeklySessions: 3 },
    // CSE B
    { batchId: batchCSEB.id, code: "CS201", facultyLogin: "fac003", weeklySessions: 3 },
    { batchId: batchCSEB.id, code: "CS202", facultyLogin: "fac001", weeklySessions: 3 },
    { batchId: batchCSEB.id, code: "CS203", facultyLogin: "fac002", weeklySessions: 3 },
    { batchId: batchCSEB.id, code: "CS204", facultyLogin: "fac003", weeklySessions: 2 },
    { batchId: batchCSEB.id, code: "CS205", facultyLogin: "fac001", weeklySessions: 2 },
    { batchId: batchCSEB.id, code: "MA201", facultyLogin: "fac006", weeklySessions: 3 },
    // ECE A
    { batchId: batchECEA.id, code: "EC201", facultyLogin: "fac004", weeklySessions: 3 },
    { batchId: batchECEA.id, code: "EC202", facultyLogin: "fac004", weeklySessions: 3 },
    { batchId: batchECEA.id, code: "EC203", facultyLogin: "fac004", weeklySessions: 2 },
    { batchId: batchECEA.id, code: "MA201", facultyLogin: "fac006", weeklySessions: 3 },
    // ME A
    { batchId: batchMEA.id, code: "ME201", facultyLogin: "fac005", weeklySessions: 3 },
    { batchId: batchMEA.id, code: "ME202", facultyLogin: "fac005", weeklySessions: 3 },
    { batchId: batchMEA.id, code: "MA201", facultyLogin: "fac006", weeklySessions: 3 },
  ];

  const offerings: {
    id: string; subjectId: string; batchId: string; facultyId: string;
    subjectCode: string; subjectName: string; isLab: boolean; weeklySessions: number;
  }[] = [];
  for (const plan of offeringPlan) {
    const subject = subjects[plan.code]!;
    const offering = await prisma.subjectOffering.create({
      data: {
        subjectId: subject.id,
        batchId: plan.batchId,
        facultyId: facultyUsers[plan.facultyLogin]!.id,
        termId: term.id,
        weeklySessions: plan.weeklySessions,
      },
    });
    offerings.push({
      id: offering.id,
      subjectId: subject.id,
      batchId: plan.batchId,
      facultyId: offering.facultyId,
      subjectCode: plan.code,
      subjectName: subject.name,
      isLab: subject.isLab,
      weeklySessions: plan.weeklySessions,
    });
  }

  // --- Faculty availability (a couple of restrictions) ---------------------
  // Dr. Meera Iyer unavailable Friday P5/P6; Prof. Imran Khan unavailable Monday.
  const facultyUserByLogin = facultyUsers;
  const availabilityRestrictions: { login: string; day: number; period: number }[] = [
    { login: "fac003", day: 5, period: 5 },
    { login: "fac003", day: 5, period: 6 },
    { login: "fac006", day: 1, period: 1 },
    { login: "fac006", day: 1, period: 2 },
  ];
  // Record full availability grid first (available=true) for restricted faculty,
  // then mark the specific unavailable slots.
  const restrictedLogins = Array.from(new Set(availabilityRestrictions.map((r) => r.login)));
  for (const login of restrictedLogins) {
    const facultyId = facultyUserByLogin[login]!.id;
    for (const day of [1, 2, 3, 4, 5, 6]) {
      for (const period of DEFAULT_PERIODS.map((p) => p.index)) {
        const restricted = availabilityRestrictions.some(
          (r) => r.login === login && r.day === day && r.period === period,
        );
        await prisma.facultyAvailability.create({
          data: { facultyId, day, periodIndex: period, available: !restricted },
        });
      }
    }
  }

  // --- Generate + publish an initial timetable (v1) ------------------------
  const availability = new Map<string, Set<string>>();
  for (const login of restrictedLogins) {
    const facultyId = facultyUserByLogin[login]!.id;
    const allowed = new Set<string>();
    for (const day of [1, 2, 3, 4, 5, 6]) {
      for (const period of DEFAULT_PERIODS.map((p) => p.index)) {
        allowed.add(`${day}:${period}`);
      }
    }
    for (const r of availabilityRestrictions) {
      if (r.login === login) allowed.delete(`${r.day}:${r.period}`);
    }
    availability.set(facultyId, allowed);
  }

  const solverResult = solve({
    tasks: offerings.map((o) => ({
      offeringId: o.id,
      subjectLabel: `${o.subjectCode} ${o.subjectName}`,
      batchId: o.batchId,
      batchStrength: batches.find((b) => b.id === o.batchId)!.strength,
      facultyId: o.facultyId,
      facultyName: "Faculty",
      isLab: o.isLab,
      sessions: o.weeklySessions,
    })),
    rooms: classrooms.map((c) => ({
      id: c.id,
      code: c.code,
      capacity: c.capacity,
      type: c.type === "LAB" ? "LAB" : "LECTURE",
    })),
    days: [1, 2, 3, 4, 5, 6],
    periods: DEFAULT_PERIODS.map((p) => p.index),
    availability,
  });

  const version = await prisma.timetableVersion.create({
    data: {
      termId: term.id,
      versionNumber: 1,
      status: "PUBLISHED",
      createdById: admin.id,
      approvedById: admin.id,
      approvedAt: dayDate(1, -1),
      publishedAt: dayDate(1, -1),
      diagnostics: solverResult.conflicts.length
        ? JSON.stringify(solverResult.conflicts)
        : null,
    },
  });
  const createdSlots: { id: string; offeringId: string; day: number; periodIndex: number; classroomId: string; batchId: string; facultyId: string }[] = [];
  for (const a of solverResult.assignments) {
    const slot = await prisma.timetableSlot.create({
      data: {
        versionId: version.id,
        offeringId: a.offeringId,
        classroomId: a.classroomId,
        facultyId: a.facultyId,
        batchId: a.batchId,
        day: a.day,
        periodIndex: a.periodIndex,
        slotType: a.slotType,
      },
    });
    createdSlots.push({
      id: slot.id, offeringId: a.offeringId, day: a.day,
      periodIndex: a.periodIndex, classroomId: a.classroomId,
      batchId: a.batchId, facultyId: a.facultyId,
    });
  }
  console.log(
    `  timetable v1: ${createdSlots.length} slots, ${solverResult.conflicts.length} conflicts`,
  );

  // --- Class sessions + attendance history ---------------------------------
  // Three past weeks of sessions derived from the published timetable.
  let attendanceRows = 0;
  for (const slot of createdSlots) {
    for (let week = -3; week <= -1; week++) {
      const date = dayDate(slot.day, week);
      const session = await prisma.classSession.create({
        data: {
          offeringId: slot.offeringId,
          slotId: slot.id,
          classroomId: slot.classroomId,
          date,
          day: slot.day,
          periodIndex: slot.periodIndex,
        },
      });
      const batchStudents = studentUsers.filter((s) => s.batchId === slot.batchId);
      const records = batchStudents.map((s, idx) => {
        // Deterministic spread of absences so some students fall below 75%.
        const absent = (idx + slot.day + Math.abs(week)) % 9 === 0;
        return {
          classSessionId: session.id,
          studentId: s.profileId,
          status: absent ? "ABSENT" : "PRESENT",
          markedById: slot.facultyId,
        };
      });
      if (records.length > 0) {
        await prisma.attendanceRecord.createMany({ data: records });
        attendanceRows += records.length;
      }
    }
  }
  console.log(`  attendance: ${attendanceRows} records`);

  // --- Exams + marks -------------------------------------------------------
  const nonLabOfferings = offerings.filter((o) => !o.isLab);
  let examCount = 0;
  let markCount = 0;
  for (const o of nonLabOfferings) {
    const exam = await prisma.exam.create({
      data: {
        subjectId: o.subjectId,
        batchId: o.batchId,
        termId: term.id,
        name: "Mid-Term Examination",
        examDate: dayDate(4, 6),
        startTime: "10:00",
        endTime: "12:00",
        classroomId: classrooms[0]!.id,
        maxMarks: 100,
        invigilatorId: o.facultyId,
        resultPublished: true,
        publishedAt: dayDate(4, 7),
      },
    });
    examCount++;
    const batchStudents = studentUsers.filter((s) => s.batchId === o.batchId);
    const rows = batchStudents.map((s, idx) => {
      const marks = 55 + ((idx * 7 + o.subjectCode.charCodeAt(2) * 3) % 45);
      return {
        examId: exam.id,
        studentId: s.profileId,
        marks: Math.min(100, marks),
        enteredById: o.facultyId,
      };
    });
    await prisma.markEntry.createMany({ data: rows });
    markCount += rows.length;
  }
  console.log(`  exams: ${examCount}, marks: ${markCount}`);

  // --- Library -------------------------------------------------------------
  const books = [
    { title: "Introduction to Algorithms", author: "Cormen, Leiserson, Rivest", isbn: "9780262046305", category: "Computer Science", totalCopies: 5 },
    { title: "Database System Concepts", author: "Silberschatz, Korth, Sudarshan", isbn: "9780078022159", category: "Computer Science", totalCopies: 4 },
    { title: "Operating System Concepts", author: "Silberschatz, Galvin, Gagne", isbn: "9781118063330", category: "Computer Science", totalCopies: 4 },
    { title: "Clean Code", author: "Robert C. Martin", isbn: "9780132350884", category: "Software Engineering", totalCopies: 3 },
    { title: "Digital Design", author: "M. Morris Mano", isbn: "9780132774208", category: "Electronics", totalCopies: 3 },
    { title: "Signals and Systems", author: "Alan V. Oppenheim", isbn: "9780138147570", category: "Electronics", totalCopies: 2 },
    { title: "Engineering Thermodynamics", author: "P. K. Nag", isbn: "9780070260627", category: "Mechanical", totalCopies: 3 },
    { title: "Fluid Mechanics", author: "Frank M. White", isbn: "9780073398273", category: "Mechanical", totalCopies: 2 },
    { title: "Discrete Mathematics and Its Applications", author: "Kenneth H. Rosen", isbn: "9780073383095", category: "Mathematics", totalCopies: 4 },
    { title: "The Pragmatic Programmer", author: "Hunt & Thomas", isbn: "9780135957059", category: "Software Engineering", totalCopies: 2 },
  ];
  const createdBooks: { id: string }[] = [];
  for (const b of books) {
    createdBooks.push(
      await prisma.book.create({
        data: { ...b, availableCopies: b.totalCopies },
      }),
    );
  }
  // A couple of active borrows for demo students.
  for (let i = 0; i < 3; i++) {
    const borrower = studentUsers[i]!;
    await prisma.borrowRecord.create({
      data: {
        bookId: createdBooks[i]!.id,
        userId: borrower.id,
        borrowedAt: dayDate(2, -2),
        dueDate: dayDate(2, 1),
        status: "BORROWED",
      },
    });
    await prisma.book.update({
      where: { id: createdBooks[i]!.id },
      data: { availableCopies: { decrement: 1 } },
    });
  }
  // An overdue borrow.
  await prisma.borrowRecord.create({
    data: {
      bookId: createdBooks[0]!.id,
      userId: studentUsers[10]!.id,
      borrowedAt: dayDate(1, -5),
      dueDate: dayDate(1, -2),
      status: "OVERDUE",
    },
  });
  await prisma.book.update({
    where: { id: createdBooks[0]!.id },
    data: { availableCopies: { decrement: 1 } },
  });

  // --- Notices -------------------------------------------------------------
  const notices = [
    { title: "Mid-Term Examination Schedule Published", body: "The mid-term examinations for all semesters begin on 16 March 2026. Please check the examination section for your batch schedule. Hall tickets are available from the department office.", audience: "ALL" },
    { title: "Library Timings Extended", body: "During the examination period the central library will remain open until 10:00 PM on all working days. Reference books may not be taken out of the reading hall.", audience: "STUDENT" },
    { title: "Faculty Meeting — Academic Review", body: "All faculty members are requested to attend the academic review meeting on Friday at 3:00 PM in the conference hall. Please bring your course progress summaries.", audience: "FACULTY" },
    { title: "Placement Training Registration", body: "Final-year students registered for placement training should confirm their slots with the training and placement office by the end of this month.", audience: "STUDENT" },
  ];
  for (const n of notices) {
    await prisma.notice.create({
      data: { ...n, createdById: admin.id, isPublished: true },
    });
  }

  // --- Knowledge base (approved + one unapproved draft) --------------------
  const docs = [
    { title: "Attendance Policy", category: "Academic", content: "Students must maintain at least 75% attendance in every subject to be eligible for end-semester examinations. Attendance is recorded per class session by the subject faculty. Students falling below the threshold are flagged and notified. Medical leave must be supported by a certificate submitted within 7 days to the department office.", isApproved: true },
    { title: "Examination Rules", category: "Examination", content: "Mid-term and end-semester examination schedules are published on the notice board and in the Examinations section of this portal. Students must carry their hall ticket and college ID. Electronic devices are not permitted in the examination hall. Results are published by the examination cell after approval.", isApproved: true },
    { title: "Library Procedures", category: "Library", content: "Students may borrow up to 3 books for 14 days. Books can be renewed once if not reserved by another reader. The catalogue can be searched by title, author, ISBN or category. Overdue books must be returned to the library counter; a reminder is sent before the due date. Reference books and journals are for reading-room use only.", isApproved: true },
    { title: "Timetable and Class Sessions", category: "Academic", content: "The class timetable is generated by the timetable engine and published only after review and approval by the administration. Students see the published timetable for their own batch. In case of a clash or a change, an updated version is published and a notification is sent to affected students and faculty.", isApproved: true },
    { title: "Campus Contacts", category: "General", content: "For academic matters contact the Academic Section. For fee and scholarship queries contact the Accounts Office. For hostel and transport contact the Administration Office. For placement activities contact the Training and Placement Cell. For library matters contact the Central Library desk.", isApproved: true },
    { title: "DRAFT — Proposed Hostel Policy 2026", category: "General", content: "This document is a work in progress and has not been approved. It should never be used as a source of answers.", isApproved: false },
  ];
  for (const d of docs) {
    await prisma.knowledgeDocument.create({ data: d });
  }

  // --- Feedback & complaints ----------------------------------------------
  await prisma.feedback.create({
    data: {
      studentId: studentUsers[0]!.id,
      facultyId: facultyUsers["fac001"]!.id,
      subject: "Pace of lectures",
      message: "The lectures are well structured but moving slightly fast for the lab component.",
      isAnonymous: true,
    },
  });
  const complaint = await prisma.complaint.create({
    data: {
      studentId: studentUsers[1]!.id,
      category: "Facilities",
      subject: "Projector not working in L102",
      message: "The projector in Lecture Hall 102 has been flickering for the past week and lectures are affected.",
      status: "IN_REVIEW",
    },
  });
  await prisma.complaintResponse.create({
    data: {
      complaintId: complaint.id,
      adminId: admin.id,
      message: "The IT team has been informed and a replacement unit is scheduled this week.",
      statusChange: "IN_REVIEW",
    },
  });

  // --- Welcome notifications ----------------------------------------------
  await prisma.notification.create({
    data: {
      userId: admin.id,
      type: "COMPLAINT_NEW",
      title: "New complaint received",
      body: "A student reported a facilities issue that needs review.",
      link: "/admin/complaints",
    },
  });

  console.log("\nSeed complete.");
  console.log(`Demo accounts (password: ${DEMO_PASSWORD}) — clearly fake, local demo only:`);
  console.log(`  Admin   : ${DEMO_ACCOUNTS[0]!.email} / ${DEMO_ACCOUNTS[0]!.loginId}`);
  console.log(`  Faculty : ${DEMO_ACCOUNTS[1]!.email} / ${DEMO_ACCOUNTS[1]!.loginId}  (also fac002..fac006)`);
  console.log(`  Student : ${DEMO_ACCOUNTS[2]!.email} / ${DEMO_ACCOUNTS[2]!.loginId}  (also up to student040)`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
