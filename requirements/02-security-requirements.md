# 02 — Security Requirements

**Document status:** Baseline v0.1
**Last updated:** 2026-10-17
**Covers:** M01 (Auth & Access Control) and M13 (Central Database & Security), plus security rules for every other module.

## 1. Security principles

1. **Deny by default.** Every endpoint requires an explicit permission.
2. **Server-side enforcement.** UI hiding is cosmetic; the server decides.
3. **Least privilege.** Faculty touch only assigned classes; students only their own records.
4. **Defense in depth.** Validation, authorization, DB constraints, audit logging.
5. **Auditability.** Important actions leave a tamper-evident trail.
6. **No invented secrets.** No default or hard-coded credentials in code, seed data, docs or screenshots.

## 2. Role-permission matrix

R = read, C = create, U = update, D = delete. "own" = only the user's own records. "assigned" = only assigned subjects/classes/batches.
Changing any cell requires an approved entry in `06-decisions-and-deviations.md`.

| Resource | Admin | Faculty | Student |
|---|---|---|---|
| User accounts and permissions | CRUD | — | — |
| Own profile | R, U | R, U (limited fields) | R, U (limited fields) |
| Departments, courses, subjects, batches, classrooms | CRUD | R (assigned) | R (own) |
| Timetable: generate / edit / approve / publish | CRUD + approve + publish | R (own, published only) | R (own batch, published only) |
| Faculty availability | CRUD | R, U (own, if allowed — Q) | — |
| Attendance | R all, reports | C, R, U (assigned) | R (own) |
| Marks | R all | C, R, U (assigned) | R (own, published only) |
| Assignments | R | CRUD (assigned) | R (own batch) *(submit: DEV-001)* |
| Examination schedules | CRUD | R (assigned) *(create: DEV-003)* | R (own) |
| Result publishing | Publish | — | R (published) |
| Notices | CRUD (all) | CRUD (course-level) | R |
| Student performance | R all | R (assigned classes) | R (own) |
| Analytics and reports | Full (authorized) | Own classes | Own |
| Library catalogue | CRUD | R | R |
| Library issue/return records | CRUD | — | R (own) *(borrow action: DEV-002)* |
| Feedback and complaints | R all, respond, set status | — *(Q7)* | C, R (own), track |
| AI assistant | Admin-scoped | Faculty-scoped | Student-scoped |
| Notifications | Own | Own | Own |
| Audit logs and system settings | R, manage | — | — |

## 3. Authentication requirements (M01)

| ID | Requirement |
|---|---|
| SEC-A01 | Passwords hashed with argon2id (or bcrypt with cost ≥ 12). Never stored or logged in plain text. |
| SEC-A02 | Password policy: minimum 10 characters, checked against common-password list; no forced composition rules that reduce entropy. |
| SEC-A03 | Login rate limiting per account and per IP; temporary lockout/back-off after repeated failures. |
| SEC-A04 | Generic error messages on failed login ("Invalid credentials") — no account enumeration. |
| SEC-A05 | Sessions: server-side session or signed token in `httpOnly`, `Secure`, `SameSite=Lax/Strict` cookie; idle and absolute timeouts (values configurable). |
| SEC-A06 | Logout invalidates the session server-side. |
| SEC-A07 | Password reset: single-use, time-limited (e.g. 30 min), high-entropy token, stored hashed; response identical whether or not the account exists; all sessions revoked after reset. |
| SEC-A08 | Initial passwords for admin-created accounts must be one-time/forced-change; no shared default password. |
| SEC-A09 | Login identifier (Email / Roll No / ID) must be unique per user and normalised before lookup. |
| SEC-A10 | CSRF protection on all state-changing requests. |

## 4. Authorization requirements

| ID | Requirement |
|---|---|
| SEC-Z01 | Central policy layer: `can(user, action, resource)` used by every handler; no ad-hoc role checks in UI or routes. |
| SEC-Z02 | Ownership checks: a student may only query records where `student_id = session.user`. |
| SEC-Z03 | Assignment-scope checks: faculty actions validated against `SubjectOffering.faculty_id = session.user` for the target batch/subject. |
| SEC-Z04 | Object-level checks on every ID in the URL/body (prevent IDOR). |
| SEC-Z05 | Timetable `PUBLISHED` transition requires Admin role AND `APPROVED` status; enforced in service layer and by DB check. |
| SEC-Z06 | Result visibility: students see only `PUBLISHED` results/marks. |
| SEC-Z07 | Students have no write path to attendance or marks tables (no endpoint, no DB grant). |
| SEC-Z08 | Privilege changes (role/permission edits) are Admin-only and audit-logged. |

## 5. Input validation and output safety

- SEC-V01 All inputs validated with Zod on the server (type, length, range, enum, format); client validation is convenience only.
- SEC-V02 Parameterised queries only (via ORM); no string-built SQL.
- SEC-V03 Output encoding to prevent XSS; sanitise any rich-text notices/announcements with an allow-list sanitizer.
- SEC-V04 Marks must satisfy `0 <= marks <= max`; attendance status limited to the allowed enum; dates validated (no deadlines in the past on creation, etc.).
- SEC-V05 File uploads (assignment files): allow-list of types and extensions, size limit, content-type sniffing, random storage names, stored outside web root, antivirus scan if available, authorised download endpoint only.
- SEC-V06 Security headers: CSP, HSTS, X-Content-Type-Options, Referrer-Policy, frame protection.

## 6. Data protection (M13)

| ID | Requirement |
|---|---|
| SEC-D01 | TLS for all traffic in transit. |
| SEC-D02 | Encryption at rest for database and backups (provider-level at minimum). |
| SEC-D03 | Extra protection for highly sensitive fields (complaints, feedback text): restricted access, and field-level encryption if the owner decides it is required (open decision). |
| SEC-D04 | Collect only data the system needs; document each personal-data field and who can see it. |
| SEC-D05 | Secrets (DB URL, session secret, API keys) only in environment/secret store; never committed; `.env.example` contains placeholders only. |
| SEC-D06 | Logs must not contain passwords, tokens, or full personal records. |
| SEC-D07 | Regular automated backups (daily proposed), retention policy, encrypted storage, **restore tested** before go-live. |
| SEC-D08 | Soft-delete for academic records; hard deletion restricted and audit-logged. |
| SEC-D09 | Seed/demo data must be clearly fake; no real student data in non-production environments. |

## 7. Audit logging

Audit entry fields: `id, timestamp, actor_user_id, actor_role, action, entity_type, entity_id, before/after summary, ip, user_agent, result`.
Audit log is append-only for application users; only Admin can read it; no UI to edit or delete entries.

Events that **must** be logged:

- Login success/failure, logout, password reset request/complete, lockouts.
- User creation, deactivation, role/permission changes.
- Attendance create/update (with before/after).
- Marks entry/update; result publish/unpublish.
- Timetable generate, edit, approve, publish, rollback.
- Notice create/update/delete.
- Complaint status changes and responses; feedback access by Admin.
- Library issue/return/override.
- System settings changes (including attendance threshold).
- Exports/downloads of reports containing personal data.
- Backup/restore operations.

## 8. AI assistant security (M09)

| ID | Requirement |
|---|---|
| SEC-AI01 | The model never receives database credentials or free-form query access. It can call only whitelisted, parameterised functions that apply the user's role/ownership filters. |
| SEC-AI02 | Knowledge base contains only documents marked **approved** by Admin; versioned; unapproved or draft documents are excluded. |
| SEC-AI03 | Student/faculty confidential records (other people's marks, attendance, complaints, personal details) are never retrievable for another user, even if asked directly. |
| SEC-AI04 | Prompt-injection hardening: retrieved text and user text are treated as data; system rules cannot be overridden; refusal for attempts to reveal other users' data or system prompts. |
| SEC-AI05 | If no verified information is retrieved, the assistant states that and refers the user to the relevant office; it must not guess. |
| SEC-AI06 | Queries logged (user, time, intent, sources used) with minimal personal content; retention policy defined. |
| SEC-AI07 | Data sent to an external LLM provider is limited to what is needed to answer; owner must approve the provider and be told what leaves the system. |
| SEC-AI08 | Per-user rate limiting on assistant requests. |

## 9. Feedback and complaint confidentiality (M10)

- Submissions visible only to the submitting student and authorized Admin(s).
- Faculty cannot read raw feedback about themselves unless the owner approves aggregated views (Q7).
- If anonymous feedback is chosen, the student identity must not be exposed to Admin or faculty in UI, exports or logs (store submitter ID separately only if required for abuse handling, access-restricted).

## 10. Application hardening

- Dependency scanning (`npm audit` / Dependabot or equivalent) in CI; lockfile committed.
- Security linting (ESLint security rules), secret scanning in CI.
- Generic production error pages; stack traces never shown to users.
- Principle of least privilege for DB user: application role cannot drop tables; migrations use a separate role.
- Rate limiting on auth, password reset, AI assistant, export endpoints.

## 11. OWASP Top 10 mapping (checklist)

| Risk | Covered by |
|---|---|
| A01 Broken access control | SEC-Z01…Z08, tests in `03` |
| A02 Cryptographic failures | SEC-A01, SEC-D01…D03, D07 |
| A03 Injection | SEC-V01…V03, SEC-AI01 |
| A04 Insecure design | Threat modelling per phase, state machine for timetable/results |
| A05 Security misconfiguration | SEC-V06, SEC-D05, environment separation |
| A06 Vulnerable components | CI dependency scan |
| A07 Identification & auth failures | SEC-A01…A10 |
| A08 Software/data integrity | Migrations review, lockfile, signed builds if available |
| A09 Logging & monitoring failures | Section 7 |
| A10 SSRF | No user-supplied URL fetching; AI tools whitelisted |

## 12. Security acceptance gate

A phase cannot be marked complete until: permission tests for all three roles pass, no known high/critical vulnerabilities remain, no secrets in the repository, audit events for that phase's actions are verified, and the checklist in `03-testing-and-quality-gates.md` §7 is signed off.
