import { requirePageRole } from "@/lib/guard";
import { listCategories, listMyBorrows, searchBooks } from "@/lib/services/library-service";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { BorrowButton } from "@/components/forms";
import { formatDate } from "@/lib/format";

export default async function StudentLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const actor = await requirePageRole("STUDENT");
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const category = params.category || undefined;

  const [books, categories, borrows] = await Promise.all([
    searchBooks(q, category),
    listCategories(),
    listMyBorrows(actor),
  ]);

  const active = borrows.filter((b) => b.status !== "RETURNED");
  const overdue = borrows.filter((b) => b.overdue);

  return (
    <>
      <PageHeader
        title="Library"
        description="Search the catalogue, request books and track your loans."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Books on loan" value={active.length} icon="book" tone={active.length ? "warn" : "success"} />
        <StatCard label="Overdue" value={overdue.length} icon="warning" tone={overdue.length ? "danger" : "success"} />
        <StatCard label="Catalogue" value={books.length} icon="search" tone="neutral" hint="matching titles" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Catalogue" description="Search by title, author, ISBN or category" className="lg:col-span-2">
          <form method="get" className="mb-3 flex flex-wrap items-center gap-2">
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search the catalogue"
              className="input w-52 py-1.5 text-xs"
            />
            <select name="category" defaultValue={category ?? ""} className="input py-1.5 text-xs">
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button type="submit" className="btn-secondary py-1.5 text-xs">Search</button>
          </form>

          {books.length === 0 ? (
            <EmptyState title="No books found" description="Try a different search term." icon="book" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Title</th><th>Author</th><th>Category</th><th>Available</th><th /></tr>
                </thead>
                <tbody>
                  {books.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <p className="font-medium text-ink-800">{b.title}</p>
                        <p className="text-xs text-ink-400">{b.isbn}</p>
                      </td>
                      <td className="text-xs text-ink-600">{b.author}</td>
                      <td className="text-xs text-ink-500">{b.category}</td>
                      <td>
                        <Badge tone={b.availableCopies > 0 ? "success" : "danger"}>
                          {b.availableCopies}/{b.totalCopies}
                        </Badge>
                      </td>
                      <td className="text-right">
                        <BorrowButton bookId={b.id} available={b.availableCopies > 0} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="My loans">
          {borrows.length === 0 ? (
            <EmptyState title="No books borrowed" icon="book" />
          ) : (
            <ul className="space-y-3">
              {borrows.map((b) => (
                <li key={b.id} className="border-b border-ink-100 pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-ink-800">{b.book.title}</p>
                  <p className="mt-0.5 text-xs text-ink-500">Due {formatDate(b.dueDate)}</p>
                  <div className="mt-1">
                    <Badge tone={b.status === "RETURNED" ? "success" : b.overdue ? "danger" : "info"}>
                      {b.status === "RETURNED" ? "Returned" : b.overdue ? "Overdue" : "On loan"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
