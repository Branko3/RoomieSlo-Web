/**
 * Configuration for the opt-in Supabase integration suite.
 *
 * The suite runs only against a disposable or staging project, as two ordinary
 * signed-in users (and optionally an admin), with the public anon key. A
 * service-role key is refused because it bypasses RLS, the very thing tested.
 */

export type Credentials = { email: string; password: string };

export type IntegrationEnv =
  | { configured: false; missing: string[] }
  | {
      configured: true;
      url: string;
      anonKey: string;
      userA: Credentials;
      userB: Credentials;
      admin: Credentials | null;
    };

export const REQUIRED_VARIABLES = [
  "SUPABASE_TEST_URL",
  "SUPABASE_TEST_ANON_KEY",
  "SUPABASE_TEST_USER_A_EMAIL",
  "SUPABASE_TEST_USER_A_PASSWORD",
  "SUPABASE_TEST_USER_B_EMAIL",
  "SUPABASE_TEST_USER_B_PASSWORD",
] as const;

type Env = Record<string, string | undefined>;

/** Decodes a JWT payload without verifying it; returns null for anything else. */
export function jwtRole(token: string): string | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const json = Buffer.from(
      part.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    const role = (JSON.parse(json) as { role?: unknown }).role;
    return typeof role === "string" ? role : null;
  } catch {
    return null;
  }
}

export function readIntegrationEnv(env: Env): IntegrationEnv {
  const value = (name: string) => env[name]?.trim() ?? "";
  const missing = REQUIRED_VARIABLES.filter((name) => !value(name));
  if (missing.length) return { configured: false, missing };

  const anonKey = value("SUPABASE_TEST_ANON_KEY");
  if (jwtRole(anonKey) === "service_role" || /^sb_secret_/.test(anonKey)) {
    throw new Error(
      "SUPABASE_TEST_ANON_KEY is a service-role/secret key. The integration suite must run with the anon key so RLS applies.",
    );
  }
  const url = value("SUPABASE_TEST_URL");
  if (!/^https?:\/\//.test(url)) {
    throw new Error("SUPABASE_TEST_URL must be an http(s) URL.");
  }
  if (
    value("SUPABASE_TEST_USER_A_EMAIL") === value("SUPABASE_TEST_USER_B_EMAIL")
  ) {
    throw new Error("Test users A and B must be different accounts.");
  }

  const adminEmail = value("SUPABASE_TEST_ADMIN_EMAIL");
  const adminPassword = value("SUPABASE_TEST_ADMIN_PASSWORD");
  return {
    configured: true,
    url,
    anonKey,
    userA: {
      email: value("SUPABASE_TEST_USER_A_EMAIL"),
      password: value("SUPABASE_TEST_USER_A_PASSWORD"),
    },
    userB: {
      email: value("SUPABASE_TEST_USER_B_EMAIL"),
      password: value("SUPABASE_TEST_USER_B_PASSWORD"),
    },
    admin:
      adminEmail && adminPassword
        ? { email: adminEmail, password: adminPassword }
        : null,
  };
}
