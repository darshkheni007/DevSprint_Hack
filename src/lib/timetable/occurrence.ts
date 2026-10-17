/**
 * Date helpers for lecture occurrences.
 *
 * The working week is Monday(1) .. Saturday(6) (see DAYS in constants.ts), while
 * JavaScript's `getUTCDay()` is Sunday(0) .. Saturday(6). All dates are
 * normalised to UTC midnight so a `(slotId, date)` cancellation key is stable.
 */

/** Parse a strict `YYYY-MM-DD` string into a UTC-midnight Date. Throws on bad input. */
export function parseDateKey(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Invalid date");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject rolled-over dates such as 2026-02-31.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Invalid date");
  }
  return date;
}

/** Strip any time component, keeping the UTC calendar day. */
export function utcMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * Map a date to the project's weekday number: 1=Monday .. 6=Saturday.
 * Sunday returns 7, which is outside the Mon–Sat working week (callers reject it).
 */
export function weekdayNumber(date: Date): number {
  return ((date.getUTCDay() + 6) % 7) + 1;
}

/** Stable `YYYY-MM-DD` key for a Date (used in idempotency keys and displays). */
export function dateKey(date: Date): string {
  return utcMidnight(date).toISOString().slice(0, 10);
}
