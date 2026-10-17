# 00 — Project Scope

**Project:** Smart Campus Management System
**Document status:** Baseline v0.1 (draft for owner review)
**Last updated:** 2026-10-17
**Source of truth:** the project context document + the System Architecture / Workflow diagram. If they conflict, see `06-decisions-and-deviations.md`.

> Rule: requirements in this file are never removed, simplified, or have their permissions changed without an explicit discussion and approval recorded in `06-decisions-and-deviations.md`.

---

## 1. Purpose

A centralized, modern, responsive web application that manages college administration, academic activities, student services and smart automation, with separate dashboards for **Admin**, **Faculty** and **Student**.

## 2. Objectives

1. Centralize college administration and academic management.
2. Provide separate Admin, Faculty and Student dashboards.
3. Manage student and faculty information.
4. Manage attendance, marks, assignments, examinations, timetables and notices.
5. Generate timetables automatically; Admin reviews, edits, approves and publishes.
6. Provide academic analytics and reports.
7. Send notifications and reminders.
8. Include an AI college assistant.
9. Provide feedback and complaint management.
10. Manage library books, borrowing and returns.
11. Maintain secure academic records with role-based permissions.
12. Be responsive on desktop, laptop, tablet and mobile browsers.

## 3. Users and roles

| Role | Summary | Access boundary |
|---|---|---|
| **Admin** | Manages and oversees the whole system | Full system access (see permission matrix in `02-security-requirements.md`) |
| **Faculty** | Manages academics for assigned subjects/classes | Only assigned subjects, classes and batches |
| **Student** | Accesses own academic info and campus services | Only own records; cannot modify official attendance or marks |

Only these three roles exist unless the owner adds more (see open question Q4).

## 4. Modules and requirement IDs

Requirement IDs (`M<module>-R<nn>`) are used for traceability in `05-acceptance-criteria.md`. **All items below are REQUIRED** unless marked *(optional)*.

### M01 — Authentication and Access Control
- M01-R01 Secure login and logout.
- M01-R02 Password reset.
- M01-R03 Role-based dashboard routing after login.
- M01-R04 Server-side permission validation on every protected action.
- M01-R05 Secure session management.
- M01-R06 Audit logging of important actions.
- M01-R07 Protection of sensitive academic records.
- M01-R08 Login identifier may be Email / Roll No / ID (from the architecture diagram; see DEV-006).

### M02 — Admin Dashboard
- M02-R01 Student management. · M02-R02 Faculty management.
- M02-R03 Department and course management. · M02-R04 Subject and batch management.
- M02-R05 Classroom management. · M02-R06 Notices and announcements.
- M02-R07 Academic record oversight. · M02-R08 Timetable approval and publishing.
- M02-R09 Examination oversight. · M02-R10 Analytics and reports.
- M02-R11 System settings and user permissions. · M02-R12 Audit log access.

### M03 — Faculty Dashboard
- M03-R01 Assigned classes and subjects. · M03-R02 Faculty timetable.
- M03-R03 Attendance recording and updates. · M03-R04 Marks entry and updates.
- M03-R05 Assignment uploads and deadline management. · M03-R06 Course announcements.
- M03-R07 Assigned examination activities. · M03-R08 Relevant student performance information.

### M04 — Student Dashboard
- M04-R01 Personal attendance and history. · M04-R02 Marks and examination results.
- M04-R03 Academic performance/progress. · M04-R04 Personal timetable and academic calendar.
- M04-R05 Assignments and deadlines. · M04-R06 Notices and announcements.
- M04-R07 Faculty information. · M04-R08 Library catalogue and borrowing info.
- M04-R09 Feedback and complaint submission. · M04-R10 AI college assistant.
- M04-R11 Notifications and reminders.
- M04-R12 Students can never modify official attendance or marks.

### M05 — Smart Timetable Generator (key feature)
Inputs considered: faculty availability, courses/subjects, student batches/class groups, classroom availability and capacity, scheduling constraints, faculty workload, existing timetable assignments.
- M05-R01 Automatically generate a timetable.
- M05-R02 Prevent faculty scheduling conflicts.
- M05-R03 Prevent classroom double-booking.
- M05-R04 Prevent conflicting schedules for the same student batch.
- M05-R05 Respect classroom capacity.
- M05-R06 Minimize unnecessary idle periods where possible.
- M05-R07 Balance faculty workloads where possible.
- M05-R08 Display conflicts and suggestions when no valid schedule can be generated.
- M05-R09 Allow regeneration and manual editing.
- M05-R10 Admin can review and modify the proposed timetable.
- **M05-R11 Admin approval is required before publication. A timetable is NEVER auto-published.**
- M05-R12 Notify affected faculty and students after publication or relevant changes.

### M06 — Attendance Management
- M06-R01 Faculty selects an assigned class and subject.
- M06-R02 Faculty records attendance (Present/Absent).
- M06-R03 System validates and stores attendance.
- M06-R04 Students view their own attendance.
- M06-R05 System calculates attendance percentages.
- M06-R06 System flags attendance below a configurable threshold.
- M06-R07 Alerts to students and authorized faculty.
- M06-R08 Authorized administrators oversee attendance reports.

### M07 — Academic Analytics and Reports
- M07-R01 Attendance trends. · M07-R02 Subject-wise marks and performance.
- M07-R03 Class-level statistics. · M07-R04 Student performance history.
- M07-R05 Identify students who may need academic support.
- M07-R06 Authorized downloadable/exportable reports.
- M07-R07 Individual data access follows role-based permissions.

### M08 — Notifications and Reminders
- M08-R01 Events covered: new notices, assignment deadlines, exam reminders, low-attendance alerts, timetable publication/changes, library due dates.
- M08-R02 In-app notification centre.
- M08-R03 Read / unread status.
- M08-R04 *(optional integration)* Email and SMS.

### M09 — AI College Assistant
- M09-R01 Answers questions on rules/procedures, notices, timetables, assignments/deadlines, exams, library procedures, other approved info.
- M09-R02 Uses authorized, up-to-date college information only.
- M09-R03 Respects role-based access restrictions.
- M09-R04 Never exposes confidential student or faculty records.
- M09-R05 Does not invent answers; acknowledges when verified info is unavailable.
- M09-R06 Directs users to the appropriate college authority when necessary.

### M10 — Feedback and Complaint Management
- M10-R01 Students submit faculty feedback. · M10-R02 Students report campus issues.
- M10-R03 Secure storage. · M10-R04 Authorized admins review.
- M10-R05 Admins respond and update status. · M10-R06 Students track progress.
- M10-R07 Sensitive feedback has suitable access restrictions.

### M11 — Examination Management
- M11-R01 Manage exam schedules and details. · M11-R02 Authorized faculty enter marks.
- M11-R03 Authorized users publish results. · M11-R04 Students see published results only.
- M11-R05 Maintain examination history. · M11-R06 Exam and result notifications.

### M12 — Library Management
- M12-R01 Searchable catalogue. · M12-R02 Availability status.
- M12-R03 Borrowing/issue records. · M12-R04 Return tracking.
- M12-R05 Due dates. · M12-R06 Library record management.
- M12-R07 Due-date reminders. · M12-R08 Appropriate permissions and data validation.

### M13 — Central Database and Security
- M13-R01 Stores: users/roles, student & faculty records, departments/courses/subjects/batches, classrooms/timetables, attendance/marks, assignments/exams/results/notices, notifications, feedback/complaints, library, audit logs.
- M13-R02 Input validation. · M13-R03 Role-based authorization.
- M13-R04 Secure handling of sensitive information. · M13-R05 Audit logging.
- M13-R06 Regular backups. · M13-R07 Integrity constraints and relationships.

## 5. Platform and UI requirements

- Responsive web app for desktop, laptop, tablet and mobile browsers.
- Professional login page; separate Admin/Faculty/Student dashboards; consistent navigation; responsive side navigation / mobile menu.
- Forms, tables, search, filters; dashboard cards and charts where useful.
- Notification centre; validation messages.
- Loading, success, error and empty states.
- Accessible typography and adequate contrast.
- **The application must be functional, not static screens.**

## 6. Required vs future enhancements

| Required (in scope) | Future / optional (NOT assumed to exist) |
|---|---|
| All 13 modules above | Email and SMS delivery (adapter, no provider assumed) |
| In-app notifications | Student file submission for assignments *(pending decision — DEV-001)* |
| Retrieval-based AI assistant with role-scoped data | Library fines and payments |
| Custom timetable solver | OR-Tools / CP-SAT solver upgrade |
| Daily backups | Multi-institution / multi-tenant support |
| | Mobile native app, biometrics, payment gateway |

## 7. Out of scope (unless promoted by the owner)

Fee/payment management, hostel and transport, payroll/HR, placement, native mobile apps, multi-college tenancy, real integrations with any external system the owner has not confirmed.

## 8. Constraints and working rules

- Do not invent credentials, institutional data, or external integrations. Seed data must be clearly fake.
- Do not claim a feature is implemented unless it is implemented **and** tested.
- Keep design, database, backend and frontend consistent.
- Work phase by phase; explain the approach and wait for approval before major architectural decisions or large code generation (see `04-agent-workflow.md`).

## 9. Open questions (must be answered before schema freeze)

| # | Question | Working assumption until answered |
|---|---|---|
| Q1 | Scale (students/faculty/batches)? One college or many? | Single college, demo scale |
| Q2 | Semester or annual model? Credits? Attendance per period or per day? | Semester-based, per period |
| Q3 | Who publishes results? Exam coordinator/HOD role? | Admin publishes |
| Q4 | Additional roles (Librarian, HOD, Super Admin)? | Three roles only |
| Q5 | Can students submit assignment files? | View-only (diagram suggests submit — DEV-001) |
| Q6 | Internal/external marks, grading scale, pass criteria? | Single marks value per exam with max marks |
| Q7 | Is feedback anonymous? Can faculty see aggregates? | Admin-only visibility |
| Q8 | Library fines in scope? | No, due dates and reminders only |
| Q9 | LLM API key/budget available? | Retrieval-only first, LLM later |
| Q10 | Admin-created accounts only, or self-registration? | Admin creates all accounts |
| Q11 | Seed/sample data source? | Generated fake data |
| Q12 | Deadline and team size? | Unknown |

## 10. Glossary

- **Batch:** a cohort/section of students in a course and semester.
- **Subject offering:** subject + batch + faculty + term; the link that defines "who teaches what to whom".
- **Class session:** a dated occurrence of a timetable slot; the unit attendance is recorded against.
- **Published:** visible to end users; for timetables and results this requires an explicit authorized action.
