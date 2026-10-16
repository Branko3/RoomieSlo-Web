import type { CohabitationClient } from "../lib/cohabitation/cohabitation";
import type { RatingClient } from "../lib/ratings/ratings";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

/** Query keys; invalidating `COHABITATIONS_KEY` refreshes the chat, the chat list and the profile. */
export const COHABITATIONS_KEY = ["cohabitations"] as const;
export const MY_COHABITATIONS_KEY = ["cohabitations", "mine"] as const;
export const matchCohabitationsKey = (matchId: string) =>
  ["cohabitations", "match", matchId] as const;

export function cohabitationClient() {
  return createSupabaseBrowserClient() as unknown as CohabitationClient;
}

/** Rating query keys; invalidating `RATINGS_KEY` refreshes my ratings and my summary. */
export const RATINGS_KEY = ["ratings"] as const;
export const MY_RATING_SUMMARY_KEY = ["ratings", "summary"] as const;
export const myRatingKey = (cohabitationId: string) =>
  ["ratings", "mine", cohabitationId] as const;

export function ratingClient() {
  return createSupabaseBrowserClient() as unknown as RatingClient;
}
