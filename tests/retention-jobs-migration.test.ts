import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Static checks only: the SQL is not executed here (no Supabase project or CLI).
const NAME = "20261014000400_retention_jobs.sql";
const dir = join(process.cwd(), "supabase/migrations");
const files = readdirSync(dir)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const sql = readFileSync(join(dir, NAME), "utf8")
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

describe("purge_expired_data", () => {
  it("runs after every table it cleans up exists", () => {
    for (const dependency of [
      "20261014000000_account_deletion_tombstones.sql",
      "20261014000200_admin_report_conversation.sql",
      "20261014000300_deletion_register.sql",
    ])
      expect(files.indexOf(NAME)).toBeGreaterThan(files.indexOf(dependency));
  });

  it("is never callable through the API", () => {
    expect(sql).toContain("security definer set search_path = public");
    expect(sql).toContain(
      "revoke all on function public.purge_expired_data() from public, anon, authenticated",
    );
    expect(sql).not.toMatch(
      /grant execute on function public\.purge_expired_data/,
    );
  });

  it("applies the approved periods", () => {
    for (const rule of [
      // Reports and evidence: 12 months after closing.
      "delete from public.reports where closed_at is not null and closed_at < now() - interval '12 months'",
      // Admin read log: 12 months.
      "delete from public.admin_message_reads where read_at < now() - interval '12 months'",
      // Deletion register: subject 30 days, row 90 days.
      "set subject = null where subject is not null and requested_at < now() - interval '30 days'",
      "delete from public.deletion_register where requested_at < now() - interval '90 days'",
    ])
      expect(sql).toContain(rule);
  });

  it("deletes a conversation only when both people are gone and no report needs it", () => {
    expect(sql).toContain(
      "a.deleted_at is not null and b.deleted_at is not null and not exists (select 1 from public.reports r where r.match_id = m.id)",
    );
  });

  it("keeps a safety record while a report about the person is open or recently closed", () => {
    expect(sql).toContain("s.deleted_at < now() - interval '30 days'");
    expect(sql).toContain(
      "r.reported_id = s.profile_id and (r.status = 'open' or r.closed_at > now() - interval '12 months')",
    );
  });

  it("removes a tombstone only when nothing refers to it, after the other rules ran", () => {
    const tombstones = sql.indexOf(
      "delete from public.profiles p where p.deleted_at is not null",
    );
    expect(tombstones).toBeGreaterThan(
      sql.indexOf("delete from public.matches m"),
    );
    expect(tombstones).toBeGreaterThan(
      sql.indexOf("delete from public.deleted_user_safety_records s"),
    );
    for (const reference of [
      "from public.matches m where p.id in (m.user_id_a, m.user_id_b)",
      "from public.messages x where x.sender_id = p.id",
      "from public.reports r where p.id in (r.reporter_id, r.reported_id)",
      "from public.deleted_user_safety_records s where s.profile_id = p.id",
    ])
      expect(sql).toContain(reference);
  });

  it("is scheduled daily with pg_cron when available", () => {
    expect(sql).toContain(
      "if exists (select 1 from pg_available_extensions where name = 'pg_cron')",
    );
    expect(sql).toContain(
      "perform cron.schedule( 'purge-expired-data', '15 3 * * *', 'select public.purge_expired_data()' )",
    );
    expect(sql).toContain("perform cron.unschedule('purge-expired-data')");
  });
});
