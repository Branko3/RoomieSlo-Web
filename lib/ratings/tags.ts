/**
 * Roommate rating tags (plan §4.2). The keys are stored in the database and
 * must match `rating_strength_tags()` / `rating_improvement_tags()` in
 * migration 20261016000100; their order is the display and tie-break order.
 * Tags describe behaviour, not character, so they read as feedback.
 */

export const STRENGTH_TAGS = [
  "reliable_costs",
  "clean_tidy",
  "respects_quiet",
  "good_communication",
  "keeps_agreements",
  "pleasant",
] as const;

export const IMPROVEMENT_TAGS = [
  "costs",
  "cleanliness",
  "noise",
  "communication",
  "agreements",
  "visitors",
] as const;

export type StrengthTag = (typeof STRENGTH_TAGS)[number];
export type ImprovementTag = (typeof IMPROVEMENT_TAGS)[number];

// Labels are in the "ratings" catalog: m.ratings.strengths (public in
// aggregate) and m.ratings.improvements (private: only the rated person sees
// them, in aggregate).

export const MAX_TAGS = 3;

export function isStrengthTag(value: unknown): value is StrengthTag {
  return (STRENGTH_TAGS as readonly unknown[]).includes(value);
}

export function isImprovementTag(value: unknown): value is ImprovementTag {
  return (IMPROVEMENT_TAGS as readonly unknown[]).includes(value);
}

export type TagProblem = "too-many" | "unknown" | "duplicate";

/** Mirrors the server's tag check: at most 3, distinct, from the fixed set. */
export function tagProblem(
  tags: readonly string[],
  allowed: readonly string[],
): TagProblem | null {
  if (tags.some((tag) => !allowed.includes(tag))) return "unknown";
  if (new Set(tags).size !== tags.length) return "duplicate";
  if (tags.length > MAX_TAGS) return "too-many";
  return null;
}

/** Tags in their fixed order (what the form sends). */
export function inTagOrder<T extends string>(
  tags: readonly T[],
  order: readonly T[],
): T[] {
  return order.filter((tag) => tags.includes(tag));
}
