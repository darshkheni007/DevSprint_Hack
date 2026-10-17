# 03 — Testing and Quality Gates

**Document status:** Baseline v0.1 (numeric targets are proposals, to be confirmed by the owner)
**Last updated:** 2026-10-17

> A feature is only "done" when it is implemented **and** tested against its acceptance criteria in `05-acceptance-criteria.md`. Nothing is reported as implemented without passing evidence.

## 1. Test strategy

| Level | Purpose | Proposed tooling | Scope |
|---|---|---|---|
| Static analysis | Catch errors early | TypeScript strict, ESLint, Prettier | All code |
| Unit tests | Logic in isolation | Vitest | Validators, permission policy, attendance %, timetable solver pieces, notification rules |
| Integration tests | Services + real database | Vitest + test PostgreSQL (containerised) | Repositories, constraints, transactions, API handlers |
| End-to-end tests | Real user workflows | Playwright | Workflows A–G for each role |
| Security tests | Access control, injection, session | Playwright/API tests, dependency scanner | Permission matrix, IDOR, CSRF, rate limits |
| Accessibility tests | Contrast, keyboard, labels | axe-core + manual checks | All main pages |
| Responsive tests | Layout at breakpoints | Playwright viewports | 360, 768, 1024, 1440 px |
| Performance checks | Basic speed/regression | Lighthouse, solver timing | Key pages, timetable generation |

Test data: deterministic, clearly fake seed data. Tests create and clean up their own data.

## 2. Critical test suites (must exist and pass)

### 2.1 Permission matrix suite (highest priority)
For **every** endpoint and every role (Admin, Faculty, Student, unauthenticated) assert allowed/denied exactly as in `02-security-requirements.md` §2. Include:
- Student attempting to write attendance/marks (must fail; no route exists).
- Faculty accessing another faculty's class (must fail).
- Student accessing another student's attendance/marks/complaint by changing the ID (must fail).
- Student reading unpublished results or unpublished timetables (must fail).
- Faculty/Student calling Admin endpoints (must fail).

### 2.2 Timetable suite
- Hard constraints: no faculty clash, no classroom clash, no batch clash, capacity respected, faculty availability respected — verified on randomised and fixed fixtures (property-based tests).
- Infeasible input returns structured conflicts + suggestions, never a silent invalid schedule.
- Regeneration produces a valid schedule; manual edits that create a conflict are rejected or flagged.
- State machine: `PUBLISHED` unreachable without Admin + `APPROVED` (API test, service test and DB-level check).
- Publish triggers notifications only for affected faculty/students.
- Soft-constraint scoring: idle gaps and workload balance improve (or do not worsen) versus a naive baseline on fixtures.

### 2.3 Attendance and marks suite
- Percentage calculation correctness (including zero sessions, excused/late if added).
- Threshold is configurable; crossing it creates exactly one alert (no duplicates).
- Duplicate attendance for the same session/student rejected.
- Marks range validation; update leaves an audit entry with before/after.
- Student sees own data only.

### 2.4 Notifications suite
- Each event type creates the right notification for the right recipients.
- Read/unread status updates; unread counts correct.
- Scheduled reminders fire once (idempotent) and not for completed/cancelled items.

### 2.5 AI assistant suite
- Answers questions from approved documents with source references.
- Refuses/redirects when information is unavailable (no fabrication).
- Cannot return another user's confidential data (red-team prompts, prompt-injection cases).
- Role-scoped answers differ correctly for Admin/Faculty/Student.

### 2.6 Library, feedback, exam suites
- Cannot issue an unavailable copy; return updates availability; overdue detection correct.
- Complaint lifecycle and visibility rules; student can track only own complaints.
- Results hidden until published; publish notifies students; exam history retained.

### 2.7 Data integrity suite
- DB constraints reject: duplicate attendance, double-booked slots, out-of-range marks, orphan records.
- Migrations apply cleanly forward on an empty DB and on seeded DB.
- Backup → restore drill reproduces data.

## 3. Quality gates

### 3.1 Gate per pull request / change
- [ ] Type-check, lint and format pass with zero errors.
- [ ] Unit and integration tests pass; new logic has tests.
- [ ] No new high/critical dependency vulnerabilities; no secrets detected.
- [ ] Permission tests updated if any endpoint or role rule changed.
- [ ] Audit logging added for any new important action.
- [ ] Docs updated (`05`, `06`, `07` where relevant).

### 3.2 Gate per phase (see roadmap in `04-agent-workflow.md`)
| Phase | Exit criteria |
|---|---|
| 1 Requirements & architecture | Owner approves docs 00–02; open questions answered or assumptions recorded |
| 2 Database & permissions | Schema migrates; constraints verified by tests; permission matrix signed off; ER diagram reviewed |
| 3 UI & project setup | App runs; role layouts and responsive navigation verified at all breakpoints; CI running |
| 4 Auth & dashboards | Workflow A passes e2e for all roles; reset flow works; security suite 2.1 for auth endpoints passes |
| 5 Core academic modules | Workflows C and D pass e2e; suites 2.1, 2.3 pass |
| 6 Timetable | Workflow B passes e2e; suite 2.2 passes; never-auto-publish verified |
| 7 Supporting modules | Workflows E, F, G pass e2e; suites 2.4–2.6 pass |
| 8 Testing & security | Full regression green; security checklist (§7) complete; accessibility + responsive reports attached |
| 9 Deployment & docs | Deploy from scratch using the docs only; backup/restore drill done; README and user guide reviewed |

### 3.3 Proposed numeric targets (confirm with owner)
- Line coverage ≥ 80 % for services, permission policy and solver; 100 % of permission-matrix cells covered.
- 0 critical / high security findings open at release.
- Accessibility: 0 critical axe violations on main pages; text contrast ≥ 4.5:1.
- Lighthouse performance and accessibility ≥ 85 on key pages (desktop).
- Timetable generation at demo-scale data completes within 60 s.

## 4. Responsive and UI-state checks

For each main page (login, 3 dashboards, attendance, marks, timetable, notices, library, complaints, assistant, notification centre):
- Renders without horizontal scrolling at 360, 768, 1024, 1440 px.
- Side navigation collapses to a mobile menu on small screens.
- Tables degrade gracefully (scroll, stacked cards, or column priority).
- Loading, empty, success and error states exist and are tested.
- Form validation messages are specific and associated with fields (ARIA).
- Keyboard navigation and visible focus work; colour is not the only indicator.

## 5. End-to-end scenarios (one per workflow)

| Workflow | Scenario |
|---|---|
| A | Valid login per role routes to correct dashboard; invalid login shows error and allows retry; logout ends session; password reset works once |
| B | Admin enters constraints → generate → conflict shown → adjust → regenerate → review/edit → approve → publish → faculty/student notified; attempt to publish unapproved fails |
| C | Faculty marks attendance and enters marks → saved → student sees own values → low-attendance alert generated; student cannot edit |
| D | Faculty creates assignment with deadline → students notified and see it; exam schedule → marks → publish → students see results |
| E | Student searches book → status shown; staff issue → due date set → reminder generated → return updates availability |
| F | Student submits complaint → Admin notified → Admin responds and changes status → student sees progress |
| G | Student asks about timetable (answered from own data), about a rule (from approved doc), about another student's marks (refused), about unknown topic (acknowledged + referral) |

## 6. Reporting evidence

Each phase completion must include: test run summary, coverage report, e2e results with screenshots/videos for failures, security checklist result, list of known issues, and links to the updated criteria rows in `05-acceptance-criteria.md`. "Not tested" must be stated explicitly rather than omitted.

## 7. Security and release checklist

- [ ] Permission matrix tests green for all roles (incl. unauthenticated)
- [ ] IDOR tests for every resource accessed by ID
- [ ] CSRF, session fixation, cookie flags verified
- [ ] Login/reset rate limiting verified
- [ ] Input validation fuzz on forms and API (long strings, wrong types, injection payloads)
- [ ] XSS tests on notices, complaints, assignment titles
- [ ] File upload restrictions verified
- [ ] AI assistant red-team prompts pass
- [ ] Audit log contains all events listed in `02-security-requirements.md` §7
- [ ] Dependency and secret scans clean
- [ ] Backups taken and restored successfully
- [ ] No default or demo credentials present in production configuration

## 8. Defect handling

- Severity: **Blocker** (security/data loss/permission bypass) · **High** (workflow broken) · **Medium** · **Low**.
- Blocker and High defects stop the phase gate.
- Every fixed defect gets a regression test; notable ones are recorded in `07-engineering-improvement-log.md`.
