# 05 — Acceptance Criteria

**Document status:** Baseline v0.1
**Last updated:** 2026-10-17
**How to use:** each criterion maps to a requirement ID from `00-project-scope.md`. Status values: `Not started` · `In progress` · `Implemented (untested)` · `Verified` (implemented **and** tests passing, with evidence). Nothing may be marked `Verified` without test evidence (see `03-testing-and-quality-gates.md`).

Format: **Given** (context) · **When** (action) · **Then** (expected result).

Current status of all criteria below: **Not started** (planning phase only; nothing implemented).

---

## M01 — Authentication and Access Control

| ID | Criterion | Req | Status |
|---|---|---|---|
| AC-M01-01 | Given a valid user, when they submit correct credentials (Email / Roll No / ID + password), then they are logged in and routed to the dashboard matching their role. | R01, R03, R08 | Not started |
| AC-M01-02 | Given invalid credentials, when login is submitted, then a generic error is shown, no session is created, and the user can retry. | R01 | Not started |
| AC-M01-03 | Given repeated failed logins, when the limit is exceeded, then further attempts are throttled/locked temporarily and the event is audit-logged. | R01, R06 | Not started |
| AC-M01-04 | Given a logged-in user, when they log out, then the session is invalidated server-side and protected pages are no longer accessible. | R01, R05 | Not started |
| AC-M01-05 | Given a registered user, when they request a password reset, then a single-use, time-limited link is issued; the response is identical for unknown accounts; after reset old sessions are revoked. | R02 | Not started |
| AC-M01-06 | Given a Student, when they request an Admin or Faculty route/API, then access is denied (403) and nothing sensitive is returned. | R04, R07 | Not started |
| AC-M01-07 | Given an unauthenticated visitor, when they open any protected route, then they are redirected to login. | R04 | Not started |
| AC-M01-08 | Given an idle session beyond the configured timeout, when the user acts, then re-authentication is required. | R05 | Not started |
| AC-M01-09 | Given any important action (login, role change, marks change, publish, etc.), then an audit entry with actor, action, entity, time and result is stored. | R06 | Not started |

## M02 — Admin Dashboard

| ID | Criterion | Req | Status |
|---|---|---|---|
| AC-M02-01 | Given Admin, when they create/update/deactivate a student or faculty account with valid data, then it is saved, validated (unique ID/email) and audit-logged; invalid data shows field errors. | R01, R02 | Not started |
| AC-M02-02 | Given Admin, when they manage departments, courses, subjects, batches and classrooms, then relationships are enforced (e.g. cannot delete a course with active batches). | R03–R05 | Not started |
| AC-M02-03 | Given Admin, when they publish a notice for a chosen audience, then the intended users see it and receive a notification. | R06 | Not started |
| AC-M02-04 | Given Admin, when they open academic records, attendance, marks or exam views, then they can view data across the institution (authorized scope). | R07, R09 | Not started |
| AC-M02-05 | Given Admin, when they change a user's role/permissions or system settings, then the change takes effect and is audit-logged. | R11 | Not started |
| AC-M02-06 | Given Admin, when they open the audit log, then they can filter by actor, action, date; Faculty and Student cannot access it. | R12 | Not started |

## M03 — Faculty Dashboard

| ID | Criterion | Req | Status |
|---|---|---|---|
| AC-M03-01 | Given Faculty, when they open their dashboard, then only their assigned subjects, classes and timetable are shown. | R01, R02 | Not started |
| AC-M03-02 | Given Faculty, when they try to record attendance or marks for a class not assigned to them, then the request is rejected and logged. | R03, R04 | Not started |
| AC-M03-03 | Given Faculty, when they upload an assignment with title, description and a deadline, then it is stored and visible to the target batch. | R05 | Not started |
| AC-M03-04 | Given Faculty, when they post a course announcement, then students of that course see it. | R06 | Not started |
| AC-M03-05 | Given Faculty, when they view student performance, then only students in their assigned classes appear. | R08 | Not started |

## M04 — Student Dashboard

| ID | Criterion | Req | Status |
|---|---|---|---|
| AC-M04-01 | Given Student, when they open attendance, then they see only their own percentage per subject and history. | R01 | Not started |
| AC-M04-02 | Given Student, when results are published, then they see their own marks/results; unpublished results are not visible. | R02 | Not started |
| AC-M04-03 | Given Student, when they open the timetable, then they see their batch's **published** timetable and the academic calendar. | R04 | Not started |
| AC-M04-04 | Given Student, when they open assignments, then deadlines are listed and sorted with status. | R05 | Not started |
| AC-M04-05 | Given Student, when they inspect network requests/API, then no endpoint allows them to create or modify attendance or marks. | R12 | Not started |
| AC-M04-06 | Given Student, when they view faculty information, then only non-confidential fields (name, department, subjects, contact as configured) are shown. | R07 | Not started |

## M05 — Smart Timetable Generator

| ID | Criterion | Req | Status |
|---|---|---|---|
| AC-M05-01 | Given valid inputs (offerings, availability, rooms, constraints), when Admin runs generation, then a draft timetable is produced and stored as `GENERATED`. | R01 | Not started |
| AC-M05-02 | Given any generated or edited timetable, then no faculty is assigned to two places in the same period. | R02 | Not started |
| AC-M05-03 | Given any generated or edited timetable, then no classroom is booked twice in the same period. | R03 | Not started |
| AC-M05-04 | Given any generated or edited timetable, then no batch has two sessions in the same period. | R04 | Not started |
| AC-M05-05 | Given room capacity and batch size, then every session is placed in a room whose capacity ≥ batch size (and of the right type for labs). | R05 | Not started |
| AC-M05-06 | Given the same inputs, then the solver's idle-gap and workload-balance scores are no worse than a naive baseline on the test fixtures. | R06, R07 | Not started |
| AC-M05-07 | Given infeasible inputs (e.g. faculty hours exceed availability), when generation runs, then conflicts are listed with causes and actionable suggestions, and no invalid timetable is produced. | R08 | Not started |
| AC-M05-08 | Given a draft, when Admin regenerates or manually edits a slot, then the result is re-validated; edits that create a conflict are blocked or clearly flagged. | R09, R10 | Not started |
| AC-M05-09 | Given a timetable not yet `APPROVED` by an Admin, when anyone (including Admin via API) attempts to publish it, then the request fails. | R11 | Not started |
| AC-M05-10 | Given the generator finishes, then the timetable remains unpublished until Admin explicitly approves and publishes (never automatic). | R11 | Not started |
| AC-M05-11 | Given Admin approves and publishes, then affected faculty and students receive notifications and see the new timetable; unaffected users do not. | R12 | Not started |
| AC-M05-12 | Given a published timetable is changed, then a new version is created, previous version archived, and affected users notified. | R12 | Not started |

## M06 — Attendance Management

| ID | Criterion | Req | Status |
|---|---|---|---|
| AC-M06-01 | Given Faculty, when they open attendance, then only their assigned class/subject sessions can be selected. | R01 | Not started |
| AC-M06-02 | Given a selected session, when Faculty submits Present/Absent for each student, then records are validated and stored once per student per session. | R02, R03 | Not started |
| AC-M06-03 | Given attendance was already recorded, when Faculty edits it, then the change is saved and audit-logged with before/after. | R03 | Not started |
| AC-M06-04 | Given recorded sessions, then attendance percentage = attended ÷ total sessions per subject and overall, displayed correctly (including 0-session edge case). | R05 | Not started |
| AC-M06-05 | Given a threshold configured by Admin (e.g. 75 %), when a student's percentage falls below it, then the student is flagged and one alert is sent to the student and authorized faculty. | R06, R07 | Not started |
| AC-M06-06 | Given Admin, when they open attendance reports, then they can filter by department/batch/subject/date and export. | R08 | Not started |

## M07 — Academic Analytics and Reports

| ID | Criterion | Req | Status |
|---|---|---|---|
| AC-M07-01 | Given recorded data, then attendance trend charts display by period and class. | R01 | Not started |
| AC-M07-02 | Given marks data, then subject-wise performance and class-level statistics (average, highest, lowest, pass rate) are accurate. | R02, R03 | Not started |
| AC-M07-03 | Given a student, then performance history across terms is shown to authorized viewers. | R04 | Not started |
| AC-M07-04 | Given attendance/marks rules, then students needing academic support are listed with the reason. | R05 | Not started |
| AC-M07-05 | Given an authorized user, when they export a report, then the file contains only data within their permission and the export is audit-logged. | R06, R07 | Not started |

## M08 — Notifications and Reminders

| ID | Criterion | Req | Status |
|---|---|---|---|
| AC-M08-01 | Given each event type (notice, assignment deadline, exam reminder, low attendance, timetable publish/change, library due date), then the correct recipients get an in-app notification. | R01 | Not started |
| AC-M08-02 | Given notifications, then the notification centre lists them newest-first with unread count; opening/marking sets them to read. | R02, R03 | Not started |
| AC-M08-03 | Given scheduled reminders, then each fires once only (no duplicates) and not for completed or cancelled items. | R01 | Not started |
| AC-M08-04 | Given email/SMS is not configured, then the system works fully with in-app notifications and shows no error. (Email/SMS is optional.) | R04 | Not started |

## M09 — AI College Assistant

| ID | Criterion | Req | Status |
|---|---|---|---|
| AC-M09-01 | Given a question covered by approved documents, then the assistant answers using that information and cites the source. | R01, R02 | Not started |
| AC-M09-02 | Given a Student asks for their own timetable/assignments/deadlines, then the assistant answers from their own data. | R01, R03 | Not started |
| AC-M09-03 | Given a user asks for another person's marks, attendance, complaints or personal details, then the assistant refuses and explains it cannot share confidential records. | R03, R04 | Not started |
| AC-M09-04 | Given no verified information exists, then the assistant says so and refers to the appropriate authority/office rather than guessing. | R05, R06 | Not started |
| AC-M09-05 | Given prompt-injection attempts ("ignore your rules…"), then permissions and rules are still enforced. | R03, R04 | Not started |
| AC-M09-06 | Given an unapproved/draft document, then it is never used as a source. | R02 | Not started |

## M10 — Feedback and Complaint Management

| ID | Criterion | Req | Status |
|---|---|---|---|
| AC-M10-01 | Given Student, when they submit faculty feedback or a campus complaint with valid data, then it is stored securely and a confirmation + tracking reference is shown. | R01–R03 | Not started |
| AC-M10-02 | Given a new submission, then Admin is notified and can review it. | R04 | Not started |
| AC-M10-03 | Given Admin, when they respond and change status (e.g. Submitted → In review → Resolved/Rejected), then the student sees the response and status. | R05, R06 | Not started |
| AC-M10-04 | Given another student or a faculty member, when they request someone else's complaint/feedback, then access is denied. | R07 | Not started |

## M11 — Examination Management

| ID | Criterion | Req | Status |
|---|---|---|---|
| AC-M11-01 | Given an authorized user, when they create an exam schedule (date, time, room, subject, batch), then it is saved without room/batch/invigilator clashes. | R01 | Not started |
| AC-M11-02 | Given Faculty for that subject, when they enter marks within 0–max, then they are stored; out-of-range or unauthorized entries are rejected. | R02 | Not started |
| AC-M11-03 | Given an authorized user, when they publish results, then results become visible to students and notifications are sent; before that they are hidden. | R03, R04, R06 | Not started |
| AC-M11-04 | Given a student, then their examination history across terms is retained and viewable. | R05 | Not started |

## M12 — Library Management

| ID | Criterion | Req | Status |
|---|---|---|---|
| AC-M12-01 | Given the catalogue, when a user searches by title/author/ISBN/category, then matching books with availability are shown. | R01, R02 | Not started |
| AC-M12-02 | Given an available copy, when an authorized borrowing action is recorded, then a borrow record with due date is created and availability decreases. | R03, R05 | Not started |
| AC-M12-03 | Given an unavailable copy, when issue is attempted, then it is rejected with a clear message. | R02, R08 | Not started |
| AC-M12-04 | Given an issued book, when the return is recorded, then the record closes and availability increases. | R04 | Not started |
| AC-M12-05 | Given approaching or past due dates, then the borrower receives reminders; overdue items are identifiable. | R05, R07 | Not started |
| AC-M12-06 | Given a student, then they see only their own borrowing records; only authorized users manage library records. | R06, R08 | Not started |

## M13 — Central Database and Security

| ID | Criterion | Req | Status |
|---|---|---|---|
| AC-M13-01 | Given the schema, then all entities in M13-R01 exist with foreign keys and constraints. | R01, R07 | Not started |
| AC-M13-02 | Given invalid input (wrong type, length, range, injection payload), then the server rejects it with a safe error and no data change. | R02 | Not started |
| AC-M13-03 | Given the permission matrix in `02`, then automated tests confirm every allowed and denied action per role. | R03 | Not started |
| AC-M13-04 | Given a backup, when restored to a clean environment, then data and relationships are intact (drill performed and recorded). | R06 | Not started |
| AC-M13-05 | Given attempts to create duplicate attendance, double-booked slots, out-of-range marks or orphan rows, then the database itself rejects them. | R07 | Not started |

## Cross-cutting UI acceptance

| ID | Criterion | Status |
|---|---|---|
| AC-UI-01 | Every main page is usable without horizontal scrolling at 360, 768, 1024 and 1440 px; navigation collapses to a mobile menu on small screens. | Not started |
| AC-UI-02 | Every data view and form has loading, empty, success and error states. | Not started |
| AC-UI-03 | Text contrast ≥ 4.5:1, visible keyboard focus, form errors linked to fields. | Not started |
| AC-UI-04 | Application is functional end-to-end with real stored data, not static screens. | Not started |
| AC-UI-05 | Login page, three role dashboards, consistent navigation and notification centre all exist. | Not started |

## Workflow acceptance (end-to-end)

| Workflow | Passing condition | Status |
|---|---|---|
| A — Authentication | AC-M01-01, 02, 06, 07 pass in e2e for all roles | Not started |
| B — Timetable | AC-M05-01…12 pass in e2e | Not started |
| C — Attendance & Marks | AC-M06-01…05, AC-M11-02, AC-M04-01/05 pass | Not started |
| D — Assignments & Exams | AC-M03-03, AC-M04-04, AC-M11-01…03 pass | Not started |
| E — Library | AC-M12-01…05 pass | Not started |
| F — Feedback & Complaints | AC-M10-01…04 pass | Not started |
| G — AI Assistant | AC-M09-01…06 pass | Not started |
