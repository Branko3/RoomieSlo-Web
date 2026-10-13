import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Static checks only: the SQL is not executed here (no Supabase project or CLI).
const NAME = "20261013000000_chat_and_match_authorization.sql";
const dir = join(process.cwd(), "supabase/migrations");
const files = readdirSync(dir)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const all = files.map((file) =>
  readFileSync(join(dir, file), "utf8").toLowerCase(),
);
const migration = readFileSync(join(dir, NAME), "utf8").toLowerCase();
const squash = (s: string) => s.replace(/\s+/g, " ");

/** The effective policy bodies after applying every migration in order (later `create policy` wins). */
function effectivePolicy(table: string, name: string): string {
  let body = "";
  const pattern =
    /create policy (\w+) on ([\w.]+)\s+for \w+([\s\S]*?);\s*(?=\n|$)/g;
  for (const sql of all) {
    for (const [, n, t, b] of sql.matchAll(pattern)) {
      if (n === name && t === table) body = squash(b);
    }
  }
  return body;
}

/** The last definition of a function across all migrations. */
function effectiveFunction(name: string): string {
  let body = "";
  const pattern = new RegExp(
    `create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`,
    "g",
  );
  for (const sql of all) {
    for (const [match] of sql.matchAll(pattern)) body = squash(match);
  }
  return body;
}

describe("migration order", () => {
  it("runs after the blocks and admin migrations it builds on", () => {
    const index = files.indexOf(NAME);
    expect(index).toBeGreaterThan(
      files.indexOf("20261011000000_user_blocks.sql"),
    );
    expect(index).toBeGreaterThan(
      files.indexOf("20261011000100_admin_authorization_boundary.sql"),
    );
  });
});

describe("match requests", () => {
  it("lets only the recipient answer a pending request", () => {
    const policy = effectivePolicy("public.matches", "matches_update");
    expect(policy).toContain(
      "using (auth.uid() = user_id_b and status = 'pending')",
    );
    expect(policy).toContain(
      "with check (auth.uid() = user_id_b and status in ('accepted', 'rejected'))",
    );
    expect(policy).not.toContain("user_id_a");
  });

  it("accept_match requires the caller to be the recipient", () => {
    const fn = effectiveFunction("accept_match");
    expect(fn).toContain("security definer");
    expect(fn).toContain("set search_path = public");
    expect(fn).toContain("and auth.uid() = user_id_b");
    expect(fn).not.toContain("auth.uid() = user_id_a");
    expect(fn).toContain("and status = 'pending'");
    expect(migration).toContain(
      "revoke all on function public.accept_match(uuid) from public",
    );
    expect(migration).toContain(
      "grant execute on function public.accept_match(uuid) to authenticated",
    );
  });

  it("locks every column except status for API callers and bumps the version", () => {
    const fn = effectiveFunction("guard_match_update");
    expect(fn).toContain("coalesce(auth.role(), '') = 'authenticated'");
    for (const column of ["id", "user_id_a", "user_id_b", "created_at"]) {
      expect(fn).toContain(`new.${column} is distinct from old.${column}`);
    }
    expect(fn).toContain("new.version := old.version + 1");
    expect(migration).toMatch(
      /create trigger guard_match_update\s+before update on public\.matches/,
    );
    expect(migration).toContain(
      "revoke all on function public.guard_match_update() from public",
    );
  });
});

describe("messages", () => {
  it("can only be sent in an accepted, unblocked match the sender takes part in", () => {
    const policy = effectivePolicy("public.messages", "messages_insert");
    expect(policy).toContain("auth.uid() = sender_id");
    expect(policy).toContain("m.status = 'accepted'");
    expect(policy).toContain(
      "(auth.uid() = m.user_id_a or auth.uid() = m.user_id_b)",
    );
    expect(policy).toContain(
      "not public.is_blocked_between(m.user_id_a, m.user_id_b)",
    );
  });

  it("can only be updated by the recipient", () => {
    const policy = effectivePolicy("public.messages", "messages_update");
    const [using, check] = policy.split("with check");
    for (const clause of [using, check]) {
      expect(clause).toContain("sender_id <> auth.uid()");
      expect(clause).toContain(
        "(auth.uid() = m.user_id_a or auth.uid() = m.user_id_b)",
      );
    }
  });

  it("lets API callers change only delivery_status, and only forwards", () => {
    const fn = effectiveFunction("guard_message_update");
    expect(fn).toContain("coalesce(auth.role(), '') = 'authenticated'");
    for (const column of ["id", "match_id", "sender_id", "body", "sent_at"]) {
      expect(fn).toContain(`new.${column} is distinct from old.${column}`);
    }
    expect(fn).not.toContain("new.delivery_status is distinct from");
    expect(fn).toContain("array['sent', 'delivered', 'read']");
    expect(fn).toContain("delivery status cannot move backwards");
    expect(migration).toMatch(
      /create trigger guard_message_update\s+before update on public\.messages/,
    );
    expect(migration).toContain(
      "revoke all on function public.guard_message_update() from public",
    );
  });
});
