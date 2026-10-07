import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const migrations = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const sql = migrations
  .map((file) => readFileSync(join(migrationsDir, file), "utf8"))
  .join("\n");
const securityMigration = readFileSync(
  join(migrationsDir, "20261007000001_security_and_storage.sql"),
  "utf8",
);

describe("Supabase security migration contract", () => {
  it("keeps production migrations ordered and excludes demo data", () => {
    expect(migrations).toEqual([
      "20261007000000_android_baseline.sql",
      "20261007000001_security_and_storage.sql",
      "20261007000002_display_fields.sql",
      "20261007000003_indexes_and_matching.sql",
    ]);
    expect(sql).not.toMatch(/insert into public\.(listings|matches|messages)\b/i);
  });

  it("enables RLS and keeps every protected table authenticated-only", () => {
    for (const table of [
      "profiles",
      "questionnaire_answers",
      "listings",
      "matches",
      "messages",
      "favorites",
      "reports",
      "admins",
    ]) {
      expect(securityMigration).toContain(`alter table public.${table} enable row level security;`);
    }
    expect(securityMigration).not.toMatch(/\bto anon\b/i);
  });

  it("preserves owner and participant boundaries", () => {
    expect(securityMigration).toMatch(/auth\.uid\(\) = id/);
    expect(securityMigration).toMatch(/auth\.uid\(\) = profile_id/);
    expect(securityMigration).toMatch(/auth\.uid\(\) = owner_id/);
    expect(securityMigration).toMatch(/auth\.uid\(\) = user_id_a or auth\.uid\(\) = user_id_b/);
    expect(securityMigration).toMatch(/auth\.uid\(\) = sender_id/);
    expect(securityMigration).toMatch(/exists \([\s\S]*select 1 from public\.matches/);
  });

  it("keeps reports administrator-only and academic documents private", () => {
    expect(securityMigration).toMatch(/reports_admin_select[\s\S]*exists[\s\S]*public\.admins/);
    expect(securityMigration).toMatch(/reports_admin_update[\s\S]*exists[\s\S]*public\.admins/);
    expect(securityMigration).toMatch(
      /values \('vpisnice', 'vpisnice', false\)[\s\S]*public = false/,
    );
    expect(securityMigration).toMatch(/bucket_id = 'vpisnice'/);
    expect(securityMigration).toMatch(/storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
    expect(securityMigration).toMatch(/or exists \(select 1 from public\.admins/);
  });

  it("publishes only messages for Realtime and protects match acceptance", () => {
    expect(sql).toMatch(/alter publication supabase_realtime add table public\.messages/);
    expect(sql).toMatch(/create or replace function public\.accept_match/);
    expect(sql).toMatch(/auth\.uid\(\) = user_id_a or auth\.uid\(\) = user_id_b/);
    expect(sql).toMatch(/revoke all on function public\.accept_match\(uuid\) from public/);
    expect(sql).toMatch(/grant execute on function public\.accept_match\(uuid\) to authenticated/);
  });
});
