import type { Cohabitation } from "../cohabitation/cohabitation";
import { addMonths, monthStart } from "../cohabitation/months";

/**
 * Rating window and update rules, mirroring migration 20261016000100 so the UI
 * can explain what is possible. The server checks every rule again.
 */

export const WINDOW_OPENS_AFTER_MONTHS = 2;
export const WINDOW_CLOSES_AFTER_DAYS = 60;
export const UPDATE_AFTER_MONTHS = 6;
export const REVEAL_AFTER_DAYS = 14;
export const CLOSING_SOON_DAYS = 7;
export const SUMMARY_THRESHOLD = 3;
export const COUNTED_MONTHS = 36;

const DAY = 24 * 60 * 60 * 1000;

type WindowSource = Pick<
  Cohabitation,
  "status" | "startedMonth" | "endedAt" | "confirmedAt"
>;

export type RatingWindow = {
  opensAt: Date;
  /** Null while the two still live together. */
  closesAt: Date | null;
  state: "not-yet" | "open" | "closed";
};

/**
 * Opens 2 months after the move-in month, or when the cohabitation ended if
 * that's sooner; closes 60 days after the end. Null for a cohabitation that
 * was never confirmed (only confirmed cohabitants rate).
 */
export function ratingWindow(
  cohabitation: WindowSource,
  now: Date = new Date(),
): RatingWindow | null {
  const confirmed =
    (cohabitation.status === "active" || cohabitation.status === "ended") &&
    cohabitation.confirmedAt !== null;
  if (!confirmed) return null;
  const twoMonths = monthStart(
    addMonths(cohabitation.startedMonth, WINDOW_OPENS_AFTER_MONTHS),
  );
  const ended = cohabitation.endedAt ? new Date(cohabitation.endedAt) : null;
  const opensAt = ended && ended < twoMonths ? ended : twoMonths;
  const closesAt = ended
    ? new Date(ended.getTime() + WINDOW_CLOSES_AFTER_DAYS * DAY)
    : null;
  const state =
    now < opensAt ? "not-yet" : closesAt && now > closesAt ? "closed" : "open";
  return { opensAt, closesAt, state };
}

/** The same date `months` calendar months later (as Postgres adds intervals). */
export function addCalendarMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

type OwnRating = { status: "hidden" | "revealed"; submittedAt: string };

export type RatingAction =
  /** Not confirmed, window not open yet, or closed without a rating. */
  | { kind: "unavailable"; window: RatingWindow | null }
  | { kind: "rate"; window: RatingWindow }
  /** Still hidden: can be changed freely while the window is open. */
  | { kind: "edit"; window: RatingWindow }
  /** Revealed, still living together, 6 months since the last submission. */
  | { kind: "update"; window: RatingWindow }
  /** Revealed and not changeable now; `until` is when an update becomes possible, if ever. */
  | { kind: "locked"; window: RatingWindow; until: Date | null };

export function ratingAction(
  cohabitation: WindowSource,
  mine: OwnRating | null,
  now: Date = new Date(),
): RatingAction {
  const window = ratingWindow(cohabitation, now);
  if (!window || window.state === "not-yet")
    return { kind: "unavailable", window };
  if (!mine)
    return window.state === "open"
      ? { kind: "rate", window }
      : { kind: "unavailable", window };
  if (window.state === "open" && mine.status === "hidden")
    return { kind: "edit", window };
  const nextUpdate =
    cohabitation.status === "active"
      ? addCalendarMonths(new Date(mine.submittedAt), UPDATE_AFTER_MONTHS)
      : null;
  if (window.state === "open" && nextUpdate && nextUpdate <= now)
    return { kind: "update", window };
  return {
    kind: "locked",
    window,
    until: window.state === "open" ? nextUpdate : null,
  };
}

/** The chat reminder: when the window opens, and again 7 days before it closes. */
export function ratingReminder(
  action: RatingAction,
  now: Date = new Date(),
): "open" | "closing" | null {
  if (action.kind !== "rate") return null;
  const { closesAt } = action.window;
  return closesAt &&
    closesAt.getTime() - now.getTime() <= CLOSING_SOON_DAYS * DAY
    ? "closing"
    : "open";
}
