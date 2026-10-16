/**
 * Months for cohabitation declarations. A month is the ISO date of its first
 * day ("2026-10-01"), the same value Postgres stores in `started_month` and
 * `ended_month`. "Now" is read in Slovenian time, like the database RPCs do
 * (`cohabitation_current_month()`), so the client and the server agree on
 * which month is current.
 */

export const COHABITATION_TIME_ZONE = "Europe/Ljubljana";

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])-01$/;

/** Slovenian month abbreviations ("maj" is short enough to stay whole). */
export const MONTH_ABBREVIATIONS = [
  "jan.",
  "feb.",
  "mar.",
  "apr.",
  "maj",
  "jun.",
  "jul.",
  "avg.",
  "sep.",
  "okt.",
  "nov.",
  "dec.",
] as const;

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH.test(value);
}

function zonedParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: COHABITATION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

function toMonth(year: number, month: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
}

/** The month (in Slovenian time) a timestamp falls in; null for an invalid date. */
export function monthOf(value: Date | string): string | null {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  const { year, month } = zonedParts(date);
  return toMonth(year, month);
}

export function currentMonth(now: Date = new Date()): string {
  return monthOf(now) as string;
}

/** Moves a month by `count` months (negative goes back). */
export function addMonths(month: string, count: number): string {
  const [, year, number] = MONTH.exec(month) ?? [];
  const index = Number(year) * 12 + Number(number) - 1 + count;
  return toMonth(Math.floor(index / 12), (index % 12) + 1);
}

/** Every month from `to` back to `from`, newest first; empty when `from` is after `to`. */
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  for (let month = to; month >= from; month = addMonths(month, -1))
    months.push(month);
  return months;
}

/** "okt. 2026" */
export function monthLabel(month: string): string {
  const [, year, number] = MONTH.exec(month) ?? [];
  if (!year) return month;
  return `${MONTH_ABBREVIATIONS[Number(number) - 1]} ${year}`;
}

/** "okt. 2026 – jan. 2027", or "od okt. 2026" while it lasts. */
export function monthSpanLabel(started: string, ended: string | null): string {
  return ended
    ? `${monthLabel(started)} – ${monthLabel(ended)}`
    : `od ${monthLabel(started)}`;
}

/** "15. 11. 2026", in Slovenian time. */
export function dateLabel(date: Date): string {
  const { year, month, day } = zonedParts(date);
  return `${day}. ${month}. ${year}`;
}

export type MonthProblem =
  "not-a-month" | "future" | "before-match" | "before-start";

/**
 * Move-in month rules: a month, not in the future, and not before the month
 * the match was created (the match's creation time, when known).
 */
export function startedMonthProblem(
  month: string,
  matchCreatedAt: string | null,
  now: Date = new Date(),
): MonthProblem | null {
  if (!isMonth(month)) return "not-a-month";
  if (month > currentMonth(now)) return "future";
  const matchMonth = matchCreatedAt ? monthOf(matchCreatedAt) : null;
  if (matchMonth && month < matchMonth) return "before-match";
  return null;
}

/** End month rules: a month, not before the move-in month, not in the future. */
export function endedMonthProblem(
  month: string,
  startedMonth: string,
  now: Date = new Date(),
): MonthProblem | null {
  if (!isMonth(month)) return "not-a-month";
  if (month < startedMonth) return "before-start";
  if (month > currentMonth(now)) return "future";
  return null;
}

/** Choices for the move-in month picker, newest first. */
export function startedMonthOptions(
  matchCreatedAt: string | null,
  now: Date = new Date(),
): string[] {
  const current = currentMonth(now);
  const matchMonth = matchCreatedAt ? monthOf(matchCreatedAt) : null;
  // Without the match date, offer the last year; the server still checks.
  return monthsBetween(matchMonth ?? addMonths(current, -11), current);
}

/** Choices for the end month picker, newest first. */
export function endedMonthOptions(
  startedMonth: string,
  now: Date = new Date(),
): string[] {
  return monthsBetween(startedMonth, currentMonth(now));
}
