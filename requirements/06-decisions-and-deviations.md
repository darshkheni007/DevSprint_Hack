# 06 — Decisions and Deviations

**Document status:** Living log
**Last updated:** 2026-10-17

Purpose: a single record of (a) architecture/technology decisions, (b) places where the architecture diagram and the written specification disagree or add detail, and (c) open questions. **Nothing here changes a requirement or permission until the owner marks it `Approved`.**

Status values: `Proposed` · `Approved` · `Rejected` · `Superseded` · `Open` (needs owner decision).

---

## Part A — Architecture decisions

| ID | Decision | Rationale | Alternatives | Status |
|---|---|---|---|---|
| D-001 | Modular monolith architecture | Right size for a college project; simpler to build, test and deploy | Microservices | Proposed |
| D-002 | Next.js + TypeScript for UI and API | One codebase, typed, responsive | React+Express, Django | Proposed |
| D-003 | PostgreSQL as central database | Relational integrity, constraints, pgvector support | MySQL, MongoDB | Proposed |
| D-004 | Prisma ORM with migrations | Typed schema, readable migrations | Drizzle | Proposed |
| D-005 | Auth.js credentials + argon2 + httpOnly cookies | Avoid hand-rolled auth | Custom JWT | Proposed |
| D-006 | Custom TypeScript timetable solver (greedy + backtracking + local search) | Explainable; sufficient for college scale | OR-Tools CP-SAT (future upgrade) | Proposed |
| D-007 | AI assistant via RAG + role-scoped tool functions; LLM has no direct DB access | Grounded, permission-safe, no fabrication | Fine-tuning | Proposed |
| D-008 | In-app notifications as required baseline; email/SMS via optional adapters | Spec says optional; no provider assumed | Build email/SMS now | Proposed |
| D-009 | Timetable state machine with DB-level guard so only `APPROVED` → `PUBLISHED` by Admin | Enforces "never auto-publish" rule | App-level check only | Proposed |
| D-010 | Soft delete for academic records; append-only audit log | Data integrity and traceability | Hard delete | Proposed |

> The stack (D-002…D-005) has been proposed but **not yet explicitly approved**. Work on Phase 2+ should wait for owner approval, or the owner should state a required alternative (e.g. Java/Python mandated by the college).

---

## Part B — Differences between the architecture diagram and the written spec

The diagram was compared against the project context document. Each row below needs an owner decision. Until decided, the **written spec behaviour is used** (the more restrictive one) and the diagram item is held as pending.

| ID | Diagram says | Written spec says | Impact | Recommended default | Status |
|---|---|---|---|---|---|
| DEV-001 | Student: "View/Submit Assignments"; Workflow D: "Students View & Submit → Faculty Review → Marks (Optional)" | Student: "View assignments, deadlines" only; Faculty uploads assignments | Adds file submission, review/grading flow, storage, and an `AssignmentSubmission` entity; changes permission matrix for Student (create own submission) and Faculty (review) | Include submission as a **Phase 5 sub-feature** (students submit own files before deadline; cannot alter marks; faculty review). Marks optional per diagram | Open |
| DEV-002 | Student: "Search & Borrow Library Books" | Workflow E: "Authorized borrowing and return processes update the record"; Student can search and view borrowing info | Decides who performs issue/return: student self-service request vs library staff/Admin | Student **searches and requests/reserves**; issue and return recorded by authorized staff/Admin | Open |
| DEV-003 | Faculty: "Manage Exam Information"; Workflow D: "Admin/Faculty Create Exam Schedule" | Admin oversees examinations; Faculty "access assigned examination information"; "authorized users create schedules" | Whether Faculty can create/edit exam schedules, or only view and enter marks | Admin creates schedules; Faculty views assigned exams and enters marks. Faculty creation only if owner approves | Open |
| DEV-004 | Faculty: "Interact with Students" | Not mentioned | Undefined feature: could be messaging, Q&A, or course announcements/comments | Treat as **course announcements and assignment comments**; no free-form direct messaging unless the owner requests it | Open |
| DEV-005 | Faculty: "Publish Course Announcements"; Admin: "Upload Notices & Announcements" | "Manage course announcements" (Faculty); notices (Admin) | Consistent; confirms Faculty can publish course-level notices to their classes | Faculty notices limited to their courses/batches | Proposed |
| DEV-006 | Login box shows "Email / Roll No / ID" | Spec says secure login only | Multi-identifier login needs unique, normalised identifiers and safe lookup | Support Email or institutional ID/Roll No with uniqueness constraints | Proposed |
| DEV-007 | Workflow F: "System Stores & Notifies Admin" | Spec: system stores securely; Admin reviews | Adds an Admin notification on new complaint/feedback | Add the notification (low impact) | Proposed |
| DEV-008 | External Services lists "Email Notifications" as a service and "SMS Alerts (Optional)" | Email and SMS both optional integrations | Whether email is required or optional | Email and SMS both optional adapters; in-app notifications always work | Open |
| DEV-009 | Workflow C: "Marks (Optional)" appears in Workflow D, "Mark Attendance (Present/Absent)" in C | Attendance records Present/Absent implied | Whether other statuses (Late, Excused/Leave) are needed | Present/Absent only for v1; extensible enum | Proposed |
| DEV-010 | Admin: "Manage Exam Schedules & Results" | Admin oversees exams and results; "authorized users publish results" | Confirms Admin can manage results; who else may publish is undefined (see Q3) | Admin publishes results | Proposed |

---

## Part C — Open questions (from `00-project-scope.md` §9)

| # | Question | Needed by | Working assumption | Status |
|---|---|---|---|---|
| Q1 | Scale; single college or multi-institution? | Phase 2 | Single college, demo scale | Open |
| Q2 | Semester vs annual; credit system; per-period vs per-day attendance | Phase 2 | Semester, per-period | Open |
| Q3 | Who publishes results; any HOD/exam-coordinator role? | Phase 2 | Admin | Open |
| Q4 | Additional roles (Librarian, HOD, Super Admin)? | Phase 2 | Three roles only | Open |
| Q5 | Student assignment submission (see DEV-001) | Phase 2 | View-only until decided | Open |
| Q6 | Marking scheme: internal/external, grading scale, pass criteria | Phase 2 | Single marks value with max marks | Open |
| Q7 | Feedback anonymity; faculty access to aggregates | Phase 2 | Admin-only | Open |
| Q8 | Library fines in scope? | Phase 7 | No | Open |
| Q9 | LLM API key/budget for assistant | Phase 7 | Retrieval-only first | Open |
| Q10 | Admin-created accounts only vs self-registration with approval | Phase 4 | Admin creates all | Open |
| Q11 | Source of demo/seed data | Phase 2 | Generated fake data | Open |
| Q12 | Deadline and team size | Phase 1 | Unknown | Open |
| Q13 | Can Faculty edit their own availability, or only Admin? | Phase 6 | Admin enters; faculty may request changes | Open |
| Q14 | Is field-level encryption required for complaints/feedback? | Phase 2 | Provider-level encryption at rest; field-level if the owner requires | Open |

---

## Part D — Change log for this document

| Date | Change | By |
|---|---|---|
| 2026-10-17 | Created. Added decisions D-001…D-010, diagram-vs-spec deviations DEV-001…DEV-010, open questions Q1…Q14. | Agent (draft for owner review) |

### Entry template for new decisions

```
### D-0xx — <title>
- Date:
- Context / problem:
- Options considered:
- Decision:
- Consequences (requirements, permissions, schema, tests affected):
- Owner approval: <name, date>
- Status:
```
