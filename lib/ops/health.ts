/**
 * Health checks for uptime monitoring (see docs/operations/runbook.md).
 *
 * - Liveness (`/api/health`): the app process answers. It never calls Supabase,
 *   so a Supabase outage doesn't make the platform restart healthy instances.
 * - Readiness (`/api/health?deep=1`): additionally checks that Supabase Auth
 *   answers within a timeout, using only the public anon key.
 */

export type HealthStatus = "ok" | "degraded";

export type HealthReport = {
  status: HealthStatus;
  version: string;
  time: string;
  checks: {
    supabaseConfig: "configured" | "missing";
    supabaseAuth?: "ok" | "unreachable" | "skipped";
  };
};

type Env = Record<string, string | undefined>;
type Fetch = (
  input: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number }>;

export const READINESS_TIMEOUT_MS = 3000;

/** Build identifier: an explicit version, the platform's commit SHA, or "dev". */
export function appVersion(env: Env): string {
  const sha =
    env.NEXT_PUBLIC_APP_VERSION ??
    env.VERCEL_GIT_COMMIT_SHA ??
    env.GITHUB_SHA ??
    "";
  return sha ? sha.slice(0, 12) : "dev";
}

export function liveness(env: Env, now: Date = new Date()): HealthReport {
  const configured = Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return {
    status: configured ? "ok" : "degraded",
    version: appVersion(env),
    time: now.toISOString(),
    checks: { supabaseConfig: configured ? "configured" : "missing" },
  };
}

export async function readiness(
  env: Env,
  fetchImpl: Fetch,
  now: Date = new Date(),
  timeoutMs = READINESS_TIMEOUT_MS,
): Promise<HealthReport> {
  const report = liveness(env, now);
  if (report.checks.supabaseConfig === "missing") {
    return { ...report, checks: { ...report.checks, supabaseAuth: "skipped" } };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let reachable = false;
  try {
    const url = `${env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, "")}/auth/v1/health`;
    const response = await fetchImpl(url, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      signal: controller.signal,
    });
    reachable = response.ok;
  } catch {
    reachable = false;
  } finally {
    clearTimeout(timer);
  }
  return {
    ...report,
    status: reachable ? report.status : "degraded",
    checks: {
      ...report.checks,
      supabaseAuth: reachable ? "ok" : "unreachable",
    },
  };
}

/** 200 when healthy, 503 when degraded, so uptime monitors can alert on status alone. */
export function httpStatus(report: HealthReport): 200 | 503 {
  return report.status === "ok" ? 200 : 503;
}
