# 07 — Engineering Improvement Log

**Document status:** Living log
**Last updated:** 2026-10-17

Purpose: capture what was learned while building, defects and their root causes, technical debt, and improvement ideas — so quality rises over time and the same mistakes are not repeated. This is **not** a requirements document: ideas listed here do not change scope. Anything that would change a requirement or permission must go through `06-decisions-and-deviations.md`.

## 1. How to use this log

- Add an entry whenever: a defect is fixed, a design is reworked, a test gap is found, performance or security is improved, or a better approach is discovered.
- Keep entries short and factual. Link requirement IDs, files, tests and decisions.
- Review the log at every phase gate; convert worthwhile ideas into tracked tasks.
- Status values: `Idea` · `Planned` · `In progress` · `Done` · `Dropped`.

## 2. Entry template

```
### IMP-0xx — <short title>
- Date:
- Phase / module (req IDs):
- Type: Defect | Refactor | Test gap | Security | Performance | UX | Accessibility | Tooling | Documentation | Process
- What happened / observation:
- Root cause:
- Change made (or proposed):
- Verification (tests / evidence):
- Follow-ups:
- Status:
```

## 3. Entries

### IMP-001 — Requirements baseline and diagram reconciliation
- Date: 2026-10-17
- Phase / module: Phase 1 (all modules)
- Type: Process / Documentation
- What happened: Created docs 00–07 from the project context document and the architecture/workflow diagram. Comparing the two revealed differences (student assignment submission, student-side book borrowing, faculty exam-schedule creation, faculty "interact with students", email as required vs optional).
- Root cause: The diagram was drawn at a higher level than the written spec and includes some behaviours the spec does not state.
- Change made: Logged each difference as DEV-001…DEV-010 in `06` with a recommended default instead of silently choosing.
- Verification: Review by the owner (pending).
- Follow-ups: Owner decisions on DEV-001…004, DEV-008 and open questions Q1–Q14 before Phase 2 schema freeze.
- Status: In progress

## 4. Improvement backlog (ideas only — not committed scope)

| ID | Idea | Area | Value | Effort (est.) | Status |
|---|---|---|---|---|---|
| IMP-B01 | Upgrade timetable solver to Google OR-Tools CP-SAT if custom solver struggles on larger inputs | M05 | Better optimality and speed at scale | High | Idea |
| IMP-B02 | Email and SMS delivery adapters behind the notification interface | M08 | Wider reach of reminders | Medium | Idea |
| IMP-B03 | Student assignment file submission with plagiarism-check hook | M03/M04 | Fuller assignment workflow (see DEV-001) | Medium | Idea |
| IMP-B04 | Library fines and payment tracking | M12 | Complete library cycle (see Q8) | Medium | Idea |
| IMP-B05 | Progressive Web App (installable, offline timetable view) | UI | Better mobile experience | Medium | Idea |
| IMP-B06 | Attendance by QR code / geofence | M06 | Faster, harder to fake | High | Idea |
| IMP-B07 | Timetable "what-if" comparison between versions | M05 | Easier Admin review | Medium | Idea |
| IMP-B08 | Observability: structured logs, error tracking, uptime checks | Ops | Faster diagnosis | Low | Idea |
| IMP-B09 | Automated visual-regression tests for responsive layouts | Testing | Catch UI regressions | Medium | Idea |
| IMP-B10 | Accessibility audit with a screen reader pass | UI | Inclusive design | Low | Idea |
| IMP-B11 | Assistant evaluation set (question → expected grounded answer/refusal) run in CI | M09 | Prevent regressions and hallucination | Medium | Idea |
| IMP-B12 | Multi-institution (multi-tenant) support | Platform | Reuse across colleges (currently out of scope) | High | Idea |

## 5. Technical debt register

| ID | Debt | Introduced in | Risk | Planned fix | Status |
|---|---|---|---|---|---|
| — | None yet (no code written) | — | — | — | — |

## 6. Defect and incident log

| ID | Date | Severity | Summary | Root cause | Fix | Regression test | Status |
|---|---|---|---|---|---|---|---|
| — | — | — | None yet | — | — | — | — |

## 7. Lessons learned (update at each phase gate)

| Phase | What worked | What to change | Applied? |
|---|---|---|---|
| 1 | Writing docs before code surfaced spec/diagram mismatches early | Get owner decisions on open questions before schema design | Pending |

## 8. Phase-gate review checklist

At the end of each phase, review this log and answer:

- [ ] Were any requirements weakened or worked around? (If yes → `06`.)
- [ ] Which tests were hardest to write, and what does that say about the design?
- [ ] Any repeated defect type that needs a guard (lint rule, type, DB constraint, test)?
- [ ] Any security finding that implies a missing policy in `02`?
- [ ] Any acceptance criteria in `05` that proved unclear or untestable?
- [ ] Which backlog ideas are now worth scheduling?
