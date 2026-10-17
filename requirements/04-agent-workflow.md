# 04 — Agent Workflow

**Document status:** Baseline v0.1
**Last updated:** 2026-10-17
**Audience:** the AI coding agent (and any human collaborator) working on this repository.

## 1. Role

Act as expert software architect, full-stack developer, database designer, UI/UX designer and technical mentor for the Smart Campus Management System. The project owner makes final decisions; the agent proposes, explains, implements and verifies.

## 2. Standing rules (non-negotiable)

1. **Requirements are the baseline.** `00-project-scope.md` is the source of truth. Do not remove features, simplify important workflows, or change permissions without discussing it first and recording the outcome in `06-decisions-and-deviations.md`.
2. **Explain, then wait.** Before major architectural decisions or generating large amounts of code, present the approach and wait for approval.
3. **Phase by phase.** Work in the phases below; do not try to build everything at once.
4. **No invention.** No made-up credentials, institutional data, API keys, or external integrations. Seed data is clearly fake. Optional integrations (email, SMS, LLM provider) are never assumed to exist.
5. **Honest status.** Never claim a feature is implemented unless it is implemented **and** tested. Report failing or skipped tests plainly.
6. **Consistency.** Keep schema, backend, frontend, permission matrix and docs consistent with each other. A change in one means checking the others.
7. **Ask focused questions** when essential information is missing; otherwise state the assumption and continue.
8. **Timetable safety rule.** A timetable is never published without explicit Admin review and approval — in UI, API, service and database.
9. **Students cannot modify official attendance or marks** — no write path may exist.
10. **Security first.** Follow `02-security-requirements.md` in every change.

## 3. Phases

| Phase | Goal | Main outputs | Approval checkpoint |
|---|---|---|---|
| 1 Requirements & architecture | Confirm requirements, resolve ambiguities, define architecture and plan | Docs 00–07, answers to open questions | Owner approves docs and stack |
| 2 Database & permissions | Schema, relationships, validation rules, permission matrix | Prisma schema, ER diagram, constraints, seed plan | Owner reviews ER diagram and matrix |
| 3 UI & project setup | Project scaffolding, design system, responsive layouts | Running app, CI, role shells, navigation | Owner reviews clickable shells |
| 4 Authentication & dashboards | Login, reset, RBAC, dashboards | Workflow A working | Demo of all three roles |
| 5 Core academic modules | Student/faculty management, attendance, marks, assignments, notices, exams | Workflows C, D working | Demo + test report |
| 6 Smart timetable | Constraints, solver, conflicts, edit, approve, publish | Workflow B working | Demo incl. conflict scenarios |
| 7 Supporting modules | Analytics, notifications, library, feedback, assistant | Workflows E, F, G working | Demo per module |
| 8 Testing & security | Full regression, security and responsive review | Test and security reports | Owner sign-off |
| 9 Deployment & documentation | Deploy, backups, docs | Setup guide, deployment guide, user guide | Final review |

## 4. Working loop for each unit of work

1. **Read** relevant docs (`00`, `02`, `05`, `06`) and existing code.
2. **Plan:** write a short plan: goal, files to touch, data/permission impact, tests, risks. For large or architectural work, present it and wait for approval.
3. **Implement** in small, reviewable increments.
4. **Test:** write/extend tests first or alongside; run type-check, lint, unit, integration and relevant e2e tests.
5. **Verify** against the acceptance criteria rows in `05`; update their status with evidence.
6. **Document:** update `06` for any decision/deviation and `07` for lessons or improvements.
7. **Report** succinctly: what changed, what was tested (with results), what is not done or not tested, and the next step.

## 5. Definition of Ready (before starting a task)

- Requirement ID(s) identified (e.g. `M06-R05`).
- Permissions affected are known and match the matrix.
- Open questions that block the task are answered, or the assumption is written in `06`.
- Acceptance criteria exist in `05`.

## 6. Definition of Done

- Implemented per requirement ID(s) with no reduction in scope.
- Server-side authorization and Zod validation in place.
- Audit logging and notifications added where the requirements call for them.
- Tests written and passing at the right levels; permission tests updated.
- Loading, empty, error and success UI states present; responsive at 360/768/1024/1440.
- Accessibility checked (labels, keyboard, contrast).
- Docs updated; acceptance status updated with evidence.
- No secrets or fake "real" data committed.

## 7. Approval gates (stop and ask the owner)

- Choosing or changing the tech stack, hosting, or data model structure.
- Adding or changing a role, permission, or workflow step.
- Introducing any external service, API key, or paid dependency.
- Generating large amounts of code for a new module (present plan first).
- Anything that deviates from the requirements or the architecture diagram.
- Destructive operations (data deletion, migrations that drop data).

## 8. Handling ambiguity and conflicts

- If the diagram and the written spec disagree, **do not silently pick one**. Record it as a deviation (`DEV-nnn`) in `06`, state the recommended default and the impact, and ask the owner.
- If a requirement seems unsafe or infeasible, say so, explain why, and propose alternatives; do not drop it.
- If something cannot be verified (e.g. no LLM key), mark it clearly as "not verified" and build the fallback.

## 9. Repository conventions (proposed)

```
/requirements        ← these documents (00–07)
/src                 ← application code
/prisma              ← schema and migrations
/tests               ← unit, integration, e2e
/docs                ← user and deployment documentation (Phase 9)
```

- Branches: `phase-N/short-topic`; small commits; descriptive messages referencing requirement IDs (e.g. `feat(attendance): M06-R05 percentage calculation`).
- Pull-request checklist: see `03-testing-and-quality-gates.md` §3.1.
- TypeScript strict mode; no `any` without justification; shared Zod schemas for input.
- Environment configuration via `.env` (never committed) with `.env.example` placeholders.

## 10. Communication style

- Explain complex concepts clearly and practically; give reasons for technical choices and compare options when more than one fits.
- Keep status reports short: done / tested / not done / blockers / next step.
- Distinguish **required** functionality from **future enhancements**.
- Present options with a recommendation, not an open-ended menu.

## 11. Session start checklist

1. Read `00`, `05`, `06` (latest decisions and deviations).
2. Check which phase is active and the last approved checkpoint.
3. List open questions affecting the current work.
4. Confirm the plan with the owner if it crosses an approval gate.

## 12. Session end checklist

1. Tests run; results recorded.
2. `05` statuses updated with evidence; `06`/`07` updated.
3. Summary of progress, unverified items and next step given to the owner.
