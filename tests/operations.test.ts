import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { appVersion, httpStatus, liveness, readiness } from "../lib/ops/health";
import {
  buildErrorReport,
  maskRoute,
  reportError,
} from "../lib/ops/report-error";

const NOW = new Date("2026-10-12T08:00:00Z");
const configured = {
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co/",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
};

describe("health checks", () => {
  it("reports the build version from the first available source", () => {
    expect(appVersion({})).toBe("dev");
    expect(appVersion({ GITHUB_SHA: "abcdef1234567890" })).toBe("abcdef123456");
    expect(
      appVersion({ NEXT_PUBLIC_APP_VERSION: "v1", VERCEL_GIT_COMMIT_SHA: "x" }),
    ).toBe("v1");
  });

  it("liveness is ok with configuration and degraded (503) without it", () => {
    const ok = liveness(configured, NOW);
    expect(ok).toEqual({
      status: "ok",
      version: "dev",
      time: "2026-10-12T08:00:00.000Z",
      checks: { supabaseConfig: "configured" },
    });
    expect(httpStatus(ok)).toBe(200);
    const missing = liveness({}, NOW);
    expect(missing.status).toBe("degraded");
    expect(httpStatus(missing)).toBe(503);
  });

  it("never exposes configuration values", () => {
    const text = JSON.stringify(liveness(configured, NOW));
    expect(text).not.toContain("anon");
    expect(text).not.toContain("supabase.co");
  });

  it("readiness calls Supabase Auth health with only the anon key", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }));
    const report = await readiness(configured, fetchImpl, NOW);
    expect(report.status).toBe("ok");
    expect(report.checks.supabaseAuth).toBe("ok");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://x.supabase.co/auth/v1/health",
      expect.objectContaining({ headers: { apikey: "anon" } }),
    );
  });

  it("readiness degrades when Supabase fails, errors, or times out", async () => {
    const down = await readiness(
      configured,
      async () => ({ ok: false, status: 502 }),
      NOW,
    );
    expect(down).toMatchObject({
      status: "degraded",
      checks: { supabaseAuth: "unreachable" },
    });
    const thrown = await readiness(
      configured,
      async () => {
        throw new TypeError("fetch failed");
      },
      NOW,
    );
    expect(thrown.checks.supabaseAuth).toBe("unreachable");
    const slow = await readiness(
      configured,
      (_url, init) =>
        new Promise((_, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          ),
        ),
      NOW,
      20,
    );
    expect(slow.checks.supabaseAuth).toBe("unreachable");
  });

  it("readiness skips the network without configuration", async () => {
    const fetchImpl = vi.fn();
    const report = await readiness({}, fetchImpl, NOW);
    expect(report.checks.supabaseAuth).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("error reports", () => {
  it("masks ids and drops the query and hash", () => {
    expect(
      maskRoute("/listings/2f0c1a3b-1111-4222-8333-444455556666?x=1#top"),
    ).toBe("/listings/:id");
    expect(maskRoute("/chats/42")).toBe("/chats/:id");
    expect(maskRoute("/search")).toBe("/search");
    expect(maskRoute("")).toBe("/");
  });

  it("keeps only the name, digest, masked route, and version", () => {
    const error = Object.assign(new TypeError("secret user text"), {
      digest: "123",
    });
    const report = buildErrorReport(error, "page", "/chats/42", "abc");
    expect(report).toEqual({
      event: "client_error",
      boundary: "page",
      name: "TypeError",
      digest: "123",
      route: "/chats/:id",
      version: "abc",
    });
    expect(JSON.stringify(report)).not.toContain("secret");
  });

  it("writes one JSON line to the sink", () => {
    const lines: string[] = [];
    reportError(new Error("x"), "global", (line) => lines.push(line));
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({
      event: "client_error",
      boundary: "global",
      digest: null,
    });
  });
});

describe("runbook", () => {
  const runbook = readFileSync(
    join(process.cwd(), "docs/operations/runbook.md"),
    "utf8",
  );

  it("covers deployment, monitoring, backups, rollback, and incidents", () => {
    for (const heading of [
      "## 1. Environments",
      "## 2. Deployment",
      "## 3. Monitoring",
      "## 4. Backups",
      "## 5. Rollback",
      "## 6. Incident checklist",
      "## Open decisions",
    ]) {
      expect(runbook).toContain(heading);
    }
  });

  it("documents the health endpoints and the vpisnice backup gap", () => {
    expect(runbook).toContain("/api/health?deep=1");
    expect(runbook).toMatch(/vpisnice[\s\S]*Not included in database backups/);
  });

  it("forbids the service-role key on the web host", () => {
    expect(runbook).toMatch(/service-role key is never set on the web host/);
  });
});
