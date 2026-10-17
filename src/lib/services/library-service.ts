import { prisma } from "../db";
import { writeAudit } from "../audit";
import { NotFoundError, ValidationError } from "../errors";
import { Actor, authorize } from "../permissions";

const LOAN_DAYS = 14;

/** Searchable catalogue with availability (M12-R01/R02). */
export async function searchBooks(query?: string, category?: string) {
  return prisma.book.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query } },
              { author: { contains: query } },
              { isbn: { contains: query } },
              { category: { contains: query } },
            ],
          }
        : {}),
    },
    orderBy: { title: "asc" },
  });
}

export async function listCategories(): Promise<string[]> {
  const rows = await prisma.book.findMany({
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return rows.map((r) => r.category);
}

/**
 * Borrow a book (M12-R02/R03). Students borrow for themselves; Admin can issue
 * on behalf of any user. Rejects unavailable copies.
 */
export async function borrowBook(
  actor: Actor,
  input: { bookId: string; userId?: string; dueDate?: string },
) {
  authorize(actor, "library:borrow");
  const book = await prisma.book.findUnique({ where: { id: input.bookId } });
  if (!book) throw new NotFoundError("Book not found.");
  if (book.availableCopies <= 0) {
    throw new ValidationError("This book is currently unavailable.");
  }

  const borrowerId =
    actor.role === "STUDENT" ? actor.id : input.userId ?? actor.id;

  const dueDate = input.dueDate
    ? new Date(input.dueDate)
    : new Date(Date.now() + LOAN_DAYS * 24 * 60 * 60 * 1000);
  if (Number.isNaN(dueDate.getTime())) {
    throw new ValidationError("Please provide a valid due date.");
  }

  const record = await prisma.borrowRecord.create({
    data: {
      bookId: book.id,
      userId: borrowerId,
      dueDate,
      status: "BORROWED",
    },
  });
  await prisma.book.update({
    where: { id: book.id },
    data: { availableCopies: { decrement: 1 } },
  });

  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "library.borrow",
    entityType: "BorrowRecord",
    entityId: record.id,
    summary: `Issued "${book.title}"`,
  });
  return record;
}

/** Record a return (M12-R04): closes the record and restores availability. */
export async function returnBook(actor: Actor, borrowRecordId: string) {
  authorize(actor, "library:manage");
  const record = await prisma.borrowRecord.findUnique({
    where: { id: borrowRecordId },
  });
  if (!record) throw new NotFoundError("Borrow record not found.");
  if (record.returnedAt) throw new ValidationError("This book is already returned.");

  await prisma.borrowRecord.update({
    where: { id: borrowRecordId },
    data: { returnedAt: new Date(), status: "RETURNED" },
  });
  await prisma.book.update({
    where: { id: record.bookId },
    data: { availableCopies: { increment: 1 } },
  });
  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "library.return",
    entityType: "BorrowRecord",
    entityId: borrowRecordId,
    summary: "Recorded book return",
  });
}

/** A student's own borrowing records (M12-R06). */
export async function listMyBorrows(actor: Actor) {
  const rows = await prisma.borrowRecord.findMany({
    where: { userId: actor.id },
    include: { book: true },
    orderBy: { borrowedAt: "desc" },
  });
  return rows.map((r) => ({
    ...r,
    overdue: r.status !== "RETURNED" && r.dueDate.getTime() < Date.now(),
  }));
}

/** Admin view of all borrowing records. */
export async function listAllBorrows(actor: Actor) {
  authorize(actor, "library:manage");
  const rows = await prisma.borrowRecord.findMany({
    include: { book: true, user: { select: { firstName: true, lastName: true, role: true } } },
    orderBy: { borrowedAt: "desc" },
    take: 200,
  });
  return rows.map((r) => ({
    ...r,
    overdue: r.status !== "RETURNED" && r.dueDate.getTime() < Date.now(),
  }));
}
