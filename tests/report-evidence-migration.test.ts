import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Static checks only: the SQL is not executed here (no Supabase project or CLI).
const NAME = "20261014000100_report_evidence.sql";
const dir = join(process.cwd(), "supabase/migrations");
const files = readdirSync(dir)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const squash = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const all = files.map((file) => squash(readFileSync(join(dir, file), "utf8")));
const sql = squash(readFileSync(join(dir, NAME), "utf8"));
const submit = sql.match(
  /create or replace function public\.submit_report\(.*?\$\$;/,
)![0];

describe("report evidence", () => {
  it("runs after the migration that links reports to conversations", () => {
    expect(files.indexOf(NAME)).toBeGreaterThan(
      files.indexOf("20261014000000_account_deletion_tombstones.sql"),
    );
  });

  it("stores roles, not user ids, and goes with its report", () => {
    expect(sql).toContain(
      "report_id uuid not null references public.reports (id) on delete cascade",
    );
    expect(sql).toContain(
      "sender_role text not null check (sender_role in ('reporter', 'reported'))",
    );
    expect(sql).not.toMatch(/report_evidence \([^)]*sender_id/);
  });

  it("is closed to every API role", () => {
    expect(sql).toContain(
      "alter table public.report_evidence enable row level security",
    );
    expect(sql).toContain(
      "revoke all on public.report_evidence from anon, authenticated",
    );
    expect(all.join(" ")).not.toMatch(
      /create policy \w+ on public\.report_evidence/,
    );
  });
});

describe("submit_report", () => {
  it("is a locked-down security definer function for signed-in users", () => {
    expect(submit).toContain("security definer set search_path = public");
    expect(sql).toContain(
      "revoke all on function public.submit_report(uuid, text, text, uuid) from public",
    );
    expect(sql).toContain(
      "grant execute on function public.submit_report(uuid, text, text, uuid) to authenticated",
    );
    expect(sql).not.toMatch(
      /grant execute on function public\.submit_report.* to anon/,
    );
  });

  it("files as the caller and refuses self-reports and bad input", () => {
    expect(submit).toContain("me uuid := auth.uid()");
    expect(submit).toContain("if me is null then");
    expect(submit).toContain("p_reported = me");
    expect(submit).toContain("length(p_reason) > 100");
    expect(submit).toContain("length(coalesce(p_description, '')) > 2000");
    expect(submit).toContain(
      "insert into public.reports (reporter_id, reported_id, reason, description, match_id) values (me, p_reported,",
    );
  });

  it("accepts only a conversation between the reporter and the reported user", () => {
    expect(submit).toContain(
      "((m.user_id_a = me and m.user_id_b = p_reported) or (m.user_id_b = me and m.user_id_a = p_reported))",
    );
    expect(submit).toContain("raise exception 'invalid conversation'");
  });

  it("snapshots the last 200 messages with anonymized roles", () => {
    expect(submit).toContain(
      "case when recent.sender_id = me then 'reporter' else 'reported' end",
    );
    expect(submit).toContain("order by sent_at desc limit 200");
  });

  it("is the only way to file a report", () => {
    expect(sql).toContain(
      "revoke insert on public.reports from anon, authenticated",
    );
    expect(sql).toContain(
      "drop policy if exists reports_insert on public.reports",
    );
  });
});
