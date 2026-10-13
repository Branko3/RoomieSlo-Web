import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Static checks only: the SQL is not executed here (no Supabase project or CLI).
const NAME = "20261014000200_admin_report_conversation.sql";
const dir = join(process.cwd(), "supabase/migrations");
const files = readdirSync(dir)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const squash = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const all = files.map((file) => squash(readFileSync(join(dir, file), "utf8")));
const sql = squash(readFileSync(join(dir, NAME), "utf8"));
const fn = sql.match(
  /create or replace function public\.admin_report_conversation\(.*?\$\$;/,
)![0];

describe("admin message-read audit log", () => {
  it("runs after the evidence migration it reads from", () => {
    expect(files.indexOf(NAME)).toBeGreaterThan(
      files.indexOf("20261014000100_report_evidence.sql"),
    );
  });

  it("is readable by admins and append-only for everyone", () => {
    expect(sql).toContain(
      "alter table public.admin_message_reads enable row level security",
    );
    expect(sql).toContain(
      "revoke all on public.admin_message_reads from anon, authenticated",
    );
    expect(sql).toContain(
      "grant select on public.admin_message_reads to authenticated",
    );
    expect(sql).toContain(
      "for select to authenticated using (public.is_admin())",
    );
    expect(all.join(" ")).not.toMatch(
      /create policy \w+ on public\.admin_message_reads for (insert|update|delete|all)/,
    );
  });
});

describe("admin_report_conversation", () => {
  it("is admin-only and records the read before returning anything", () => {
    expect(fn).toContain("security definer set search_path = public");
    const check = fn.indexOf("if not public.is_admin() then");
    const audit = fn.indexOf("insert into public.admin_message_reads");
    const firstReturn = fn.indexOf("return query");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(audit);
    expect(audit).toBeLessThan(firstReturn);
    expect(fn).toContain("values (auth.uid(), p_report_id)");
  });

  it("returns the evidence snapshot, or the linked live conversation, by role only", () => {
    expect(fn).toContain(
      "from public.report_evidence e where e.report_id = p_report_id",
    );
    expect(fn).toContain("elsif r.match_id is not null then");
    expect(fn).toContain(
      "case when m.sender_id = r.reporter_id then 'reporter' else 'reported' end",
    );
    expect(fn).toContain("where m.match_id = r.match_id");
    expect(fn).not.toMatch(/returns table \([^)]*sender_id/);
  });

  it("never gives admins a direct select on messages", () => {
    expect(all.join(" ")).not.toMatch(
      /create policy \w+ on public\.messages for select[^;]*is_admin/,
    );
    expect(sql).toContain(
      "grant execute on function public.admin_report_conversation(uuid) to authenticated",
    );
    expect(sql).toContain(
      "revoke all on function public.admin_report_conversation(uuid) from public",
    );
  });
});
