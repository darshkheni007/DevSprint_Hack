# 01 — Architecture

**Document status:** Proposed v0.1 — pending owner approval (see `06-decisions-and-deviations.md`, D-001 to D-009)
**Last updated:** 2026-10-17

## 1. Architectural style

**Modular monolith** (single deployable app, strict internal module boundaries). Reason: college-scale project, one developer/small team, relational data, need for transactional integrity. Microservices would add operational cost with no benefit.

## 2. High-level diagram

```
                Browser (responsive: desktop / laptop / tablet / mobile)
                      Admin UI    Faculty UI    Student UI
                                │  HTTPS
┌───────────────────────────────┴──────────────────────────────────────┐
│ Next.js application (TypeScript)                                     │
│                                                                      │
│  UI layer ── role layouts, forms, tables, charts, notification centre│
│                                                                      │
│  API layer (route handlers / server actions)                         │
│    1. Authenticate session                                           │
│    2. Authorize (role + ownership/assignment scope)                  │
│    3. Validate input (Zod)                                           │
│    4. Call domain service                                            │
│    5. Write audit log + notification (same transaction)              │
│                                                                      │
│  Domain services                                                     │
│   identity · academic-structure · attendance · marks-exams           │
│   assignments · notices · timetable-engine · notifications           │
│   library · feedback-complaints · analytics · ai-assistant           │
│                                                                      │
│  Data access (Prisma)                                                │
└───────┬─────────────────────┬──────────────────────┬─────────────────┘
        │                     │                      │
  PostgreSQL            File storage          Background jobs
  (+ pgvector)          (assignment files)    (reminders, low-attendance
  Central Database                             scan, due-date alerts)
        │
   Backups + audit trail

 External services (all optional / adapter-based, not assumed to exist):
   Email (SMTP) · SMS · LLM API (authorized data only)
```

This matches the "System Architecture" diagram: Login/Auth (RBAC) → Admin / Faculty / Student → Core Services → Central Database, with Security and Backup alongside, and External Services (Email, SMS optional, AI language model fed only authorized data).

## 3. Technology stack (proposed)

| Layer | Choice | Rationale | Alternatives considered |
|---|---|---|---|
| Frontend + backend | Next.js + TypeScript | Single codebase, typed, responsive UI | React + Express (two apps), Django |
| Database | PostgreSQL | Relational integrity, constraints, pgvector | MySQL, MongoDB (poor fit) |
| ORM | Prisma | Typed schema + migrations | Drizzle |
| Auth | Auth.js (credentials) + argon2, httpOnly cookies | Avoid hand-rolled crypto | Custom JWT |
| Validation | Zod | Shared client/server schemas | Yup |
| UI | Tailwind CSS + shadcn/ui, Recharts | Accessible, responsive | MUI |
| Timetable | Custom TypeScript constraint solver | Explainable, college-scale | OR-Tools CP-SAT (future) |
| Jobs | node-cron or pg-boss | Reminders, scans | — |
| AI assistant | RAG over approved docs (pgvector) + role-scoped query tools + LLM API | Grounded, permission-aware | Fine-tuning (rejected) |
| Testing | Vitest, Playwright, axe-core | See `03-testing-and-quality-gates.md` | Jest, Cypress |
| Hosting | Docker Compose / Vercel+Render + managed Postgres | Simple demo deploy | — |

## 4. Module relationships

| Module | Depends on | Feeds |
|---|---|---|
| Academic structure (dept, course, subject, batch, classroom) | — | Everything |
| Identity & RBAC | — | Everything |
| Timetable engine | Academic structure, faculty availability, offerings | Attendance (class sessions), Notifications, Student/Faculty views |
| Attendance | Timetable / class sessions, enrolment | Analytics, Notifications (low-attendance) |
| Marks & Exams | Offerings, exam schedule | Results, Analytics, Notifications |
| Assignments | Offerings | Notifications, student views |
| Notices | Academic structure | Notifications, AI assistant knowledge base |
| Library | Users | Notifications (due dates), AI assistant (procedures) |
| Feedback & Complaints | Users, faculty | Admin review, Notifications |
| Analytics | Attendance, Marks | Dashboards, exports |
| Notifications | All event sources | In-app centre, optional email/SMS |
| AI assistant | Approved documents, role-scoped data | Users |

Rule: modules talk to each other through service interfaces, never by reaching into another module's tables directly (except read-only reporting views).

## 5. Core data model (summary)

Full schema is produced in Phase 2. Entities:

- **Identity:** User, StudentProfile, FacultyProfile, AdminProfile, Session, PasswordResetToken, AuditLog, SystemSetting
- **Academic structure:** AcademicTerm, Department, Course, Batch, Subject, SubjectOffering, Classroom, Enrolment
- **Timetable:** Period, FacultyAvailability, SchedulingConstraint, TimetableVersion, TimetableSlot
- **Attendance:** ClassSession, AttendanceRecord
- **Assessment:** Assignment, (AssignmentSubmission — pending DEV-001), Exam, ExamSchedule, MarkEntry, Result
- **Communication:** Notice, Notification
- **Library:** Book, BookCopy, BorrowRecord
- **Feedback:** Feedback, Complaint, ComplaintResponse
- **AI:** KnowledgeDocument, DocumentChunk, AssistantQueryLog

Database-level integrity rules (must be enforced by constraints, not only code):
- Unique `(timetable_version, faculty, day, period)`, `(…, classroom, day, period)`, `(…, batch, day, period)`.
- Unique `(class_session, student)` for attendance.
- Marks check: `0 <= marks <= max_marks`.
- A book copy cannot have two open borrow records.
- Foreign keys everywhere; no orphan rows; soft-delete for academic records.

## 6. Key flows

### 6.1 Authentication (Workflow A)
Open site → enter credentials (Email / Roll No / ID + password) → validate → on failure show error and allow retry (rate-limited) → identify role → route to Admin / Faculty / Student dashboard. Every later request re-checks session and permission server-side.

### 6.2 Timetable generation (Workflow B)
Admin enters inputs/constraints → solver generates → conflict check. Conflicts: show conflicts + suggestions, loop back to adjust/regenerate. No conflicts: Admin reviews/edits (re-validated on each edit) → **Admin approves** → publish → notify faculty and students.

State machine: `DRAFT → GENERATED → IN_REVIEW → APPROVED → PUBLISHED → ARCHIVED`. Only `APPROVED` can move to `PUBLISHED`, and only by an Admin. Post-publish edits create a new version and notify affected users.

Solver outline:
1. Build tasks (offering × weekly sessions; lab blocks).
2. Order hardest first (fewest feasible slots, labs, large batches).
3. Place with backtracking under hard constraints.
4. Improve with local search (swap moves) scored on soft constraints (idle gaps, workload balance, spread across days).
5. If infeasible, return structured diagnostics (e.g. faculty hours vs availability, no room with enough capacity) with suggestions.

### 6.3 Attendance and marks (Workflow C)
Faculty selects assigned class/subject → records attendance or marks → validation (assignment scope, ranges, duplicates) → transactional save → analytics refresh → low-attendance check → notification to student (and authorized faculty). Student views only.

### 6.4 Assignments and exams (Workflow D)
Faculty creates assignment with deadline → stored → students notified → students view. Exams: authorized users create schedule → faculty enter marks → authorized user publishes results → students view published results → notifications. (Student submission and faculty review per the diagram: pending DEV-001.)

### 6.5 Library (Workflow E)
Student searches → availability check → status shown. Issue/return by authorized staff (pending DEV-002) updates records; due-date reminders generated by scheduled job.

### 6.6 Feedback and complaints (Workflow F)
Student submits → stored securely and Admin notified → Admin reviews → responds / takes action → updates status → student tracks status.

### 6.7 AI assistant (Workflow G)
Question → resolve user role/identity → classify intent → retrieve only (a) approved knowledge documents and (b) role-scoped data via whitelisted query functions → compose answer from retrieved data only → if nothing found, say so and name the right authority → log query. The LLM never gets direct database access.

## 7. Notification processing

- Event produced inside the same DB transaction as the business change (outbox pattern).
- Worker fans out to in-app `Notification` rows; optional channel adapters (email/SMS) behind an interface, disabled by default.
- Scheduled jobs: assignment deadline reminders, exam reminders, library due-date reminders, low-attendance scan (configurable threshold).
- Idempotency key per (event, user) to avoid duplicates.

## 8. API conventions

- REST-style route handlers under `/api/v1/...`; JSON; consistent error shape `{ code, message, fieldErrors? }`.
- Every handler: authenticate → authorize → validate (Zod) → service → audit.
- Pagination, filtering and sorting on all list endpoints.
- Idempotent writes where retries are possible (attendance, notification fan-out).

## 9. Non-functional requirements

| Area | Target (proposed, to be confirmed) |
|---|---|
| Responsiveness | Works at 360px, 768px, 1024px, 1440px widths |
| Accessibility | WCAG 2.1 AA contrast and keyboard navigation |
| Performance | Typical page interactive < 3 s on broadband; timetable generation for demo-scale data < 60 s |
| Availability | Single instance acceptable for college project; daily backup |
| Maintainability | TypeScript strict mode, linting, module boundaries, documented ADRs |
| Observability | Structured logs, error tracking, audit log |

## 10. Deployment (outline — finalised in Phase 9)

Environments: local (Docker Compose), staging, production demo. Config via environment variables; no secrets in the repo. Automated DB migrations; daily backup with a tested restore procedure.
