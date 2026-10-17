import { requirePageRole } from "@/lib/guard";
import {
  getActiveTerm,
  listBatches,
  listClassrooms,
  listCourses,
  listDepartments,
  listFacultyUsers,
  listOfferings,
  listSubjects,
  listTerms,
} from "@/lib/services/academic-service";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { SimpleCreateForm } from "@/components/forms";

export default async function AdminAcademicPage() {
  const actor = await requirePageRole("ADMIN");
  void actor;
  const [
    departments,
    courses,
    subjects,
    batches,
    classrooms,
    faculty,
    terms,
    activeTerm,
  ] = await Promise.all([
    listDepartments(),
    listCourses(),
    listSubjects(),
    listBatches(),
    listClassrooms(),
    listFacultyUsers(),
    listTerms(),
    getActiveTerm(),
  ]);
  const offerings = activeTerm ? await listOfferings(activeTerm.id) : [];

  const dept = (id: string) => departments.find((d) => d.id === id);
  const deptOptions = departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }));
  const courseOptions = courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }));
  const termOptions = terms.map((t) => ({ value: t.id, label: t.name }));
  const subjectOptions = subjects.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }));
  const batchOptions = batches.map((b) => ({ value: b.id, label: b.name }));
  const facultyOptions = faculty.map((f) => ({
    value: f.id,
    label: `${f.firstName} ${f.lastName}`,
  }));

  return (
    <>
      <PageHeader
        title="Academic structure"
        description="Departments, courses, subjects, batches, classrooms and subject offerings."
      />

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card title="Add department">
          <SimpleCreateForm kind="department" />
        </Card>
        <Card title="Add course">
          <SimpleCreateForm kind="course" departments={deptOptions} />
        </Card>
        <Card title="Add subject">
          <SimpleCreateForm kind="subject" departments={deptOptions} courses={courseOptions} />
        </Card>
        <Card title="Add batch">
          <SimpleCreateForm kind="batch" courses={courseOptions} terms={termOptions} />
        </Card>
        <Card title="Add classroom">
          <SimpleCreateForm kind="classroom" />
        </Card>
        <Card title="Create offering" description={`Active term: ${activeTerm?.name ?? "none"}`}>
          <SimpleCreateForm
            kind="offering"
            subjects={subjectOptions}
            batches={batchOptions}
            faculty={facultyOptions}
          />
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title={`Departments (${departments.length})`}>
          {departments.length === 0 ? (
            <EmptyState title="No departments" />
          ) : (
            <ul className="divide-y divide-ink-100 text-sm">
              {departments.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2">
                  <span className="font-mono text-xs text-ink-500">{d.code}</span>
                  <span className="text-ink-700">{d.name}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Courses (${courses.length})`}>
          {courses.length === 0 ? (
            <EmptyState title="No courses" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Code</th><th>Name</th><th>Department</th><th>Years</th></tr>
                </thead>
                <tbody>
                  {courses.map((c) => (
                    <tr key={c.id}>
                      <td className="font-mono text-xs">{c.code}</td>
                      <td>{c.name}</td>
                      <td className="text-xs text-ink-500">{dept(c.departmentId)?.name ?? "—"}</td>
                      <td>{c.durationYears}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title={`Subjects (${subjects.length})`}>
          {subjects.length === 0 ? (
            <EmptyState title="No subjects" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Code</th><th>Name</th><th>Sem</th><th>Credits</th><th>Type</th></tr>
                </thead>
                <tbody>
                  {subjects.map((s) => (
                    <tr key={s.id}>
                      <td className="font-mono text-xs">{s.code}</td>
                      <td>{s.name}</td>
                      <td>{s.semester}</td>
                      <td>{s.credits}</td>
                      <td>{s.isLab ? <Badge tone="info">Lab</Badge> : "Theory"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title={`Batches (${batches.length})`}>
          {batches.length === 0 ? (
            <EmptyState title="No batches" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Course</th><th>Sem</th><th>Strength</th></tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id}>
                      <td className="font-medium text-ink-800">{b.name}</td>
                      <td className="text-xs text-ink-500">{b.course.code}</td>
                      <td>{b.semester}</td>
                      <td>{b.strength}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title={`Classrooms (${classrooms.length})`}>
          {classrooms.length === 0 ? (
            <EmptyState title="No classrooms" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Code</th><th>Name</th><th>Type</th><th>Capacity</th></tr>
                </thead>
                <tbody>
                  {classrooms.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono text-xs">{r.code}</td>
                      <td>{r.name}</td>
                      <td>{r.type === "LAB" ? <Badge tone="info">Lab</Badge> : "Lecture"}</td>
                      <td>{r.capacity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title={`Offerings — ${activeTerm?.name ?? "no active term"} (${offerings.length})`}>
          {offerings.length === 0 ? (
            <EmptyState
              title="No offerings"
              description="Create offerings to make subjects schedulable in the timetable."
              icon="layers"
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Subject</th><th>Batch</th><th>Faculty</th><th>Weekly</th></tr>
                </thead>
                <tbody>
                  {offerings.map((o) => (
                    <tr key={o.id}>
                      <td className="font-mono text-xs">{o.subject.code}</td>
                      <td className="text-xs">{o.batch.name}</td>
                      <td className="text-xs text-ink-600">{o.faculty.firstName} {o.faculty.lastName}</td>
                      <td>{o.weeklySessions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
