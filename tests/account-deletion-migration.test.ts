import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Static checks only: the SQL is not executed here (no Supabase project or CLI).
const NAME = "20261014000000_account_deletion_tombstones.sql";
const dir = join(process.cwd(), "supabase/migrations");
const files = readdirSync(dir)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const squash = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const all = files.map((file) => squash(readFileSync(join(dir, file), "utf8")));
const sql = squash(readFileSync(join(dir, NAME), "utf8"));

function fn(name: string): string {
  const match = sql.match(
    new RegExp(`create or replace function public\\.${name}\\(.*?\\$\\$;`),
  );
  expect(match, `function ${name}`).not.toBeNull();
  return match![0];
}

/** The policy body in effect after all migrations (the last definition wins). */
function effectivePolicy(table: string, name: string): string {
  let body = "";
  const pattern = new RegExp(
    `create policy ${name} on ${table.replace(".", "\\.")} (.*?);(?= drop| create| alter| revoke| grant| --|$)`,
    "g",
  );
  for (const file of all) for (const [, b] of file.matchAll(pattern)) body = b;
  return body;
}

describe("migration order", () => {
  it("runs after the chat/match authorization migration it extends", () => {
    expect(files.indexOf(NAME)).toBeGreaterThan(
      files.indexOf("20261013000000_chat_and_match_authorization.sql"),
    );
  });
});

describe("profiles survive Auth deletion as tombstones", () => {
  it("drops the profiles → auth.users cascade", () => {
    expect(sql).toContain("con.confrelid = 'auth.users'::regclass");
    expect(sql).toContain(
      "execute format('alter table public.profiles drop constraint %i', fk.conname)",
    );
    expect(sql).toContain(
      "alter table public.profiles add column if not exists deleted_at timestamptz",
    );
  });

  it("scrubs the profile in a before-delete trigger on auth.users", () => {
    expect(sql).toContain(
      "create trigger on_auth_user_deleted before delete on auth.users for each row execute function public.handle_deleted_user()",
    );
    const body = fn("handle_deleted_user");
    expect(body).toContain("security definer set search_path = public");
    expect(body).toContain("set display_name = 'izbrisan uporabnik'");
    for (const scrub of [
      "age = null",
      "faculty = ''",
      "bio = ''",
      "avatar_url = ''",
      "is_available = false",
      "academic_status_verified = false",
      "deleted_at = now()",
    ])
      expect(body).toContain(scrub);
    expect(body).toContain("return old;");
    expect(sql).toContain(
      "revoke all on function public.handle_deleted_user() from public",
    );
  });

  it("deletes what the retention matrix deletes", () => {
    const body = fn("handle_deleted_user");
    for (const statement of [
      "delete from public.questionnaire_answers where profile_id = old.id",
      "delete from public.favorites where profile_id = old.id",
      "delete from public.listings where owner_id = old.id",
      "delete from public.blocks where blocker_id = old.id or blocked_id = old.id",
      "delete from public.admins where user_id = old.id",
    ])
      expect(body).toContain(statement);
    // Matches, messages and reports are kept (never deleted here).
    expect(body).not.toMatch(/delete from public\.(matches|messages|reports)/);
    expect(body).toContain(
      "set status = 'rejected' where status = 'pending' and (user_id_a = old.id or user_id_b = old.id)",
    );
  });

  it("saves the safety identity record before the scrub", () => {
    const body = fn("handle_deleted_user");
    const insert = body.indexOf(
      "insert into public.deleted_user_safety_records",
    );
    const scrub = body.indexOf("update public.profiles");
    expect(insert).toBeGreaterThan(-1);
    expect(insert).toBeLessThan(scrub);
    expect(body).toContain("select old.id, old.email, p.display_name");
  });

  it("lets nobody but the trigger set deleted_at", () => {
    const body = fn("protect_profile_tombstone");
    expect(body).toContain("in ('authenticated', 'anon')");
    expect(body).toContain("new.deleted_at := null");
    expect(body).toContain("new.deleted_at := old.deleted_at");
    expect(sql).toContain(
      "create trigger protect_profile_tombstone before insert or update on public.profiles",
    );
  });
});

describe("safety identity records", () => {
  it("are readable by the database owner only", () => {
    expect(sql).toContain(
      "alter table public.deleted_user_safety_records enable row level security",
    );
    expect(sql).toContain(
      "revoke all on public.deleted_user_safety_records from anon, authenticated",
    );
    // No policy and no function other than the trigger touches the table.
    expect(all.join(" ")).not.toMatch(
      /create policy \w+ on public\.deleted_user_safety_records/,
    );
  });
});

describe("report retention fields", () => {
  it("adds match_id and closed_at, and backfills closed reports", () => {
    expect(sql).toContain(
      "add column if not exists match_id uuid references public.matches (id) on delete set null",
    );
    expect(sql).toContain("add column if not exists closed_at timestamptz");
    expect(sql).toContain(
      "set closed_at = created_at where status <> 'open' and closed_at is null",
    );
  });

  it("stamps closed_at when a report closes and clears it when reopened", () => {
    const body = fn("track_report_closing");
    expect(body).toContain("if new.status = 'open' then new.closed_at := null");
    expect(body).toContain("new.closed_at := coalesce(new.closed_at, now())");
    expect(body).toContain("new.closed_at := old.closed_at");
    expect(sql).toContain(
      "create trigger track_report_closing before insert or update on public.reports",
    );
  });
});

describe("tombstones are kept out of new activity", () => {
  it("refuses match requests to a deleted user", () => {
    expect(effectivePolicy("public.matches", "matches_insert")).toContain(
      "not public.is_deleted_profile(user_id_b)",
    );
  });

  it("refuses messages in a conversation with a deleted user, keeping earlier rules", () => {
    const policy = effectivePolicy("public.messages", "messages_insert");
    for (const rule of [
      "auth.uid() = sender_id",
      "m.status = 'accepted'",
      "not public.is_blocked_between(m.user_id_a, m.user_id_b)",
      "not public.is_deleted_profile(m.user_id_a)",
      "not public.is_deleted_profile(m.user_id_b)",
    ])
      expect(policy).toContain(rule);
  });
});
