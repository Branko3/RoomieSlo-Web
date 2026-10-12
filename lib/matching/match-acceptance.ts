import type { MatchStatus } from "../supabase/types";
import {
  MATCH_COLUMNS,
  matchMessages,
  MatchRequestError,
  respondToMatch,
  type MatchClient,
  type MatchRecord,
} from "./match-requests";

type DbError = { code?: string; message?: string; status?: number } | null;

/** Additional client surface: the atomic accept RPC. */
export type MatchAcceptanceClient = MatchClient & {
  rpc: (
    fn: "accept_match",
    args: { p_match_id: string },
  ) => PromiseLike<{ data: MatchRecord | null; error: DbError }>;
};

/** Single-row read of a match, used to explain a conflict. */
type MatchReadClient = {
  from: (table: "matches") => {
    select: (columns: string) => {
      eq: (
        column: "id",
        value: string,
      ) => {
        maybeSingle: () => PromiseLike<{
          data: MatchRecord | null;
          error: DbError;
        }>;
      };
    };
  };
};

/** What the user is told after a conflict, based on the row's state now. */
export function conflictMessage(current: MatchStatus | null): string {
  switch (current) {
    case "accepted":
      return "Zahteva je že sprejeta.";
    case "rejected":
      return "Zahteva je bila medtem zavrnjena.";
    case null:
      return "Zahteva ne obstaja več.";
    case "pending":
      return "Te zahteve ne moreš sprejeti.";
  }
}

/**
 * `accept_match` raises `match is unavailable or caller is not a participant`
 * (SQLSTATE P0001) when the row is no longer pending or the caller is not part
 * of it; that is a conflict, not a technical failure.
 */
export function isAcceptConflict(error: DbError): boolean {
  if (!error) return false;
  return (
    error.code === "P0001" ||
    /unavailable|not a participant/i.test(error.message ?? "")
  );
}

function isNetworkError(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? "";
  return error instanceof TypeError || /fetch|network/i.test(message);
}

/** Reads the current state of one match (null when it no longer exists or is hidden by RLS). */
export async function readMatchStatus(
  client: MatchAcceptanceClient,
  matchId: string,
): Promise<MatchStatus | null> {
  const { data, error } = await (client as unknown as MatchReadClient)
    .from("matches")
    .select(MATCH_COLUMNS)
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw error;
  return data?.status ?? null;
}

async function conflictFor(client: MatchAcceptanceClient, matchId: string) {
  let current: MatchStatus | null;
  try {
    current = await readMatchStatus(client, matchId);
  } catch {
    // Could not tell what happened; fall back to the Android wording.
    return new MatchRequestError("conflict", matchMessages.alreadyHandled);
  }
  return new MatchRequestError("conflict", conflictMessage(current));
}

/**
 * Accepts a request atomically through the `accept_match` RPC, which updates
 * the row only while it is pending and bumps its version in the same
 * statement, so two concurrent accepts (two tabs, or an accept racing a reject)
 * can never both succeed. On a conflict the row is re-read and the user is told
 * what actually happened. Returns the accepted row.
 */
export async function acceptMatchAtomically(
  client: MatchAcceptanceClient,
  matchId: string,
): Promise<MatchRecord> {
  try {
    const { data, error } = await client.rpc("accept_match", {
      p_match_id: matchId,
    });
    if (error) {
      if (isAcceptConflict(error)) throw await conflictFor(client, matchId);
      throw error;
    }
    if (!data) throw await conflictFor(client, matchId);
    return data;
  } catch (error) {
    if (error instanceof MatchRequestError) throw error;
    throw isNetworkError(error)
      ? new MatchRequestError("offline", matchMessages.offline)
      : new MatchRequestError("failed", matchMessages.accept);
  }
}

/**
 * Rejects a pending request (conditional update from `respondToMatch`); on a
 * conflict the row is re-read so the message reflects the real outcome.
 */
export async function rejectMatchWithConflictCheck(
  client: MatchAcceptanceClient,
  matchId: string,
): Promise<void> {
  try {
    await respondToMatch(client, matchId, "rejected");
  } catch (error) {
    if (error instanceof MatchRequestError && error.kind === "conflict") {
      throw await conflictFor(client, matchId);
    }
    throw error;
  }
}

/** Applies a confirmed decision to cached rows so the list updates before the refetch. */
export function applyDecision<
  T extends { match: MatchRecord; iAmRecipient: boolean },
>(
  rows: readonly T[],
  matchId: string,
  status: MatchStatus,
  version?: number,
): T[] {
  return rows.map((row) =>
    row.match.id === matchId
      ? {
          ...row,
          iAmRecipient: false,
          match: {
            ...row.match,
            status,
            version: version ?? row.match.version,
          },
        }
      : row,
  );
}
