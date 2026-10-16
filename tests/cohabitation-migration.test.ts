import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Static checks only: the SQL is not executed here (no Supabase project or CLI).
const NAME = "20261016000000_cohabitations.sql";
const dir = join(process.cwd(), "supabase/migrations");
const files = readdirSync(dir)
  .filter((file) => file.endsWith(".sql"))
  .sort();
/** Lowercase, without `--` comments, whitespace collapsed. */
const clean = (s: string) =>
  s.toLowerCase().replace(/--.*$/gm, "").replace(/\s+/g, " ").trim();
const read = (file: string) => clean(readFileSync(join(dir, file), "utf8"));
const all = files.map(read);
const sql = read(NAME);

/** A function's definition in one migration file. */
function fnIn(source: string, name: string): string {
  const match = source.match(
    new RegExp(`create or replace function public\\.${name}\\(.*?\\$\\$;`),
  );
  expect(match, `function ${name}`).not.toBeNull();
  return match![0];
}

/** The last definition of a function across all migrations. */
function effectiveFunction(name: string): string {
  let body = "";
  const pattern = new RegExp(
    `create or replace function public\\.${name}\\(.*?\\$\\$;`,
    "g",
  );
  for (const file of all)
    for (const [match] of file.matchAll(pattern)) body = match;
  return body;
}

/** The statements of a plpgsql body (between the first `begin` and the closing `end;`). */
function statements(fn: string): string[] {
  const body = fn.slice(fn.indexOf(" begin ") + 7, fn.lastIndexOf(" end; $$;"));
  return body
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

describe("migration order", () => {
  it("is the newest migration and runs after everything it extends", () => {
    expect(files.at(-1)).toBe(NAME);
    for (const dependency of [
      "20261011000000_user_blocks.sql",
      "20261013000000_chat_and_match_authorization.sql",
      "20261014000000_account_deletion_tombstones.sql",
      "20261014000400_retention_jobs.sql",
    ])
      expect(files.indexOf(NAME)).toBeGreaterThan(files.indexOf(dependency));
  });
});

describe("cohabitations table", () => {
  it("has the planned columns, states and month constraints", () => {
    for (const column of [
      "id uuid primary key default gen_random_uuid()",
      "match_id uuid not null references public.matches (id) on delete cascade",
      "user_id_a uuid not null references public.profiles (id)",
      "user_id_b uuid not null references public.profiles (id)",
      "initiated_by uuid not null references public.profiles (id)",
      "check (status in ('pending', 'active', 'declined', 'ended'))",
      "started_month date not null",
      "ended_month date,",
      "declined_at timestamptz",
      "confirmed_at timestamptz",
      "ended_at timestamptz",
      "version integer not null default 1",
    ])
      expect(sql).toContain(column);
    expect(sql).toContain("check (initiated_by in (user_id_a, user_id_b))");
    expect(sql).toContain("check (extract(day from started_month) = 1)");
    expect(sql).toContain(
      "check (ended_month is null or ended_month >= started_month)",
    );
    expect(sql).toContain(
      "check ((status = 'ended') = (ended_month is not null))",
    );
  });

  it("allows one open (pending or active) declaration per match", () => {
    expect(sql).toContain(
      "create unique index if not exists cohabitations_one_open_per_match on public.cohabitations (match_id) where status in ('pending', 'active')",
    );
  });
});

describe("row-level security", () => {
  it("lets only the two participants read a cohabitation", () => {
    expect(sql).toContain(
      "alter table public.cohabitations enable row level security",
    );
    expect(sql).toContain(
      "create policy cohabitations_select_participants on public.cohabitations for select to authenticated using (auth.uid() = user_id_a or auth.uid() = user_id_b)",
    );
  });

  it("has no write policies and no table write privileges for API roles", () => {
    const policies = all
      .join(" ")
      .match(/create policy \w+ on public\.cohabitations for \w+/g);
    expect(policies).toEqual([
      "create policy cohabitations_select_participants on public.cohabitations for select",
    ]);
    expect(sql).toContain(
      "revoke all on public.cohabitations from anon, authenticated",
    );
    expect(sql).toContain(
      "grant select on public.cohabitations to authenticated",
    );
    expect(sql).not.toMatch(
      /grant (all|insert|update|delete)[^;]* on public\.cohabitations/,
    );
  });

  it("is not exposed to admins, profiles, search or recommendations", () => {
    // The only read path is the participant policy above; no other migration
    // (admin views, recommendation or search functions) touches the table.
    expect(sql).not.toMatch(/admins a? ?where[^;]*cohabitation/);
    for (const [index, file] of all.entries()) {
      if (files[index] === NAME) continue;
      expect(file, files[index]).not.toContain("cohabitations");
    }
  });
});

describe("RPCs", () => {
  const rpcs = {
    declare_cohabitation: "uuid, date",
    respond_cohabitation: "uuid, boolean",
    end_cohabitation: "uuid, date",
  } as const;

  it("are security definer with a fixed search path, callable by signed-in users only", () => {
    for (const [name, args] of Object.entries(rpcs)) {
      const fn = effectiveFunction(name);
      expect(fn, name).toContain("security definer set search_path = public");
      expect(fn, name).toContain(
        "if me is null then raise exception 'not signed in' using errcode = '42501'",
      );
      expect(sql).toContain(
        `revoke all on function public.${name}(${args}) from public, anon`,
      );
      expect(sql).toContain(
        `grant execute on function public.${name}(${args}) to authenticated`,
      );
    }
  });

  it("require the caller to be a participant of an accepted match with no deleted profile", () => {
    const declare = effectiveFunction("declare_cohabitation");
    expect(declare).toContain(
      "if not found or me not in (m.user_id_a, m.user_id_b) then raise exception 'match is unavailable or caller is not a participant' using errcode = '42501'",
    );
    expect(declare).toContain(
      "if m.status <> 'accepted' then raise exception 'match is not accepted' using errcode = '42501'",
    );
    expect(declare).toContain(
      "if public.is_deleted_profile(m.user_id_a) or public.is_deleted_profile(m.user_id_b) then",
    );
    for (const name of ["respond_cohabitation", "end_cohabitation"]) {
      const fn = effectiveFunction(name);
      expect(fn, name).toContain(
        "if not found or me not in (c.user_id_a, c.user_id_b) then raise exception 'cohabitation is unavailable or caller is not a participant' using errcode = '42501'",
      );
      expect(fn, name).toContain(
        "if not found or m.status <> 'accepted' then raise exception 'match is not accepted' using errcode = '42501'",
      );
      expect(fn, name).toContain(
        "if public.is_deleted_profile(c.user_id_a) or public.is_deleted_profile(c.user_id_b) then",
      );
    }
  });

  it("refuse declaring and confirming across a block, but allow ending", () => {
    expect(effectiveFunction("declare_cohabitation")).toContain(
      "if public.is_blocked_between(m.user_id_a, m.user_id_b) then raise exception 'a block exists between the participants' using errcode = '42501'",
    );
    expect(effectiveFunction("respond_cohabitation")).toContain(
      "if p_confirm and public.is_blocked_between(c.user_id_a, c.user_id_b) then",
    );
    expect(effectiveFunction("end_cohabitation")).not.toContain(
      "is_blocked_between",
    );
  });

  it("enforce the move-in month rules on declaring", () => {
    const fn = effectiveFunction("declare_cohabitation");
    expect(fn).toContain(
      "if p_started_month is null or extract(day from p_started_month) <> 1 then",
    );
    expect(fn).toContain(
      "if p_started_month > public.cohabitation_current_month() then",
    );
    expect(fn).toContain(
      "if p_started_month < date_trunc('month', m.created_at at time zone 'europe/ljubljana')::date then",
    );
    expect(effectiveFunction("cohabitation_current_month")).toContain(
      "date_trunc('month', now() at time zone 'europe/ljubljana')::date",
    );
    expect(sql).toContain(
      "revoke all on function public.cohabitation_current_month() from public, anon, authenticated",
    );
  });

  it("refuse a second open declaration and enforce the 30-day cooldown for the same declarer", () => {
    const fn = effectiveFunction("declare_cohabitation");
    expect(fn).toContain(
      "select * into m from public.matches where id = p_match_id for update",
    );
    expect(fn).toContain(
      "where c.match_id = m.id and c.status in ('pending', 'active') ) then raise exception 'an open cohabitation already exists for this match' using errcode = '23505'",
    );
    expect(fn).toContain(
      "where c.match_id = m.id and c.initiated_by = me and c.status = 'declined' and c.declined_at > now() - interval '30 days' ) then raise exception 'cohabitation cooldown",
    );
    expect(fn).toContain(
      "values (m.id, m.user_id_a, m.user_id_b, me, 'pending', p_started_month)",
    );
  });

  it("let only the non-initiator respond, and only to a pending declaration", () => {
    const fn = effectiveFunction("respond_cohabitation");
    expect(fn).toContain(
      "if me = c.initiated_by then raise exception 'only the other participant can respond' using errcode = '42501'",
    );
    expect(fn).toContain(
      "if c.status <> 'pending' then raise exception 'cohabitation is no longer pending'",
    );
    expect(fn).toContain(
      "set status = 'active', confirmed_at = now(), version = version + 1",
    );
    expect(fn).toContain(
      "set status = 'declined', declined_at = now(), version = version + 1",
    );
  });

  it("end only an active cohabitation with a valid end month", () => {
    const fn = effectiveFunction("end_cohabitation");
    expect(fn).toContain(
      "if c.status <> 'active' then raise exception 'cohabitation is not active'",
    );
    expect(fn).toContain(
      "if p_ended_month is null or extract(day from p_ended_month) <> 1 then",
    );
    expect(fn).toContain("if p_ended_month < c.started_month then");
    expect(fn).toContain(
      "if p_ended_month > public.cohabitation_current_month() then",
    );
    expect(fn).toContain(
      "set status = 'ended', ended_month = p_ended_month, ended_at = now(), version = version + 1",
    );
  });
});

describe("block hook", () => {
  it("declines pending declarations between the pair when a block is created", () => {
    const fn = effectiveFunction("decline_cohabitations_on_block");
    expect(fn).toContain("security definer set search_path = public");
    expect(fn).toContain(
      "set status = 'declined', declined_at = now(), version = version + 1 where status = 'pending' and ((user_id_a = new.blocker_id and user_id_b = new.blocked_id) or (user_id_a = new.blocked_id and user_id_b = new.blocker_id))",
    );
    expect(fn).not.toContain("'active'");
    expect(sql).toContain(
      "create trigger decline_cohabitations_on_block after insert on public.blocks for each row execute function public.decline_cohabitations_on_block()",
    );
    expect(sql).toContain(
      "revoke all on function public.decline_cohabitations_on_block() from public, anon, authenticated",
    );
  });
});

describe("account deletion", () => {
  const previous = fnIn(
    read("20261014000000_account_deletion_tombstones.sql"),
    "handle_deleted_user",
  );
  const current = effectiveFunction("handle_deleted_user");

  it("keeps every step of the previous handle_deleted_user", () => {
    expect(fnIn(sql, "handle_deleted_user")).toBe(current);
    expect(statements(previous).length).toBe(9);
    for (const statement of statements(previous))
      expect(current).toContain(statement);
    expect(current).toContain("security definer set search_path = public");
    expect(sql).toContain(
      "revoke all on function public.handle_deleted_user() from public",
    );
  });

  it("declines pending and ends active cohabitations, before the tombstone scrub", () => {
    expect(current).toContain(
      "set status = 'declined', declined_at = now(), version = version + 1 where status = 'pending' and (user_id_a = old.id or user_id_b = old.id)",
    );
    expect(current).toContain(
      "set status = 'ended', ended_month = public.cohabitation_current_month(), ended_at = now(), version = version + 1 where status = 'active' and (user_id_a = old.id or user_id_b = old.id)",
    );
    expect(current.indexOf("update public.cohabitations")).toBeLessThan(
      current.indexOf("update public.profiles"),
    );
    expect(current).not.toContain("delete from public.cohabitations");
  });
});

describe("retention", () => {
  const previous = fnIn(
    read("20261014000400_retention_jobs.sql"),
    "purge_expired_data",
  );
  const current = effectiveFunction("purge_expired_data");

  it("keeps every rule and counter of the previous purge_expired_data", () => {
    expect(fnIn(sql, "purge_expired_data")).toBe(current);
    expect(statements(previous).length).toBe(15);
    for (const statement of statements(previous)) {
      if (statement.startsWith("return jsonb_build_object")) continue;
      expect(current).toContain(statement);
    }
    const counters = previous.match(/'\w+', \w+/g) ?? [];
    expect(counters.length).toBe(7);
    for (const counter of counters) expect(current).toContain(counter);
    expect(sql).toContain(
      "revoke all on function public.purge_expired_data() from public, anon, authenticated",
    );
    expect(sql).not.toMatch(
      /grant execute on function public\.purge_expired_data/,
    );
  });

  it("deletes cohabitations once both participants are tombstones, before tombstones are removed", () => {
    expect(current).toContain(
      "delete from public.cohabitations c using public.profiles a, public.profiles b where a.id = c.user_id_a and b.id = c.user_id_b and a.deleted_at is not null and b.deleted_at is not null",
    );
    expect(current).toContain("'cohabitations', cohabitations_purged");
    expect(current.indexOf("delete from public.cohabitations c")).toBeLessThan(
      current.indexOf("delete from public.matches m"),
    );
    expect(current).toContain(
      "not exists (select 1 from public.cohabitations c where p.id in (c.user_id_a, c.user_id_b))",
    );
  });
});
