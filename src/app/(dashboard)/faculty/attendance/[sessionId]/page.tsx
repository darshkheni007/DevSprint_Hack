import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/guard";
import { getSessionForRecording } from "@/lib/services/attendance-service";
import { Card, PageHeader } from "@/components/ui";
import { RecordAttendanceForm } from "@/components/forms";
import { DAYS } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export default async function RecordAttendancePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const actor = await requirePageRole("FACULTY");
  const { sessionId } = await params;

  let data;
  try {
    data = await getSessionForRecording(actor, sessionId);
  } catch {
    notFound();
  }

  const { session, students, existing } = data;

  return (
    <>
      <PageHeader
        title={`Attendance — ${session.offering.subject.code}`}
        description={`${session.offering.subject.name} · ${session.offering.batch.name} · ${formatDate(session.date)} · ${DAYS.find((d) => d.value === session.day)?.label} P${session.periodIndex}`}
        actions={<Link href="/faculty/attendance" className="btn-secondary">Back to sessions</Link>}
      />

      <Card
        title={`Students (${students.length})`}
        description="Mark each student present or absent, then save. Existing marks are pre-selected."
      >
        {students.length === 0 ? (
          <p className="text-sm text-ink-500">No students are enrolled in this batch.</p>
        ) : (
          <RecordAttendanceForm sessionId={session.id} students={students} existing={existing} />
        )}
      </Card>
    </>
  );
}
