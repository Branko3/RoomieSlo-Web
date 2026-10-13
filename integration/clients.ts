import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readIntegrationEnv, type Credentials } from "./env";

export const env = readIntegrationEnv(process.env);

/** `describe.skipIf(skip)` — the suite is skipped, not failed, without configuration. */
export const skip = !env.configured;

if (!env.configured) {
  console.info(
    `[integration] skipped: set ${env.missing.join(", ")} (see docs/features/auth-rls-storage-and-realtime-integration-tests.md)`,
  );
}

function config() {
  if (!env.configured) throw new Error("Integration suite is not configured.");
  return env;
}

export function anonClient(): SupabaseClient {
  const { url, anonKey } = config();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Session = { client: SupabaseClient; userId: string };

export async function signIn(credentials: Credentials): Promise<Session> {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword(credentials);
  if (error || !data.user) {
    throw new Error(
      `Sign-in failed for a test user: ${error?.message ?? "no user"}`,
    );
  }
  return { client, userId: data.user.id };
}

export const signInA = () => signIn(config().userA);
export const signInB = () => signIn(config().userB);
export const adminCredentials = () => (env.configured ? env.admin : null);

/** A unique, recognisable marker for rows and files created by the suite. */
export function marker(label: string): string {
  return `it-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** PostgREST/RLS refusals arrive as 42501 or as an empty result, depending on the operation. */
export function isRlsRefusal(
  error: { code?: string; message?: string } | null,
) {
  return (
    !!error &&
    (error.code === "42501" ||
      /row-level security|permission denied/i.test(error.message ?? ""))
  );
}

export type PairMatch = {
  id: string;
  /** What happened when the requester (A) tried to answer their own pending request; null if the match already existed. */
  requesterAnswer: { rpcError: unknown; updatedRows: number } | null;
};

/**
 * Returns the single A↔B match, creating it as A's request if needed. Messages
 * may only be sent in an accepted match, so a pending match is accepted by B
 * (the recipient). On a fresh match, A first tries to accept their own request
 * through the RPC and a direct update; the outcome is returned for assertions.
 */
export async function ensureAcceptedMatch(
  a: Session,
  b: Session,
): Promise<PairMatch> {
  const existing = await a.client
    .from("matches")
    .select("id, status, user_id_b")
    .or(
      `and(user_id_a.eq.${a.userId},user_id_b.eq.${b.userId}),and(user_id_a.eq.${b.userId},user_id_b.eq.${a.userId})`,
    )
    .limit(1);
  if (existing.error) throw existing.error;
  let row = existing.data[0] as
    { id: string; status: string; user_id_b: string } | undefined;
  let requesterAnswer: PairMatch["requesterAnswer"] = null;

  if (!row) {
    const created = await a.client
      .from("matches")
      .insert({ user_id_a: a.userId, user_id_b: b.userId })
      .select("id, status, user_id_b")
      .single();
    if (created.error) throw created.error;
    row = created.data;
    const rpc = await a.client.rpc("accept_match", { p_match_id: row.id });
    const update = await a.client
      .from("matches")
      .update({ status: "accepted" })
      .eq("id", row.id)
      .select("id");
    requesterAnswer = {
      rpcError: rpc.error,
      updatedRows: update.error ? 0 : (update.data?.length ?? 0),
    };
  }

  if (row.status === "pending") {
    const recipient = row.user_id_b === b.userId ? b : a;
    const accepted = await recipient.client.rpc("accept_match", {
      p_match_id: row.id,
    });
    if (accepted.error) throw accepted.error;
  }
  return { id: row.id, requesterAnswer };
}
