import { endedMonthProblem, isMonth, startedMonthProblem } from "./months";

/**
 * Cohabitation declarations ("Živiva skupaj"). Only the two participants can
 * read a cohabitation (RLS), and every change goes through the
 * `declare_cohabitation`, `respond_cohabitation` and `end_cohabitation` RPCs,
 * which repeat all checks on the server. The checks here only give a quicker,
 * clearer answer.
 */

type DbError = { code?: string; message?: string; status?: number } | null;
type Thenable<T> = PromiseLike<{ data: T | null; error: DbError }>;

export type CohabitationStatus = "pending" | "active" | "declined" | "ended";

export type Cohabitation = {
  id: string;
  matchId: string;
  userIdA: string;
  userIdB: string;
  initiatedBy: string;
  status: CohabitationStatus;
  /** First day of the move-in month ("2026-10-01"). */
  startedMonth: string;
  /** First day of the end month; set only when ended. */
  endedMonth: string | null;
  declinedAt: string | null;
  confirmedAt: string | null;
  endedAt: string | null;
  version: number;
  createdAt: string;
};

export const COHABITATION_COLUMNS =
  "id,match_id,user_id_a,user_id_b,initiated_by,status,started_month,ended_month,declined_at,confirmed_at,ended_at,version,created_at";

/** Days after "Ne drži" before the same person can declare again (server rule). */
export const COOLDOWN_DAYS = 30;

/** Structural subset of the Supabase client used for cohabitations. */
export type CohabitationClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: DbError;
    }>;
  };
  from(table: "cohabitations"): {
    select: (columns: string) => {
      eq: (
        column: "match_id",
        value: string,
      ) => {
        order: (
          column: "created_at",
          options: { ascending: boolean },
        ) => Thenable<unknown[]>;
      };
      order: (
        column: "created_at",
        options: { ascending: boolean },
      ) => Thenable<unknown[]>;
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
  rpc(
    fn: "declare_cohabitation",
    args: { p_match_id: string; p_started_month: string },
  ): Thenable<unknown>;
  rpc(
    fn: "respond_cohabitation",
    args: { p_id: string; p_confirm: boolean },
  ): Thenable<unknown>;
  rpc(
    fn: "end_cohabitation",
    args: { p_id: string; p_ended_month: string },
  ): Thenable<unknown>;
};

/** Keys of `m.cohabitation.errors`. */
export type CohabitationErrorKind =
  | "signed-out"
  | "permission"
  | "offline"
  | "conflict"
  | "cooldown"
  | "invalid-month"
  | "unknown";

/** Keys of `m.cohabitation.loadErrors`. */
export type CohabitationLoadFailure =
  "signed-out" | "offline" | "permission" | "unknown";

/** What a failed load shows: the specific reason when it helps, otherwise a general message. */
export function loadFailure(error: unknown): CohabitationLoadFailure {
  return error instanceof CohabitationError &&
    (error.kind === "signed-out" ||
      error.kind === "offline" ||
      error.kind === "permission")
    ? error.kind
    : "unknown";
}

export class CohabitationError extends Error {
  constructor(public readonly kind: CohabitationErrorKind) {
    // The text shown is m.cohabitation.errors[kind]; the message is for logs.
    super(`Cohabitation request failed: ${kind}`);
    this.name = "CohabitationError";
  }
}

/**
 * Maps a Supabase/PostgREST or network error to what the user is told. The
 * RPCs raise 42501 for authorization failures, 22023 for month rules, 23505
 * for a second open declaration, and P0001 for the cooldown or a declaration
 * that changed state in the meantime.
 */
export function toCohabitationError(error: unknown): CohabitationError {
  if (error instanceof CohabitationError) return error;
  const {
    code,
    message = "",
    status,
  } = (error ?? {}) as {
    code?: string;
    message?: string;
    status?: number;
  };
  if (error instanceof TypeError || /fetch|network/i.test(message))
    return new CohabitationError("offline");
  if (
    status === 401 ||
    code === "PGRST301" ||
    /not signed in|jwt/i.test(message)
  )
    return new CohabitationError("signed-out");
  if (
    code === "42501" ||
    status === 403 ||
    /permission denied|row-level security/i.test(message)
  )
    return new CohabitationError("permission");
  if (/cooldown/i.test(message)) return new CohabitationError("cooldown");
  if (code === "22023") return new CohabitationError("invalid-month");
  if (code === "23505" || code === "P0001")
    return new CohabitationError("conflict");
  return new CohabitationError("unknown");
}

const STATUSES: readonly CohabitationStatus[] = [
  "pending",
  "active",
  "declined",
  "ended",
];

const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const optionalText = (value: unknown): value is string | null =>
  value === null || text(value);

/** Validates one `cohabitations` row from the API; anything unexpected is an unknown error. */
export function parseCohabitation(row: unknown): Cohabitation {
  const r = (row ?? {}) as Record<string, unknown>;
  const status = r.status as CohabitationStatus;
  const valid =
    typeof row === "object" &&
    row !== null &&
    text(r.id) &&
    text(r.match_id) &&
    text(r.user_id_a) &&
    text(r.user_id_b) &&
    r.user_id_a !== r.user_id_b &&
    text(r.initiated_by) &&
    (r.initiated_by === r.user_id_a || r.initiated_by === r.user_id_b) &&
    STATUSES.includes(status) &&
    isMonth(r.started_month) &&
    (status === "ended"
      ? isMonth(r.ended_month) && r.ended_month >= r.started_month
      : r.ended_month === null || r.ended_month === undefined) &&
    optionalText(r.declined_at ?? null) &&
    optionalText(r.confirmed_at ?? null) &&
    optionalText(r.ended_at ?? null) &&
    Number.isInteger(r.version) &&
    (r.version as number) >= 1 &&
    text(r.created_at);
  if (!valid) throw new CohabitationError("unknown");
  return {
    id: r.id as string,
    matchId: r.match_id as string,
    userIdA: r.user_id_a as string,
    userIdB: r.user_id_b as string,
    initiatedBy: r.initiated_by as string,
    status,
    startedMonth: r.started_month as string,
    endedMonth: (r.ended_month as string | null | undefined) ?? null,
    declinedAt: (r.declined_at as string | null | undefined) ?? null,
    confirmedAt: (r.confirmed_at as string | null | undefined) ?? null,
    endedAt: (r.ended_at as string | null | undefined) ?? null,
    version: r.version as number,
    createdAt: r.created_at as string,
  };
}

async function me(client: CohabitationClient): Promise<string> {
  const { data } = await client.auth.getUser();
  if (!data.user) throw new CohabitationError("signed-out");
  return data.user.id;
}

const involves = (cohabitation: Cohabitation, userId: string) =>
  cohabitation.userIdA === userId || cohabitation.userIdB === userId;

/** Every cohabitation of one match that I take part in, newest first. */
export async function loadMatchCohabitations(
  client: CohabitationClient,
  matchId: string,
): Promise<{ me: string; cohabitations: Cohabitation[] }> {
  try {
    const myId = await me(client);
    const { data, error } = await client
      .from("cohabitations")
      .select(COHABITATION_COLUMNS)
      .eq("match_id", matchId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const cohabitations = (data ?? [])
      .map(parseCohabitation)
      .filter((c) => involves(c, myId));
    return { me: myId, cohabitations };
  } catch (error) {
    throw toCohabitationError(error);
  }
}

export type MyCohabitation = Cohabitation & {
  peerId: string;
  /** Null when the name is unknown; the list then shows `m.cohabitation.mine.unknownPeer`. */
  peerName: string | null;
};

/** All my cohabitations with the other person's name, newest first. */
export async function loadMyCohabitations(
  client: CohabitationClient,
): Promise<{ me: string; cohabitations: MyCohabitation[] }> {
  try {
    const myId = await me(client);
    const { data, error } = await client
      .from("cohabitations")
      .select(COHABITATION_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (data ?? [])
      .map(parseCohabitation)
      .filter((c) => involves(c, myId));
    const peerIds = [
      ...new Set(rows.map((c) => (c.userIdA === myId ? c.userIdB : c.userIdA))),
    ];
    const names = new Map<string, string>();
    if (peerIds.length) {
      const profiles = await client
        .from("profiles")
        .select("id,display_name")
        .in("id", peerIds);
      // Names are a convenience: without them the list still works.
      for (const profile of profiles.error ? [] : (profiles.data ?? []))
        names.set(profile.id, profile.display_name?.trim() ?? "");
    }
    return {
      me: myId,
      cohabitations: rows.map((c) => {
        const peerId = c.userIdA === myId ? c.userIdB : c.userIdA;
        return { ...c, peerId, peerName: names.get(peerId) || null };
      }),
    };
  } catch (error) {
    throw toCohabitationError(error);
  }
}

/** Matches with a declaration that waits for my answer (the chat list attention mark). */
export function awaitingMyAnswer(
  cohabitations: Cohabitation[],
  myId: string,
): Set<string> {
  return new Set(
    cohabitations
      .filter((c) => c.status === "pending" && c.initiatedBy !== myId)
      .map((c) => c.matchId),
  );
}

async function callRpc(
  request: () => Thenable<unknown>,
): Promise<Cohabitation> {
  try {
    const { data, error } = await request();
    if (error) throw error;
    return parseCohabitation(data);
  } catch (error) {
    throw toCohabitationError(error);
  }
}

/** "Živiva skupaj": declares living together since `startedMonth`. */
export function declareCohabitation(
  client: CohabitationClient,
  matchId: string,
  startedMonth: string,
  rules: { matchCreatedAt: string | null; now?: Date } = {
    matchCreatedAt: null,
  },
): Promise<Cohabitation> {
  if (startedMonthProblem(startedMonth, rules.matchCreatedAt, rules.now))
    return Promise.reject(new CohabitationError("invalid-month"));
  return callRpc(() =>
    client.rpc("declare_cohabitation", {
      p_match_id: matchId,
      p_started_month: startedMonth,
    }),
  );
}

/** "Potrdi" (true) or "Ne drži" (false). */
export function respondCohabitation(
  client: CohabitationClient,
  cohabitationId: string,
  confirm: boolean,
): Promise<Cohabitation> {
  return callRpc(() =>
    client.rpc("respond_cohabitation", {
      p_id: cohabitationId,
      p_confirm: confirm,
    }),
  );
}

/** "Ne živiva več skupaj" from `endedMonth`. */
export function endCohabitation(
  client: CohabitationClient,
  cohabitation: Pick<Cohabitation, "id" | "startedMonth">,
  endedMonth: string,
  now?: Date,
): Promise<Cohabitation> {
  if (endedMonthProblem(endedMonth, cohabitation.startedMonth, now))
    return Promise.reject(new CohabitationError("invalid-month"));
  return callRpc(() =>
    client.rpc("end_cohabitation", {
      p_id: cohabitation.id,
      p_ended_month: endedMonth,
    }),
  );
}

/** When I may declare again after my declaration was declined; null when I may now. */
export function cooldownUntil(
  cohabitations: Cohabitation[],
  myId: string,
  now: Date = new Date(),
): Date | null {
  let until: Date | null = null;
  for (const c of cohabitations) {
    if (c.status !== "declined" || c.initiatedBy !== myId || !c.declinedAt)
      continue;
    const end = new Date(
      new Date(c.declinedAt).getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
    );
    if (end > now && (!until || end > until)) until = end;
  }
  return until;
}

/** What the chat shows about cohabitation, from my point of view. */
export type ChatCohabitationView =
  | {
      kind: "none";
      /** My latest declaration was declined ("Ni potrjeno"); no reason is given. */
      notConfirmed: boolean;
      /** I can't declare again before this time. */
      cooldownUntil: Date | null;
    }
  | { kind: "awaiting-peer"; cohabitation: Cohabitation }
  | { kind: "awaiting-me"; cohabitation: Cohabitation }
  | { kind: "active"; cohabitation: Cohabitation };

export function chatCohabitationView(
  cohabitations: Cohabitation[],
  myId: string,
  now: Date = new Date(),
): ChatCohabitationView {
  const open = cohabitations.find(
    (c) => c.status === "pending" || c.status === "active",
  );
  if (open?.status === "active") return { kind: "active", cohabitation: open };
  if (open)
    return {
      kind: open.initiatedBy === myId ? "awaiting-peer" : "awaiting-me",
      cohabitation: open,
    };
  const latest = [...cohabitations].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )[0];
  return {
    kind: "none",
    notConfirmed: latest?.status === "declined" && latest.initiatedBy === myId,
    cooldownUntil: cooldownUntil(cohabitations, myId, now),
  };
}

/** Keys of `m.cohabitation.status`. */
export type CohabitationStatusKey =
  "active" | "ended" | "declined" | "awaitingPeer" | "awaitingMe";

/** Status line for the "Moje sobivanje" list (a key of `m.cohabitation.status`). */
export function cohabitationStatus(
  cohabitation: Cohabitation,
  myId: string,
): CohabitationStatusKey {
  switch (cohabitation.status) {
    case "active":
    case "ended":
    case "declined":
      return cohabitation.status;
    case "pending":
      return cohabitation.initiatedBy === myId ? "awaitingPeer" : "awaitingMe";
  }
}
