import type { MatchStatus } from "../supabase/types";

type DbError = { code?: string; message?: string; status?: number } | null;

export type ExistingRequest = {
  id: string;
  status: MatchStatus;
  /** I created the request (I am `user_id_a`). */
  sentByMe: boolean;
};

/** Where a match request between me and another user stands. */
export type RequestState =
  | { kind: "signed-out" }
  | { kind: "own-listing" }
  | { kind: "none" }
  | { kind: "exists"; request: ExistingRequest };

type PairRow = {
  id: string;
  user_id_a: string;
  user_id_b: string;
  status: MatchStatus;
};

/** Structural subset of the Supabase client used to send match requests. */
export type SendRequestClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: DbError;
    }>;
  };
  from: (table: "matches") => {
    select: (columns: string) => {
      or: (filters: string) => {
        limit: (
          count: number,
        ) => PromiseLike<{ data: PairRow[] | null; error: DbError }>;
      };
    };
    insert: (row: { user_id_a: string; user_id_b: string }) => {
      select: (columns: string) => {
        single: () => PromiseLike<{ data: PairRow | null; error: DbError }>;
      };
    };
  };
};

const PAIR_COLUMNS = "id,user_id_a,user_id_b,status";

export type SendRequestErrorKind = "signed-out" | "self" | "offline" | "failed";

/** The kind is also the key of its text in `matching.send.errors`. */
export class SendRequestError extends Error {
  constructor(public readonly kind: SendRequestErrorKind) {
    super(kind);
    this.name = "SendRequestError";
  }
}

export type ExistingRequestKey =
  | "accepted"
  | "rejectedByPeer"
  | "rejectedByMe"
  | "pendingMine"
  | "pendingTheirs";

/** Which `matching.send.existing` text describes an already existing request. */
export function existingRequestKey(
  request: ExistingRequest,
): ExistingRequestKey {
  if (request.status === "accepted") return "accepted";
  if (request.status === "rejected")
    return request.sentByMe ? "rejectedByPeer" : "rejectedByMe";
  return request.sentByMe ? "pendingMine" : "pendingTheirs";
}

/** PostgREST `or` filter matching the pair in either direction (the unique index is direction-free). */
export function pairFilter(me: string, other: string): string {
  return `and(user_id_a.eq.${me},user_id_b.eq.${other}),and(user_id_a.eq.${other},user_id_b.eq.${me})`;
}

function toExisting(row: PairRow, me: string): ExistingRequest {
  return { id: row.id, status: row.status, sentByMe: row.user_id_a === me };
}

function isNetworkError(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? "";
  return error instanceof TypeError || /fetch|network/i.test(message);
}

async function findPair(client: SendRequestClient, me: string, other: string) {
  const { data, error } = await client
    .from("matches")
    .select(PAIR_COLUMNS)
    .or(pairFilter(me, other))
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  return row ? toExisting(row, me) : null;
}

/** Current state between the signed-in user and the listing owner, shown before sending. */
export async function loadRequestState(
  client: SendRequestClient,
  ownerId: string,
): Promise<RequestState> {
  try {
    const { data } = await client.auth.getUser();
    const me = data.user?.id;
    if (!me) return { kind: "signed-out" };
    if (me === ownerId) return { kind: "own-listing" };
    const existing = await findPair(client, me, ownerId);
    return existing ? { kind: "exists", request: existing } : { kind: "none" };
  } catch (error) {
    throw isNetworkError(error)
      ? new SendRequestError("offline")
      : new SendRequestError("failed");
  }
}

/**
 * Sends a match request to the listing owner (Android `sendRequest`) without
 * ever creating a duplicate:
 * 1. an existing request in either direction is returned instead of inserting;
 * 2. if another tab inserted meanwhile, the unique pair index rejects the
 *    insert (23505) and the existing request is returned;
 * 3. requests to oneself are refused (also enforced by `matches_distinct_users`).
 */
export async function sendMatchRequest(
  client: SendRequestClient,
  ownerId: string,
): Promise<{ created: boolean; request: ExistingRequest }> {
  try {
    const { data } = await client.auth.getUser();
    const me = data.user?.id;
    if (!me) throw new SendRequestError("signed-out");
    if (me === ownerId) throw new SendRequestError("self");

    const existing = await findPair(client, me, ownerId);
    if (existing) return { created: false, request: existing };

    const inserted = await client
      .from("matches")
      .insert({ user_id_a: me, user_id_b: ownerId })
      .select(PAIR_COLUMNS)
      .single();
    if (inserted.error?.code === "23505") {
      const winner = await findPair(client, me, ownerId);
      if (winner) return { created: false, request: winner };
    }
    if (inserted.error?.code === "23514") {
      throw new SendRequestError("self");
    }
    if (inserted.error) throw inserted.error;
    if (!inserted.data) throw new SendRequestError("failed");
    return { created: true, request: toExisting(inserted.data, me) };
  } catch (error) {
    if (error instanceof SendRequestError) throw error;
    throw isNetworkError(error)
      ? new SendRequestError("offline")
      : new SendRequestError("failed");
  }
}
