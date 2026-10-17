"use client";

import { useActionState } from "react";
import type { ReactElement } from "react";
import Link from "next/link";
import { ActionFeedback, Field, SubmitButton } from "./form-kit";
import { initialActionState } from "@/lib/actions/types";
import { loginAction, changePasswordAction } from "@/lib/actions/auth";
import {
  approveTimetableAction,
  editSlotAction,
  generateTimetableAction,
  publishTimetableAction,
  submitForReviewAction,
} from "@/lib/actions/timetable";
import { createSessionAction, recordAttendanceAction } from "@/lib/actions/attendance";
import { createExamAction, enterMarksAction, publishResultsAction } from "@/lib/actions/marks";
import {
  createAssignmentAction,
  createNoticeAction,
  respondComplaintAction,
  submitComplaintAction,
  submitFeedbackAction,
} from "@/lib/actions/comms";
import {
  createBatchAction,
  createClassroomAction,
  createCourseAction,
  createDepartmentAction,
  createOfferingAction,
  createSubjectAction,
  createUserAction,
  borrowBookAction,
  returnBookAction,
  setThresholdAction,
  setUserActiveAction,
} from "@/lib/actions/admin";
import { askAssistantAction } from "@/lib/actions/assistant";
import {
  cancelSwapRequestAction,
  createSwapRequestAction,
  decideSwapAction,
} from "@/lib/actions/swap";
import { cancelLectureAction } from "@/lib/actions/cancellation";
import { DAYS, DEFAULT_PERIODS } from "@/lib/constants";

type Option = { value: string; label: string };

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export function LoginForm() {
  const [state, action] = useActionState(loginAction, initialActionState);
  return (
    <form action={action} className="space-y-4">
      <ActionFeedback state={state} />
      <Field label="Email / Roll No / ID" htmlFor="identifier" error={state.fieldErrors?.identifier}>
        <input
          id="identifier"
          name="identifier"
          className="input"
          autoComplete="username"
          placeholder="admin@campus.edu"
          required
        />
      </Field>
      <Field label="Password" htmlFor="password" error={state.fieldErrors?.password}>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete="current-password"
          required
        />
      </Field>
      <SubmitButton className="w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initialActionState);
  return (
    <form action={action} className="space-y-4">
      <ActionFeedback state={state} />
      <Field label="Current password" htmlFor="currentPassword" error={state.fieldErrors?.currentPassword}>
        <input id="currentPassword" name="currentPassword" type="password" className="input" autoComplete="current-password" required />
      </Field>
      <Field
        label="New password"
        htmlFor="newPassword"
        error={state.fieldErrors?.newPassword}
        hint="At least 10 characters. Avoid common passwords."
      >
        <input id="newPassword" name="newPassword" type="password" className="input" autoComplete="new-password" required />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword" error={state.fieldErrors?.confirmPassword}>
        <input id="confirmPassword" name="confirmPassword" type="password" className="input" autoComplete="new-password" required />
      </Field>
      <SubmitButton pendingText="Updating…">Update password</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Timetable
// ---------------------------------------------------------------------------

export function GenerateTimetableForm({ terms }: { terms: Option[] }) {
  const [state, action] = useActionState(generateTimetableAction, initialActionState);
  const conflicts = (state.data?.conflicts as
    | { subjectLabel: string; message: string; suggestion: string }[]
    | undefined) ?? [];
  return (
    <form action={action} className="space-y-3">
      <ActionFeedback state={state} />
      <Field label="Academic term" htmlFor="termId">
        <select id="termId" name="termId" className="input" defaultValue={terms[0]?.value}>
          {terms.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <SubmitButton pendingText="Generating…">Generate new timetable</SubmitButton>
      {conflicts.length > 0 ? (
        <ul className="mt-2 space-y-2 rounded-lg border border-warn-500/30 bg-warn-50 p-3 text-xs text-warn-700">
          {conflicts.map((c, i) => (
            <li key={i}>
              <span className="font-semibold">{c.subjectLabel}</span>: {c.message}
              <br />
              <span className="text-warn-600">Suggestion: {c.suggestion}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}

function VersionButton({
  versionId,
  action,
  label,
  pendingText,
  variant = "primary",
}: {
  versionId: string;
  action: typeof approveTimetableAction;
  label: string;
  pendingText: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <input type="hidden" name="versionId" value={versionId} />
      <SubmitButton variant={variant} pendingText={pendingText}>
        {label}
      </SubmitButton>
      {state.message ? (
        <span className={`text-xs ${state.ok ? "text-success-600" : "text-danger-600"}`}>
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

export function TimetableVersionActions({
  versionId,
  status,
}: {
  versionId: string;
  status: string;
}) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      {(status === "GENERATED" || status === "DRAFT") && (
        <VersionButton versionId={versionId} action={submitForReviewAction} label="Send for review" pendingText="Sending…" variant="secondary" />
      )}
      {status === "IN_REVIEW" && (
        <VersionButton versionId={versionId} action={approveTimetableAction} label="Approve" pendingText="Approving…" />
      )}
      {status === "APPROVED" && (
        <VersionButton versionId={versionId} action={publishTimetableAction} label="Publish" pendingText="Publishing…" />
      )}
      {status === "PUBLISHED" && (
        <span className="badge bg-success-50 text-success-700">Published</span>
      )}
    </div>
  );
}

export function SlotEditForm({
  versionId,
  slot,
  rooms,
  disabled,
}: {
  versionId: string;
  slot: { id: string; day: number; periodIndex: number; classroomId: string; label: string };
  rooms: Option[];
  disabled?: boolean;
}) {
  const [state, action] = useActionState(editSlotAction, initialActionState);
  if (disabled) return null;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="versionId" value={versionId} />
      <input type="hidden" name="slotId" value={slot.id} />
      <div>
        <label className="label text-xs" htmlFor={`day-${slot.id}`}>Day</label>
        <select id={`day-${slot.id}`} name="day" defaultValue={slot.day} className="input py-1.5 text-xs">
          {DAYS.map((d) => (
            <option key={d.value} value={d.value}>{d.short}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label text-xs" htmlFor={`period-${slot.id}`}>Period</label>
        <select id={`period-${slot.id}`} name="periodIndex" defaultValue={slot.periodIndex} className="input py-1.5 text-xs">
          {DEFAULT_PERIODS.map((p) => (
            <option key={p.index} value={p.index}>{p.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label text-xs" htmlFor={`room-${slot.id}`}>Room</label>
        <select id={`room-${slot.id}`} name="classroomId" defaultValue={slot.classroomId} className="input py-1.5 text-xs">
          {rooms.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>
      <SubmitButton variant="secondary" pendingText="…">Move</SubmitButton>
      {state.message && !state.ok ? (
        <span className="text-xs text-danger-600">{state.message}</span>
      ) : null}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export function CreateSessionForm({ offerings }: { offerings: Option[] }) {
  const [state, action] = useActionState(createSessionAction, initialActionState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <ActionFeedback state={state} />
      <Field label="Subject / batch" htmlFor="offeringId" className="sm:col-span-2">
        <select id="offeringId" name="offeringId" className="input" required>
          {offerings.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Date" htmlFor="date">
        <input id="date" name="date" type="date" className="input" required />
      </Field>
      <Field label="Day" htmlFor="day">
        <select id="day" name="day" className="input" defaultValue={1}>
          {DAYS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Period" htmlFor="periodIndex">
        <select id="periodIndex" name="periodIndex" className="input" defaultValue={1}>
          {DEFAULT_PERIODS.map((p) => (
            <option key={p.index} value={p.index}>{p.label} ({p.startTime})</option>
          ))}
        </select>
      </Field>
      <Field label="Topic (optional)" htmlFor="topic">
        <input id="topic" name="topic" className="input" placeholder="e.g. Linked lists" />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Creating…">Create class session</SubmitButton>
      </div>
    </form>
  );
}

export function RecordAttendanceForm({
  sessionId,
  students,
  existing,
}: {
  sessionId: string;
  students: { studentId: string; rollNo: string; name: string }[];
  existing: Record<string, string>;
}) {
  const [state, action] = useActionState(recordAttendanceAction, initialActionState);
  return (
    <form action={action} className="space-y-4">
      <ActionFeedback state={state} />
      <input type="hidden" name="classSessionId" value={sessionId} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Roll No</th>
              <th>Name</th>
              <th>Present</th>
              <th>Absent</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const current = existing[s.studentId] ?? "PRESENT";
              return (
                <tr key={s.studentId}>
                  <td className="font-medium text-ink-800">{s.rollNo}</td>
                  <td>{s.name}</td>
                  <td>
                    <input
                      type="radio"
                      name={`status_${s.studentId}`}
                      value="PRESENT"
                      defaultChecked={current === "PRESENT"}
                      aria-label={`Present ${s.name}`}
                    />
                  </td>
                  <td>
                    <input
                      type="radio"
                      name={`status_${s.studentId}`}
                      value="ABSENT"
                      defaultChecked={current === "ABSENT"}
                      aria-label={`Absent ${s.name}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <SubmitButton pendingText="Saving…">Save attendance</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------

export function EnterMarksForm({
  examId,
  maxMarks,
  students,
  existing,
}: {
  examId: string;
  maxMarks: number;
  students: { studentId: string; rollNo: string; name: string }[];
  existing: Record<string, number>;
}) {
  const [state, action] = useActionState(enterMarksAction, initialActionState);
  return (
    <form action={action} className="space-y-4">
      <ActionFeedback state={state} />
      <input type="hidden" name="examId" value={examId} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Roll No</th>
              <th>Name</th>
              <th>Marks (0–{maxMarks})</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.studentId}>
                <td className="font-medium text-ink-800">{s.rollNo}</td>
                <td>{s.name}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={maxMarks}
                    step="0.5"
                    name={`marks_${s.studentId}`}
                    defaultValue={existing[s.studentId] ?? ""}
                    className="input w-28 py-1"
                    aria-label={`Marks for ${s.name}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SubmitButton pendingText="Saving…">Save marks</SubmitButton>
    </form>
  );
}

export function ExamForm({
  subjects,
  batches,
  classrooms,
  terms,
}: {
  subjects: Option[];
  batches: Option[];
  classrooms: Option[];
  terms: Option[];
}) {
  const [state, action] = useActionState(createExamAction, initialActionState);
  return (
    <form action={action} className="space-y-3">
      <ActionFeedback state={state} />
      <Field label="Exam name" htmlFor="e-name" error={state.fieldErrors?.name}>
        <input id="e-name" name="name" className="input" placeholder="Mid-Term Exam" required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Subject" htmlFor="e-subj">
          <select id="e-subj" name="subjectId" className="input" required>
            {subjects.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Batch" htmlFor="e-batch">
          <select id="e-batch" name="batchId" className="input" required>
            {batches.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </Field>
        <Field label="Term" htmlFor="e-term">
          <select id="e-term" name="termId" className="input" required>
            {terms.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Max marks" htmlFor="e-max">
          <input id="e-max" name="maxMarks" type="number" min={1} max={1000} defaultValue={100} className="input" />
        </Field>
        <Field label="Date" htmlFor="e-date">
          <input id="e-date" name="examDate" type="date" className="input" required />
        </Field>
        <Field label="Classroom (optional)" htmlFor="e-room">
          <select id="e-room" name="classroomId" className="input">
            <option value="">—</option>
            {classrooms.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Start time" htmlFor="e-start">
          <input id="e-start" name="startTime" type="time" className="input" defaultValue="09:00" required />
        </Field>
        <Field label="End time" htmlFor="e-end">
          <input id="e-end" name="endTime" type="time" className="input" defaultValue="11:00" required />
        </Field>
      </div>
      <SubmitButton pendingText="Scheduling…">Schedule exam</SubmitButton>
    </form>
  );
}

export function PublishResultsForm({ examId }: { examId: string }) {
  const [state, action] = useActionState(publishResultsAction, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="examId" value={examId} />
      <SubmitButton pendingText="Publishing…">Publish results</SubmitButton>
      {state.message ? (
        <span className={`text-xs ${state.ok ? "text-success-600" : "text-danger-600"}`}>
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Communication
// ---------------------------------------------------------------------------

export function NoticeForm({
  audiences,
  courses,
  batches,
}: {
  audiences: Option[];
  courses: Option[];
  batches: Option[];
}) {
  const [state, action] = useActionState(createNoticeAction, initialActionState);
  return (
    <form action={action} className="space-y-3">
      <ActionFeedback state={state} />
      <Field label="Title" htmlFor="n-title" error={state.fieldErrors?.title}>
        <input id="n-title" name="title" className="input" required />
      </Field>
      <Field label="Message" htmlFor="n-body" error={state.fieldErrors?.body}>
        <textarea id="n-body" name="body" rows={4} className="input" required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Audience" htmlFor="n-audience">
          <select id="n-audience" name="audience" className="input">
            {audiences.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Course (for course notices)" htmlFor="n-course">
          <select id="n-course" name="courseId" className="input">
            <option value="">—</option>
            {courses.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Batch (for batch notices)" htmlFor="n-batch">
          <select id="n-batch" name="batchId" className="input">
            <option value="">—</option>
            {batches.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </Field>
      </div>
      <SubmitButton pendingText="Publishing…">Publish notice</SubmitButton>
    </form>
  );
}

export function AssignmentForm({ offerings }: { offerings: Option[] }) {
  const [state, action] = useActionState(createAssignmentAction, initialActionState);
  return (
    <form action={action} className="space-y-3">
      <ActionFeedback state={state} />
      <Field label="Subject / batch" htmlFor="a-offering">
        <select id="a-offering" name="offeringId" className="input" required>
          {offerings.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Title" htmlFor="a-title" error={state.fieldErrors?.title}>
        <input id="a-title" name="title" className="input" required />
      </Field>
      <Field label="Description" htmlFor="a-desc" error={state.fieldErrors?.description}>
        <textarea id="a-desc" name="description" rows={3} className="input" required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Deadline" htmlFor="a-deadline" error={state.fieldErrors?.deadline}>
          <input id="a-deadline" name="deadline" type="datetime-local" className="input" required />
        </Field>
        <Field label="Max marks" htmlFor="a-max">
          <input id="a-max" name="maxMarks" type="number" min={1} max={500} defaultValue={100} className="input" />
        </Field>
      </div>
      <SubmitButton pendingText="Creating…">Create assignment</SubmitButton>
    </form>
  );
}

export function ComplaintForm({ faculty }: { faculty: Option[] }) {
  const [complaintState, complaintAction] = useActionState(submitComplaintAction, initialActionState);
  const [feedbackState, feedbackAction] = useActionState(submitFeedbackAction, initialActionState);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form action={complaintAction} className="space-y-3">
        <h3 className="text-sm font-semibold text-ink-800">Report a campus issue</h3>
        <ActionFeedback state={complaintState} />
        <Field label="Category" htmlFor="c-cat">
          <select id="c-cat" name="category" className="input">
            {["Facilities", "Academic", "Hostel", "Transport", "Canteen", "Other"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Subject" htmlFor="c-subj" error={complaintState.fieldErrors?.subject}>
          <input id="c-subj" name="subject" className="input" required />
        </Field>
        <Field label="Details" htmlFor="c-msg" error={complaintState.fieldErrors?.message}>
          <textarea id="c-msg" name="message" rows={3} className="input" required />
        </Field>
        <SubmitButton pendingText="Submitting…">Submit complaint</SubmitButton>
      </form>

      <form action={feedbackAction} className="space-y-3">
        <h3 className="text-sm font-semibold text-ink-800">Give faculty feedback</h3>
        <ActionFeedback state={feedbackState} />
        <Field label="Faculty (optional)" htmlFor="f-fac">
          <select id="f-fac" name="facultyId" className="input">
            <option value="">—</option>
            {faculty.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Subject" htmlFor="f-subj" error={feedbackState.fieldErrors?.subject}>
          <input id="f-subj" name="subject" className="input" required />
        </Field>
        <Field label="Feedback" htmlFor="f-msg" error={feedbackState.fieldErrors?.message}>
          <textarea id="f-msg" name="message" rows={3} className="input" required />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink-600">
          <input type="checkbox" name="isAnonymous" defaultChecked />
          Submit anonymously
        </label>
        <SubmitButton pendingText="Submitting…">Submit feedback</SubmitButton>
      </form>
    </div>
  );
}

export function RespondComplaintForm({
  complaintId,
  currentStatus,
  statuses,
}: {
  complaintId: string;
  currentStatus: string;
  statuses: Option[];
}) {
  const [state, action] = useActionState(respondComplaintAction, initialActionState);
  return (
    <form action={action} className="space-y-2">
      <ActionFeedback state={state} />
      <input type="hidden" name="complaintId" value={complaintId} />
      <Field label="Response" htmlFor={`r-${complaintId}`} error={state.fieldErrors?.message}>
        <textarea id={`r-${complaintId}`} name="message" rows={2} className="input" required />
      </Field>
      <div className="flex items-end gap-2">
        <Field label="Set status" htmlFor={`s-${complaintId}`}>
          <select id={`s-${complaintId}`} name="status" defaultValue={currentStatus} className="input py-1.5">
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>
        <SubmitButton variant="secondary" pendingText="Sending…">Respond</SubmitButton>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export function ThresholdForm({ current }: { current: number }) {
  const [state, action] = useActionState(setThresholdAction, initialActionState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <ActionFeedback state={state} />
      <Field label="Attendance threshold (%)" htmlFor="attendanceThreshold" error={state.fieldErrors?.attendanceThreshold}>
        <input
          id="attendanceThreshold"
          name="attendanceThreshold"
          type="number"
          min={1}
          max={100}
          defaultValue={current}
          className="input w-32"
        />
      </Field>
      <SubmitButton pendingText="Saving…">Save threshold</SubmitButton>
    </form>
  );
}

export function CreateUserForm({
  departments,
  batches,
}: {
  departments: Option[];
  batches: Option[];
}) {
  const [state, action] = useActionState(createUserAction, initialActionState);
  const temp = state.data?.temporaryPassword as string | undefined;
  return (
    <form action={action} className="space-y-3">
      <ActionFeedback state={state} />
      {temp ? (
        <div className="rounded-lg border border-success-500/30 bg-success-50 px-3 py-2 text-sm text-success-700">
          One-time password for the new account:{" "}
          <span className="font-mono font-semibold">{temp}</span>
          <br />
          <span className="text-xs">
            Share it securely; the user must change it after signing in. It is shown only once.
          </span>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name" htmlFor="u-first" error={state.fieldErrors?.firstName}>
          <input id="u-first" name="firstName" className="input" required />
        </Field>
        <Field label="Last name" htmlFor="u-last" error={state.fieldErrors?.lastName}>
          <input id="u-last" name="lastName" className="input" required />
        </Field>
        <Field label="Email" htmlFor="u-email" error={state.fieldErrors?.email}>
          <input id="u-email" name="email" type="email" className="input" required />
        </Field>
        <Field label="Login ID / Roll No" htmlFor="u-login" error={state.fieldErrors?.loginId}>
          <input id="u-login" name="loginId" className="input" required />
        </Field>
        <Field label="Role" htmlFor="u-role">
          <select id="u-role" name="role" className="input" defaultValue="STUDENT">
            <option value="STUDENT">Student</option>
            <option value="FACULTY">Faculty</option>
            <option value="ADMIN">Administrator</option>
          </select>
        </Field>
        <Field label="Department" htmlFor="u-dept" error={state.fieldErrors?.departmentId}>
          <select id="u-dept" name="departmentId" className="input">
            <option value="">—</option>
            {departments.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Batch (students)" htmlFor="u-batch">
          <select id="u-batch" name="batchId" className="input">
            <option value="">—</option>
            {batches.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Designation (faculty)" htmlFor="u-desig">
          <input id="u-desig" name="designation" className="input" placeholder="Assistant Professor" />
        </Field>
      </div>
      <SubmitButton pendingText="Creating…">Create account</SubmitButton>
    </form>
  );
}

function InlineButton({
  action,
  fields,
  label,
  pendingText,
  variant = "secondary",
}: {
  action: (prev: typeof initialActionState, formData: FormData) => Promise<typeof initialActionState>;
  fields: Record<string, string>;
  label: string;
  pendingText: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton variant={variant} pendingText={pendingText}>{label}</SubmitButton>
      {state.message ? (
        <span className={`text-xs ${state.ok ? "text-success-600" : "text-danger-600"}`}>
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

export function UserActiveToggle({ userId, isActive }: { userId: string; isActive: boolean }) {
  return (
    <InlineButton
      action={setUserActiveAction}
      fields={{ userId, isActive: String(!isActive) }}
      label={isActive ? "Deactivate" : "Activate"}
      pendingText="…"
      variant={isActive ? "danger" : "primary"}
    />
  );
}

export function SimpleCreateForm({
  kind,
  departments = [],
  courses = [],
  terms = [],
  subjects = [],
  batches = [],
  faculty = [],
}: {
  kind: "department" | "course" | "subject" | "batch" | "classroom" | "offering";
  departments?: Option[];
  courses?: Option[];
  terms?: Option[];
  subjects?: Option[];
  batches?: Option[];
  faculty?: Option[];
}) {
  const map = {
    department: createDepartmentAction,
    course: createCourseAction,
    subject: createSubjectAction,
    batch: createBatchAction,
    classroom: createClassroomAction,
    offering: createOfferingAction,
  } as const;
  const [state, action] = useActionState(map[kind], initialActionState);

  return (
    <form action={action} className="space-y-3">
      <ActionFeedback state={state} />
      {kind === "department" && (
        <>
          <Field label="Code" htmlFor="d-code" error={state.fieldErrors?.code}>
            <input id="d-code" name="code" className="input" required />
          </Field>
          <Field label="Name" htmlFor="d-name" error={state.fieldErrors?.name}>
            <input id="d-name" name="name" className="input" required />
          </Field>
        </>
      )}
      {kind === "course" && (
        <>
          <Field label="Code" htmlFor="c-code" error={state.fieldErrors?.code}>
            <input id="c-code" name="code" className="input" required />
          </Field>
          <Field label="Name" htmlFor="c-name" error={state.fieldErrors?.name}>
            <input id="c-name" name="name" className="input" required />
          </Field>
          <Field label="Department" htmlFor="c-dept">
            <select id="c-dept" name="departmentId" className="input" required>
              {departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </Field>
          <Field label="Duration (years)" htmlFor="c-dur">
            <input id="c-dur" name="durationYears" type="number" min={1} max={6} defaultValue={4} className="input" />
          </Field>
        </>
      )}
      {kind === "subject" && (
        <>
          <Field label="Code" htmlFor="s-code" error={state.fieldErrors?.code}>
            <input id="s-code" name="code" className="input" required />
          </Field>
          <Field label="Name" htmlFor="s-name" error={state.fieldErrors?.name}>
            <input id="s-name" name="name" className="input" required />
          </Field>
          <Field label="Course" htmlFor="s-course">
            <select id="s-course" name="courseId" className="input" required>
              {courses.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Department" htmlFor="s-dept">
            <select id="s-dept" name="departmentId" className="input" required>
              {departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Credits" htmlFor="s-cred">
              <input id="s-cred" name="credits" type="number" min={0} max={12} defaultValue={3} className="input" />
            </Field>
            <Field label="Semester" htmlFor="s-sem">
              <input id="s-sem" name="semester" type="number" min={1} max={12} defaultValue={4} className="input" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-600">
            <input type="checkbox" name="isLab" /> This is a laboratory subject
          </label>
        </>
      )}
      {kind === "batch" && (
        <>
          <Field label="Name" htmlFor="b-name" error={state.fieldErrors?.name}>
            <input id="b-name" name="name" className="input" required placeholder="CSE-2027-A" />
          </Field>
          <Field label="Course" htmlFor="b-course">
            <select id="b-course" name="courseId" className="input" required>
              {courses.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Term" htmlFor="b-term">
            <select id="b-term" name="termId" className="input" required>
              {terms.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Semester" htmlFor="b-sem">
              <input id="b-sem" name="semester" type="number" min={1} max={12} defaultValue={4} className="input" />
            </Field>
            <Field label="Strength" htmlFor="b-str">
              <input id="b-str" name="strength" type="number" min={1} max={500} defaultValue={60} className="input" />
            </Field>
          </div>
        </>
      )}
      {kind === "classroom" && (
        <>
          <Field label="Code" htmlFor="r-code" error={state.fieldErrors?.code}>
            <input id="r-code" name="code" className="input" required />
          </Field>
          <Field label="Name" htmlFor="r-name" error={state.fieldErrors?.name}>
            <input id="r-name" name="name" className="input" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Capacity" htmlFor="r-cap">
              <input id="r-cap" name="capacity" type="number" min={1} max={1000} defaultValue={60} className="input" />
            </Field>
            <Field label="Type" htmlFor="r-type">
              <select id="r-type" name="type" className="input" defaultValue="LECTURE">
                <option value="LECTURE">Lecture</option>
                <option value="LAB">Laboratory</option>
              </select>
            </Field>
          </div>
          <Field label="Building" htmlFor="r-bld">
            <input id="r-bld" name="building" className="input" />
          </Field>
        </>
      )}
      {kind === "offering" && (
        <>
          <p className="text-xs text-ink-500">
            Offerings link a subject, batch and faculty for the active term. Offered subjects appear
            in the timetable generator.
          </p>
          <Field label="Subject" htmlFor="o-subj">
            <select id="o-subj" name="subjectId" className="input" required>
              {subjects.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Batch" htmlFor="o-batch">
            <select id="o-batch" name="batchId" className="input" required>
              {batches.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </Field>
          <Field label="Faculty" htmlFor="o-fac">
            <select id="o-fac" name="facultyId" className="input" required>
              {faculty.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </Field>
          <Field label="Weekly sessions" htmlFor="o-week">
            <input id="o-week" name="weeklySessions" type="number" min={1} max={6} defaultValue={3} className="input" />
          </Field>
        </>
      )}
      <SubmitButton pendingText="Saving…">Create {kind}</SubmitButton>
    </form>
  );
}

export function BorrowButton({
  bookId,
  available,
}: {
  bookId: string;
  available: boolean;
}) {
  const [state, action] = useActionState(borrowBookAction, initialActionState);
  if (!available) return <span className="text-xs text-ink-400">Unavailable</span>;
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="bookId" value={bookId} />
      <SubmitButton variant="secondary" pendingText="…">Request</SubmitButton>
      {state.message ? (
        <span className={`text-xs ${state.ok ? "text-success-600" : "text-danger-600"}`}>
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

export function ReturnButton({ borrowRecordId }: { borrowRecordId: string }) {
  return (
    <InlineButton
      action={returnBookAction}
      fields={{ borrowRecordId }}
      label="Record return"
      pendingText="…"
      variant="secondary"
    />
  );
}

// ---------------------------------------------------------------------------
// Assistant
// ---------------------------------------------------------------------------

export function AssistantForm() {
  const [state, action] = useActionState(askAssistantAction, initialActionState);
  const data = state.data as
    | {
        question?: string;
        answer?: string;
        sources?: string[];
        intent?: string;
        refused?: boolean;
        via?: string | null;
        model?: string | null;
        fallbackReason?: string | null;
      }
    | undefined;
  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="question" className="sr-only">Ask the assistant</label>
        <input
          id="question"
          name="question"
          className="input flex-1"
          placeholder="e.g. What is my attendance? When is my next class?"
          required
        />
        <SubmitButton pendingText="Thinking…">Ask</SubmitButton>
      </form>
      {state.message && !state.ok ? <ActionFeedback state={state} /> : null}
      {data?.answer ? <AssistantAnswerCard data={data} /> : null}
    </div>
  );
}

/** Renders an assistant answer and how it was produced. */
function AssistantAnswerCard({
  data,
}: {
  data: {
    answer?: string;
    sources?: string[];
    refused?: boolean;
    via?: string | null;
    model?: string | null;
    fallbackReason?: string | null;
  };
}) {
  const via = data.via ?? "retrieval";
  return (
    <div className="rounded-lg border border-ink-100 bg-ink-50/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
        {data.refused ? "Refused" : "Answer"}
      </p>
      <p className="mt-1 whitespace-pre-line text-sm text-ink-700">{data.answer}</p>
      {data.sources && data.sources.length > 0 ? (
        <p className="mt-2 text-xs text-ink-500">Source: {data.sources.join(", ")}</p>
      ) : null}
      {via === "llm" ? (
        <p className="mt-2 text-xs font-medium text-brand-600">
          Answered by the AI model{data.model ? ` (${data.model})` : ""} using your own records and
          approved documents.
        </p>
      ) : null}
      {via === "fallback" ? (
        <p className="mt-2 text-xs font-medium text-amber-600">
          AI model unavailable right now ({data.fallbackReason ?? "temporarily unavailable"}) —
          showing verified stored data only.
        </p>
      ) : null}
      {via === "retrieval" || via === "guard" ? (
        <p className="mt-2 text-xs text-ink-400">
          Grounded assistant — it only uses approved documents and your own records.
        </p>
      ) : null}
    </div>
  );
}

export function LoginHelp(): ReactElement {
  return (
    <p className="text-xs text-ink-400">
      Need an account?{" "}
      <Link href="/login" className="text-brand-600 hover:underline">
        Contact the administration office
      </Link>
      .
    </p>
  );
}

// ---------------------------------------------------------------------------
// Lecture swaps
// ---------------------------------------------------------------------------

export function CreateSwapForm({
  mySlots,
  peerSlots,
}: {
  mySlots: Option[];
  peerSlots: Option[];
}) {
  const [state, action] = useActionState(createSwapRequestAction, initialActionState);
  return (
    <form action={action} className="space-y-3">
      <ActionFeedback state={state} />
      <Field label="My lecture" htmlFor="sw-requester" error={state.fieldErrors?.requesterSlotId}>
        <select id="sw-requester" name="requesterSlotId" className="input" required>
          <option value="">Select one of your lectures…</option>
          {mySlots.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Swap with"
        htmlFor="sw-recipient"
        error={state.fieldErrors?.recipientSlotId}
        hint="Only published lectures taught by other faculty are listed."
      >
        <select id="sw-recipient" name="recipientSlotId" className="input" required>
          <option value="">Select a lecture to swap with…</option>
          {peerSlots.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Reason (optional)" htmlFor="sw-reason">
        <textarea id="sw-reason" name="reason" rows={3} className="input" />
      </Field>
      <SubmitButton pendingText="Sending…">Request swap</SubmitButton>
    </form>
  );
}

export function SwapDecisionForm({ requestId }: { requestId: string }) {
  const [state, action] = useActionState(decideSwapAction, initialActionState);
  return (
    <form action={action} className="space-y-2">
      <ActionFeedback state={state} />
      <input type="hidden" name="requestId" value={requestId} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="decision" value="ACCEPT" pendingText="Accepting…">
          Accept
        </SubmitButton>
        <SubmitButton
          name="decision"
          value="REJECT"
          variant="secondary"
          pendingText="Declining…"
        >
          Decline
        </SubmitButton>
      </div>
    </form>
  );
}

export function CancelSwapForm({ requestId }: { requestId: string }) {
  return (
    <InlineButton
      action={cancelSwapRequestAction}
      fields={{ requestId }}
      label="Withdraw"
      pendingText="…"
      variant="ghost"
    />
  );
}

// ---------------------------------------------------------------------------
// Lecture cancellation
// ---------------------------------------------------------------------------

export function CancelLectureForm({
  slots,
}: {
  slots: { value: string; label: string; day: number }[];
}) {
  const [state, action] = useActionState(cancelLectureAction, initialActionState);
  return (
    <form action={action} className="space-y-3">
      <ActionFeedback state={state} />
      <Field label="Lecture" htmlFor="cl-slot" error={state.fieldErrors?.slotId}>
        <select id="cl-slot" name="slotId" className="input" required>
          <option value="">Select a published lecture…</option>
          {slots.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Date"
        htmlFor="cl-date"
        error={state.fieldErrors?.date}
        hint="Must be a weekday date matching the lecture's scheduled day (YYYY-MM-DD)."
      >
        <input id="cl-date" type="date" name="date" className="input" required />
      </Field>
      <Field label="Reason (optional)" htmlFor="cl-reason">
        <textarea id="cl-reason" name="reason" rows={3} className="input" />
      </Field>
      <SubmitButton variant="danger" pendingText="Cancelling…">
        Cancel this lecture
      </SubmitButton>
      <p className="text-xs text-ink-400">
        Cancels a single occurrence only. Attendance and marks already recorded are not
        changed.
      </p>
    </form>
  );
}
