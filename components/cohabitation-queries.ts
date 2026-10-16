import type { CohabitationClient } from "../lib/cohabitation/cohabitation";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

/** Query keys; invalidating `COHABITATIONS_KEY` refreshes the chat, the chat list and the profile. */
export const COHABITATIONS_KEY = ["cohabitations"] as const;
export const MY_COHABITATIONS_KEY = ["cohabitations", "mine"] as const;
export const matchCohabitationsKey = (matchId: string) =>
  ["cohabitations", "match", matchId] as const;

export function cohabitationClient() {
  return createSupabaseBrowserClient() as unknown as CohabitationClient;
}
