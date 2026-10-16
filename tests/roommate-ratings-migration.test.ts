import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { IMPROVEMENT_TAGS, STRENGTH_TAGS } from "../lib/ratings/tags";

// Static checks only: the SQL is not executed here (no Supabase project or CLI).
const NAME = "20261016000100_roommate_ratings.sql";
const PREVIOUS = "20261016000000_cohabitations.sql";
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

function statements(fn: string): string[] {
  const body = fn.slice(fn.indexOf(" begin ") + 7, fn.lastIndexOf(" end; $$;"));
  return body
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

const submit = () => effectiveFunction("submit_roommate_rating");
const summary = () => effectiveFunction("rating_summary");
const mine = () => effectiveFunction("my_rating_summary");

describe("migration order", () => {
  it("runs after the cohabitation migration it builds on", () => {
    expect(files.indexOf(NAME)).toBeGreaterThan(files.indexOf(PREVIOUS));
    expect(files.at(-1)).toBe(NAME);
  });
});

describe("roommate_ratings table", () => {
  it("has the planned columns, one rating per rater and cohabitation", () => {
    for (const column of [
      "cohabitation_id uuid not null references public.cohabitations (id) on delete cascade",
      "rater_id uuid not null references public.profiles (id)",
      "rated_id uuid not null references public.profiles (id)",
      "would_live_again boolean not null",
      "strengths text[] not null default '{}'",
      "improvements text[] not null default '{}'",
      "status text not null default 'hidden' check (status in ('hidden', 'revealed'))",
      "submitted_at timestamptz not null default now()",
      "revealed_at timestamptz",
      "updated_at timestamptz not null default now()",
      "constraint roommate_ratings_one_per_rater unique (cohabitation_id, rater_id)",
      "check (rater_id <> rated_id)",
    ])
      expect(sql).toContain(column);
  });

  it("limits tags to 3 from the fixed sets, matching lib/ratings/tags.ts", () => {
    expect(sql).toContain(
      "check (cardinality(strengths) <= 3 and strengths <@ public.rating_strength_tags())",
    );
    expect(sql).toContain(
      "check (cardinality(improvements) <= 3 and improvements <@ public.rating_improvement_tags())",
    );
    expect(effectiveFunction("rating_strength_tags")).toContain(
      `array[${STRENGTH_TAGS.map((t) => `'${t}'`).join(", ")}]::text[]`,
    );
    expect(effectiveFunction("rating_improvement_tags")).toContain(
      `array[${IMPROVEMENT_TAGS.map((t) => `'${t}'`).join(", ")}]::text[]`,
    );
  });

  it("adds the opt-out, on by default, editable through the owner's profile policy", () => {
    expect(sql).toContain(
      "alter table public.profiles add column if not exists show_roommate_ratings boolean not null default true",
    );
    // The profile guards still pin only their own columns.
    expect(effectiveFunction("protect_academic_verification")).not.toContain(
      "show_roommate_ratings",
    );
    expect(effectiveFunction("protect_profile_tombstone")).not.toContain(
      "show_roommate_ratings",
    );
    expect(all.join(" ")).toContain(
      "create policy profiles_update on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id)",
    );
  });
});

describe("row-level security", () => {
  it("lets raters read only their own ratings, and nobody write directly", () => {
    expect(sql).toContain(
      "alter table public.roommate_ratings enable row level security",
    );
    const policies = all
      .join(" ")
      .match(/create policy \w+ on public\.roommate_ratings for \w+[^;]*/g);
    expect(policies).toEqual([
      "create policy roommate_ratings_select_own on public.roommate_ratings for select to authenticated using (auth.uid() = rater_id)",
    ]);
    expect(sql).toContain(
      "revoke all on public.roommate_ratings from anon, authenticated",
    );
    expect(sql).toContain(
      "grant select on public.roommate_ratings to authenticated",
    );
    expect(sql).not.toMatch(
      /grant (all|insert|update|delete)[^;]* on public\.roommate_ratings/,
    );
  });
});

describe("submit_roommate_rating", () => {
  it("is a security-definer RPC for signed-in users", () => {
    expect(submit()).toContain("security definer set search_path = public");
    expect(submit()).toContain(
      "if me is null then raise exception 'not signed in' using errcode = '42501'",
    );
    expect(sql).toContain(
      "revoke all on function public.submit_roommate_rating(uuid, boolean, text[], text[]) from public, anon",
    );
    expect(sql).toContain(
      "grant execute on function public.submit_roommate_rating(uuid, boolean, text[], text[]) to authenticated",
    );
  });

  it("requires a participant of a confirmed cohabitation, with no deleted profile", () => {
    expect(submit()).toContain(
      "select * into c from public.cohabitations where id = p_cohabitation_id for update",
    );
    expect(submit()).toContain(
      "if not found or me not in (c.user_id_a, c.user_id_b) then raise exception 'cohabitation is unavailable or caller is not a participant' using errcode = '42501'",
    );
    expect(submit()).toContain(
      "if c.status not in ('active', 'ended') or c.confirmed_at is null then raise exception 'cohabitation is not confirmed' using errcode = '42501'",
    );
    expect(submit()).toContain(
      "if public.is_deleted_profile(me) or public.is_deleted_profile(other) then",
    );
    // A block doesn't stop rating (plan §4.6).
    expect(submit()).not.toContain("is_blocked_between");
  });

  it("validates the answer and the tags", () => {
    expect(submit()).toContain(
      "if p_would_live_again is null then raise exception 'rating answer is required' using errcode = '22023'",
    );
    for (const [set, fn] of [
      ["v_strengths", "rating_strength_tags"],
      ["v_improvements", "rating_improvement_tags"],
    ]) {
      expect(submit()).toContain(`if cardinality(${set}) > 3`);
      expect(submit()).toContain(`or not ${set} <@ public.${fn}()`);
      expect(submit()).toContain(
        `or cardinality(${set}) <> (select count(distinct t) from unnest(${set}) t)`,
      );
    }
  });

  it("enforces the window: 2 months after move-in or at the end, closing 60 days after the end", () => {
    expect(effectiveFunction("rating_window_opens_at")).toContain(
      "least( (c.started_month + interval '2 months')::timestamp at time zone 'europe/ljubljana', c.ended_at )",
    );
    expect(effectiveFunction("rating_window_closes_at")).toContain(
      "select c.ended_at + interval '60 days'",
    );
    expect(submit()).toContain(
      "if now() < public.rating_window_opens_at(c) then raise exception 'rating window is not open yet'",
    );
    expect(submit()).toContain(
      "if c.ended_at is not null and now() > public.rating_window_closes_at(c) then raise exception 'rating window has closed'",
    );
  });

  it("allows edits while hidden, and updates every 6 months while still living together", () => {
    expect(submit()).toContain("elsif existing.status = 'hidden' then");
    expect(submit()).toContain(
      "elsif c.status = 'active' and existing.submitted_at <= now() - interval '6 months' then",
    );
    expect(submit()).toContain(
      "else raise exception 'rating cannot be updated yet' using errcode = 'p0001'",
    );
  });

  it("reveals both ratings once the second one arrives", () => {
    expect(submit()).toContain(
      "if (select count(*) from public.roommate_ratings where cohabitation_id = c.id) = 2 then update public.roommate_ratings set status = 'revealed', revealed_at = now() where cohabitation_id = c.id and status = 'hidden'",
    );
  });
});

describe("summaries", () => {
  const counted = () => effectiveFunction("counted_ratings");

  it("rating_summary works without auth.uid() and returns aggregates only", () => {
    expect(summary()).toContain("security definer set search_path = public");
    expect(summary()).not.toContain("auth.uid()");
    expect(summary()).not.toMatch(/rater_id|improvements/);
    expect(sql).toContain(
      "grant execute on function public.rating_summary(uuid) to authenticated, service_role",
    );
    expect(sql).toContain(
      "grant execute on function public.rating_summaries(uuid[]) to service_role",
    );
    expect(sql).toContain(
      "revoke all on function public.rating_summaries(uuid[]) from public, anon, authenticated",
    );
  });

  it("is insufficient for deleted profiles and below 3, hidden after opt-out", () => {
    expect(summary()).toContain(
      "if not found or p.deleted_at is not null then return jsonb_build_object('state', 'insufficient')",
    );
    expect(summary()).toContain(
      "if not p.show_roommate_ratings then return jsonb_build_object('state', 'hidden')",
    );
    expect(summary()).toContain(
      "if total < 3 then return jsonb_build_object('state', 'insufficient')",
    );
    // No count leaks below the threshold in the public summary.
    expect(summary()).not.toMatch(/'insufficient', 'count'/);
  });

  it("counts each rater once: their latest revealed rating from the last 36 months", () => {
    expect(counted()).toContain(
      "select distinct on (r.rater_id) r.would_live_again, r.strengths, r.improvements from public.roommate_ratings r where r.rated_id = p_profile_id and r.status = 'revealed' and r.submitted_at > now() - interval '36 months' order by r.rater_id, r.submitted_at desc",
    );
    expect(counted()).toContain("security definer set search_path = public");
    expect(sql).toContain(
      "revoke all on function public.counted_ratings(uuid) from public, anon, authenticated",
    );
    // Both summaries read only the counted set, never the table directly.
    for (const fn of [summary(), mine()]) {
      expect(fn).toContain("from public.counted_ratings(");
      expect(fn).not.toContain("from public.roommate_ratings");
    }
  });

  it("shows the top 3 strengths", () => {
    expect(summary()).toContain(
      "'strengths', public.rating_tag_counts(tags, public.rating_strength_tags(), 3)",
    );
    expect(effectiveFunction("rating_tag_counts")).toContain(
      "order by count(*) desc, array_position(p_order, tag) limit p_limit",
    );
  });

  it("my_rating_summary adds my private improvements and my count below 3", () => {
    expect(mine()).toContain("me uuid := auth.uid()");
    expect(mine()).toContain("from public.counted_ratings(me) c");
    expect(mine()).not.toContain("rater_id");
    expect(mine()).toContain(
      "return jsonb_build_object('state', 'insufficient', 'count', total,",
    );
    expect(mine()).toContain(
      "'improvements', public.rating_tag_counts(improvement_tags, public.rating_improvement_tags(), null)",
    );
    expect(sql).toContain(
      "grant execute on function public.my_rating_summary() to authenticated",
    );
  });
});

describe("account deletion", () => {
  const previous = fnIn(read(PREVIOUS), "handle_deleted_user");
  const current = effectiveFunction("handle_deleted_user");

  it("keeps every step of the previous handle_deleted_user", () => {
    expect(statements(previous).length).toBe(11);
    for (const statement of statements(previous))
      expect(current).toContain(statement);
  });

  it("deletes ratings the user received, and keeps the ones they gave", () => {
    expect(current).toContain(
      "delete from public.roommate_ratings where rated_id = old.id",
    );
    expect(current).not.toMatch(
      /delete from public\.roommate_ratings where rater_id/,
    );
    expect(current.indexOf("delete from public.roommate_ratings")).toBeLessThan(
      current.indexOf("update public.profiles"),
    );
  });
});

describe("retention", () => {
  const previous = fnIn(read(PREVIOUS), "purge_expired_data");
  const current = effectiveFunction("purge_expired_data");

  it("keeps every rule and counter of the previous purge_expired_data", () => {
    expect(statements(previous).length).toBe(17);
    for (const statement of statements(previous)) {
      if (statement.startsWith("return jsonb_build_object")) continue;
      expect(current).toContain(statement);
    }
    const counters = previous.match(/'\w+', \w+/g) ?? [];
    expect(counters.length).toBe(8);
    for (const counter of counters) expect(current).toContain(counter);
    expect(sql).toContain(
      "revoke all on function public.purge_expired_data() from public, anon, authenticated",
    );
  });

  it("reveals after 14 days or at window close", () => {
    expect(current).toContain(
      "update public.roommate_ratings r set status = 'revealed', revealed_at = now() from public.cohabitations c where c.id = r.cohabitation_id and r.status = 'hidden' and (r.submitted_at <= now() - interval '14 days' or (c.ended_at is not null and public.rating_window_closes_at(c) <= now()))",
    );
    expect(current).toContain("'ratings_revealed', ratings_revealed");
  });

  it("deletes ratings 36 months after the end, or after the latest submission while active", () => {
    expect(current).toContain(
      "delete from public.roommate_ratings r using public.cohabitations c where c.id = r.cohabitation_id and ((c.ended_at is not null and c.ended_at < now() - interval '36 months') or (c.ended_at is null and r.submitted_at < now() - interval '36 months'))",
    );
    expect(current).toContain("'ratings', ratings_purged");
  });

  it("keeps a tombstone while a rating refers to it", () => {
    expect(current).toContain(
      "not exists (select 1 from public.roommate_ratings q where p.id in (q.rater_id, q.rated_id))",
    );
  });
});
