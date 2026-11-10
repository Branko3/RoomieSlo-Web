import type { I18n } from "../i18n/i18n";
import { SUMMARY_THRESHOLD } from "./rules";
import {
  isImprovementTag,
  isStrengthTag,
  MAX_TAGS,
  type ImprovementTag,
  type StrengthTag,
} from "./tags";

/**
 * Rating summaries as `rating_summary` and `my_rating_summary` return them:
 * aggregates only, never who gave which rating.
 */

export type TagCount<T extends string> = { tag: T; count: number };

/** What other users see (profile, recommendation card). */
export type RatingSummary =
  | { state: "hidden" }
  | { state: "insufficient" }
  | {
      state: "shown";
      total: number;
      wouldLiveAgain: number;
      /** At most 3, most frequent first. */
      strengths: TagCount<StrengthTag>[];
    };

/** What the rated person sees about themselves. */
export type MyRatingSummary =
  | { state: "insufficient"; count: number; visible: boolean }
  | {
      state: "shown";
      total: number;
      wouldLiveAgain: number;
      strengths: TagCount<StrengthTag>[];
      /** Private "Področja za izboljšanje", most frequent first. */
      improvements: TagCount<ImprovementTag>[];
      visible: boolean;
    };

const count = (value: unknown, max = Infinity): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;

function tagCounts<T extends string>(
  value: unknown,
  isTag: (tag: unknown) => tag is T,
  total: number,
  max: number,
): TagCount<T>[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  const result: TagCount<T>[] = [];
  for (const item of value) {
    const { tag, count: n } = (item ?? {}) as Record<string, unknown>;
    if (!isTag(tag) || !count(n, total) || n === 0) return null;
    if (result.some((r) => r.tag === tag)) return null;
    result.push({ tag, count: n });
  }
  return result;
}

function shownFields(v: Record<string, unknown>) {
  const total = v.total;
  if (!count(total) || total < SUMMARY_THRESHOLD) return null;
  if (!count(v.would_live_again, total)) return null;
  const strengths = tagCounts(v.strengths, isStrengthTag, total, MAX_TAGS);
  if (!strengths) return null;
  return { total, wouldLiveAgain: v.would_live_again as number, strengths };
}

/** Validates a public summary; null when the shape is unexpected. */
export function parseRatingSummary(value: unknown): RatingSummary | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.state === "hidden") return { state: "hidden" };
  if (v.state === "insufficient") return { state: "insufficient" };
  if (v.state !== "shown") return null;
  const fields = shownFields(v);
  return fields ? { state: "shown", ...fields } : null;
}

/** Validates my own summary; null when the shape is unexpected. */
export function parseMyRatingSummary(value: unknown): MyRatingSummary | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.visible !== "boolean") return null;
  if (v.state === "insufficient")
    return count(v.count) && v.count < SUMMARY_THRESHOLD
      ? { state: "insufficient", count: v.count, visible: v.visible }
      : null;
  if (v.state !== "shown") return null;
  const fields = shownFields(v);
  if (!fields) return null;
  const improvements = tagCounts(
    v.improvements,
    isImprovementTag,
    fields.total,
    Infinity,
  );
  return improvements
    ? { state: "shown", ...fields, improvements, visible: v.visible }
    : null;
}

/** The catalog access the summary lines need: `useI18n()` or `getI18n()`. */
export type RatingText = Pick<I18n, "m" | "format" | "plural">;

/** "1 ocena", "2 oceni", "3 ocene", "5 ocen" / "1 rating", "5 ratings". */
export function ratingCountLabel(n: number, { m, plural }: RatingText): string {
  return plural(m.ratings.count, n);
}

/** "3 od 4 sostanovalcev bi spet živeli s to osebo" */
export function shownHeadline(
  summary: { total: number; wouldLiveAgain: number },
  { m, format }: RatingText,
): string {
  return format(m.ratings.shownHeadline, {
    wouldLiveAgain: summary.wouldLiveAgain,
    total: summary.total,
  });
}

/**
 * The one line other people see; null when the person hasn't turned ratings
 * on (the default), so nothing about ratings is shown for them.
 */
export function summaryHeadline(
  summary: RatingSummary,
  text: RatingText,
): string | null {
  switch (summary.state) {
    case "hidden":
      return null;
    case "insufficient":
      return text.m.ratings.insufficient;
    case "shown":
      return shownHeadline(summary, text);
  }
}

/** My own count below the threshold: "2 oceni, prikazane bodo od 3 dalje". */
export function belowThresholdLabel(n: number, text: RatingText): string {
  return n === 0
    ? text.m.ratings.none
    : text.format(text.m.ratings.belowThreshold, {
        ratings: ratingCountLabel(n, text),
        threshold: SUMMARY_THRESHOLD,
      });
}

/** "Čist(a) in urejen(a) · 3" */
export function strengthCountLabel(
  { tag, count: n }: TagCount<StrengthTag>,
  { m, format }: RatingText,
) {
  return format(m.ratings.tagCount, {
    label: m.ratings.strengths[tag],
    count: n,
  });
}

export function improvementCountLabel(
  { tag, count: n }: TagCount<ImprovementTag>,
  { m, format }: RatingText,
) {
  return format(m.ratings.tagCount, {
    label: m.ratings.improvements[tag],
    count: n,
  });
}
