import { SUMMARY_THRESHOLD } from "./rules";
import {
  improvementLabels,
  isImprovementTag,
  isStrengthTag,
  MAX_TAGS,
  strengthLabels,
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

/**
 * Slovenian noun form for a rating count ("1 ocena", "2 oceni", "3 ocene",
 * "5 ocen"), following the last two digits like `listingCountLabel`.
 */
export function ratingNoun(n: number): string {
  const lastTwo = Math.abs(Math.trunc(n)) % 100;
  if (lastTwo === 1) return "ocena";
  if (lastTwo === 2) return "oceni";
  if (lastTwo === 3 || lastTwo === 4) return "ocene";
  return "ocen";
}

export function ratingCountLabel(n: number): string {
  return `${n} ${ratingNoun(n)}`;
}

export const ratingCopy = {
  insufficient: "Še ni dovolj ocen",
  none: "Še nimaš ocen.",
  improvementsTitle: "Področja za izboljšanje",
  anonymity:
    "Ocena je anonimna in vidna šele, ko oceni tudi druga oseba ali po 14 dneh.",
} as const;

/** "3 od 4 sostanovalcev bi spet živeli s to osebo" */
export function shownHeadline(summary: {
  total: number;
  wouldLiveAgain: number;
}): string {
  return `${summary.wouldLiveAgain} od ${summary.total} sostanovalcev bi spet živeli s to osebo`;
}

/**
 * The one line other people see; null when the person hasn't turned ratings
 * on (the default), so nothing about ratings is shown for them.
 */
export function summaryHeadline(summary: RatingSummary): string | null {
  switch (summary.state) {
    case "hidden":
      return null;
    case "insufficient":
      return ratingCopy.insufficient;
    case "shown":
      return shownHeadline(summary);
  }
}

/** My own count below the threshold: "2 oceni, prikazane bodo od 3 dalje". */
export function belowThresholdLabel(n: number): string {
  return n === 0
    ? ratingCopy.none
    : `${ratingCountLabel(n)}, prikazane bodo od ${SUMMARY_THRESHOLD} dalje`;
}

/** "Čist(a) in urejen(a) · 3" */
export function strengthCountLabel({ tag, count: n }: TagCount<StrengthTag>) {
  return `${strengthLabels[tag]} · ${n}`;
}

export function improvementCountLabel({
  tag,
  count: n,
}: TagCount<ImprovementTag>) {
  return `${improvementLabels[tag]} · ${n}`;
}
