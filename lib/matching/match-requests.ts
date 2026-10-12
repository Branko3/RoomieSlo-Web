import type { MatchStatus } from "../supabase/types";

type DbError = { code?: string; message?: string; status?: number } | null;

export const MATCH_COLUMNS = "id,user_id_a,user_id_b,status,version,created_at";

export type MatchRecord = {
  id: string;
  user_id_a: string;
  user_id_b: string;
  status: MatchStatus;
  version: number;
  created_at: string;
};

/** One match from the current user's point of view (Android `MatchRow`). */
export type MatchRow = {
  match: MatchRecord;
  peerId: string;
  peerName: string;
  /** The request was sent to me and still awaits my answer. */
  iAmRecipient: boolean;
};

export type Decision = "accepted" | "rejected";

type Thenable<T> = PromiseLike<{ data: T | null; error: DbError }>;

/** Structural subset of the Supabase client used for match requests. */
export type MatchClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: DbError;
    }>;
  };
  from(table: "matches"): {
    select: (columns: string) => {
      or: (filters: string) => {
        order: (
          column: "created_at",
          options: { ascending: boolean },
        ) => Thenable<MatchRecord[]>;
      };
    };
    update: (values: { status: Decision }) => {
      eq: (
        column: "id",
        value: string,
      ) => {
        eq: (
          column: "status",
          value: "pending",
        ) => {
          eq: (
            column: "user_id_b",
            value: string,
          ) => {
            select: (
              columns: "id,status",
            ) => Thenable<Array<{ id: string; status: MatchStatus }>>;
          };
        };
      };
    };
  };
  from(table: "profiles"): {
    select: (columns: "id,display_name") => {
      in: (
        column: "id",
        values: string[],
      ) => Thenable<Array<{ id: string; display_name: string | null }>>;
    };
  };
};

export const matchMessages = {
  signedOut: "Za ogled zahtev za ujemanje se moraš prijaviti.",
  load: "Zahtev za ujemanje ni bilo mogoče naložiti.",
  offline: "Ni povezave. Preveri internet in poskusi znova.",
  alreadyHandled: "Ta zahteva je bila že obravnavana.",
  accept: "Zahteve ni bilo mogoče sprejeti.",
  reject: "Zahteve ni bilo mogoče zavrniti.",
} as const;

export class MatchRequestError extends Error {
  constructor(
    public readonly kind: "signed-out" | "conflict" | "offline" | "failed",
    message: string,
  ) {
    super(message);
    this.name = "MatchRequestError";
  }
}

function isNetworkError(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? "";
  return error instanceof TypeError || /fetch|network/i.test(message);
}

/** Android chat list status line for a match row. */
export function matchStatusLabel(
  row: Pick<MatchRow, "match" | "iAmRecipient">,
): string {
  switch (row.match.status) {
    case "accepted":
      return "Sprejeto — odpri klepet";
    case "pending":
      return row.iAmRecipient ? "Nova zahteva za ujemanje" : "Čaka na odgovor";
    case "rejected":
      return "Zavrnjeno";
  }
}

/** Builds rows from the current user's perspective (the requester is `user_id_a`). */
export function toMatchRows(
  matches: readonly MatchRecord[],
  userId: string,
  names: ReadonlyMap<string, string>,
): MatchRow[] {
  return matches.map((match) => {
    const peerId =
      match.user_id_a === userId ? match.user_id_b : match.user_id_a;
    return {
      match,
      peerId,
      peerName: names.get(peerId)?.trim() || "Uporabnik",
      iAmRecipient: match.user_id_b === userId && match.status === "pending",
    };
  });
}

/**
 * All matches the current user takes part in, newest first, with the other
 * person's display name (Android `getMyMatches` + `getDisplayNames`).
 */
export async function loadMyMatches(client: MatchClient): Promise<MatchRow[]> {
  try {
    const { data: userData } = await client.auth.getUser();
    const userId = userData.user?.id;
    if (!userId)
      throw new MatchRequestError("signed-out", matchMessages.signedOut);

    const { data, error } = await client
      .from("matches")
      .select(MATCH_COLUMNS)
      .or(`user_id_a.eq.${userId},user_id_b.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const matches = data ?? [];

    const peerIds = [
      ...new Set(
        matches.map((m) =>
          m.user_id_a === userId ? m.user_id_b : m.user_id_a,
        ),
      ),
    ];
    const names = new Map<string, string>();
    if (peerIds.length > 0) {
      const profiles = await client
        .from("profiles")
        .select("id,display_name")
        .in("id", peerIds);
      if (profiles.error) throw profiles.error;
      for (const profile of profiles.data ?? []) {
        if (profile.display_name) names.set(profile.id, profile.display_name);
      }
    }
    return toMatchRows(matches, userId, names);
  } catch (error) {
    if (error instanceof MatchRequestError) throw error;
    throw isNetworkError(error)
      ? new MatchRequestError("offline", matchMessages.offline)
      : new MatchRequestError("failed", matchMessages.load);
  }
}

/**
 * Accepts or rejects a pending request addressed to the current user (Android
 * `acceptMatch`/`rejectMatch`). The update only applies while the row is still
 * pending and the user is its recipient; if nothing is updated, the request
 * was already handled (or is not theirs) and a conflict is reported.
 */
export async function respondToMatch(
  client: MatchClient,
  matchId: string,
  decision: Decision,
): Promise<void> {
  try {
    const { data: userData } = await client.auth.getUser();
    const userId = userData.user?.id;
    if (!userId)
      throw new MatchRequestError("signed-out", matchMessages.signedOut);

    const { data, error } = await client
      .from("matches")
      .update({ status: decision })
      .eq("id", matchId)
      .eq("status", "pending")
      .eq("user_id_b", userId)
      .select("id,status");
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new MatchRequestError("conflict", matchMessages.alreadyHandled);
    }
  } catch (error) {
    if (error instanceof MatchRequestError) throw error;
    throw isNetworkError(error)
      ? new MatchRequestError("offline", matchMessages.offline)
      : new MatchRequestError(
          "failed",
          decision === "accepted" ? matchMessages.accept : matchMessages.reject,
        );
  }
}
