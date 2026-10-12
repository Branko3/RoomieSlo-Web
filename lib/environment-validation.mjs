// Shared by lib/config.ts (app and tests) and scripts/validate-environment.mjs (CLI and
// prebuild). Plain JavaScript so Node can run it without a TypeScript loader; it must stay
// browser-safe because getSupabaseConfig uses isPrivilegedSupabaseKey in the client bundle.

const ENVIRONMENTS = ["development", "staging", "production"];

export function getDeploymentEnvironment(env) {
  const value = env.ROOMIESLO_ENV;
  if (value === "staging" || value === "production") return value;
  return "development";
}

function decodeJwtPayload(segment) {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(atob(padded));
}

/** True for Supabase secret keys (sb_secret_…) and service-role JWTs. */
export function isPrivilegedSupabaseKey(key) {
  if (key.startsWith("sb_secret_")) return true;
  const parts = key.split(".");
  if (parts.length !== 3) return false;
  try {
    // Compare the parts separately: the minifier folds a joined constant back into the literal
    // role name, which tests/supabase-boundary.test.ts forbids in browser bundles.
    const role = String(decodeJwtPayload(parts[1]).role ?? "").split("_");
    return role.length === 2 && role[0] === "service" && role[1] === "role";
  } catch {
    // Supabase publishable keys are not required to be JWTs.
    return false;
  }
}

function isLoopbackHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "::1" ||
    host === "0.0.0.0" ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
  );
}

export function validateEnvironment(env) {
  const errors = [];
  const configuredEnvironment = env.ROOMIESLO_ENV;
  const environment = getDeploymentEnvironment(env);
  if (
    configuredEnvironment !== undefined &&
    !ENVIRONMENTS.includes(configuredEnvironment)
  ) {
    errors.push("ROOMIESLO_ENV must be development, staging, or production.");
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url) errors.push("NEXT_PUBLIC_SUPABASE_URL is required.");
  if (!anonKey) errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is required.");

  if (url) {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        errors.push("NEXT_PUBLIC_SUPABASE_URL must use http or https.");
      }
      if (parsed.username || parsed.password) {
        errors.push("NEXT_PUBLIC_SUPABASE_URL must not contain credentials.");
      }
      if (
        environment !== "development" &&
        (parsed.protocol !== "https:" || isLoopbackHost(parsed.hostname))
      ) {
        errors.push(
          `${environment} Supabase configuration must use a non-local HTTPS URL.`,
        );
      }
    } catch {
      errors.push("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
    }
  }

  if (anonKey && isPrivilegedSupabaseKey(anonKey)) {
    errors.push(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY must never contain a privileged secret or service-role key.",
    );
  }

  return { valid: errors.length === 0, errors };
}
