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
