import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationsDir = join(root, "supabase", "migrations");
const migrationNames = readdirSync(migrationsDir).sort();
const migrations = Object.fromEntries(
  migrationNames.map((name) => [name, readFileSync(join(migrationsDir, name), "utf8")]),
);
const baseline = migrations["20261007000000_android_baseline.sql"];
const security = migrations["20261007000001_security_and_storage.sql"];
const display = migrations["20261007000002_display_fields.sql"];
const matching = migrations["20261007000003_indexes_and_matching.sql"];
const hardening = migrations["20261007000004_policy_update_hardening.sql"];
const feature = readFileSync(join(root, "docs", "features", "reproducible-sql-migrations.md"), "utf8");

describe("reproducible SQL migration contract", () => {
  it("keeps the production chain ordered and separate from the development seed", () => {
    expect(migrationNames).toEqual([
      "20261007000000_android_baseline.sql",
      "20261007000001_security_and_storage.sql",
      "20261007000002_display_fields.sql",
      "20261007000003_indexes_and_matching.sql",
      "20261007000004_policy_update_hardening.sql",
    ]);
    expect(readFileSync(join(root, "supabase", "seed.sql"), "utf8")).not.toMatch(
      /\binsert\s+into\b/i,
    );
    expect(Object.values(migrations).join("\n")).not.toMatch(/demo_oglasi|presentation data/i);
  });

  it("preserves Android tables, relationships, nullability, and status checks", () => {
    for (const table of [
      "profiles",
      "questionnaire_answers",
      "listings",
      "matches",
      "messages",
      "favorites",
      "reports",
    ]) {
      expect(baseline).toMatch(new RegExp(`create table if not exists public\\.${table}\\b`, "i"));
    }
    expect(baseline).toMatch(/id uuid primary key references auth\.users \(id\) on delete cascade/i);
    expect(baseline).toMatch(/profile_id uuid not null references public\.profiles/i);
    expect(baseline).toMatch(/owner_id uuid not null references public\.profiles/i);
    expect(baseline).toMatch(/status text not null default 'pending'[\s\S]*'pending', 'accepted', 'rejected'/i);
    expect(baseline).toMatch(/delivery_status text not null default 'sent'[\s\S]*'sent', 'delivered', 'read'/i);
    expect(baseline).toMatch(/status text not null default 'open'[\s\S]*'open', 'reviewed', 'dismissed'/i);
    expect(display).toMatch(/available_from date;/i);
    expect(display).toMatch(/size_sqm integer;/i);
    expect(display).toMatch(/deposit numeric\(10, 2\);/i);
  });

  it("installs the Auth profile trigger and Realtime messages publication", () => {
    expect(baseline).toMatch(/create or replace function public\.handle_new_user\(\)/i);
    expect(baseline).toMatch(/create trigger on_auth_user_created[\s\S]*handle_new_user/i);
    expect(baseline).toMatch(/supabase_realtime[\s\S]*public\.messages/i);
  });

  it("represents every RLS and private Storage policy surface", () => {
    for (const policy of [
      "profiles_select",
      "profiles_insert",
      "profiles_update",
      "qa_select",
      "qa_modify",
      "listings_select",
      "listings_insert",
      "listings_update",
      "listings_delete",
      "matches_select",
      "matches_insert",
      "matches_update",
      "messages_select",
      "messages_insert",
      "favorites_all",
      "admins_self_select",
      "reports_insert",
      "reports_admin_select",
      "reports_admin_update",
    ]) {
      expect(security).toMatch(new RegExp(`create policy ${policy}\\b`, "i"));
    }
    expect(security).toMatch(/values \('vpisnice', 'vpisnice', false\)/i);
    expect(security).toMatch(/bucket_id = 'vpisnice'/i);
    expect(hardening).toMatch(/messages_update[\s\S]*with check/i);
    expect(hardening).toMatch(/reports_admin_update[\s\S]*with check/i);
    expect(hardening).toMatch(/vpisnice_update[\s\S]*with check/i);
  });

  it("prevents duplicate favorites and canonical duplicate or self matches", () => {
    expect(baseline).toMatch(/primary key \(profile_id, listing_id\)/i);
    expect(matching).toMatch(/duplicate match pairs exist/i);
    expect(matching).toMatch(/matches_distinct_users[\s\S]*user_id_a <> user_id_b/i);
    expect(matching).toMatch(/matches_user_pair_idx[\s\S]*least\(user_id_a, user_id_b\)[\s\S]*greatest/i);
  });

  it("exposes participant-only atomic match acceptance", () => {
    expect(matching).toMatch(/create or replace function public\.accept_match\(p_match_id uuid\)/i);
    expect(matching).toMatch(/status = 'accepted', version = version \+ 1/i);
    expect(matching).toMatch(/status = 'pending'[\s\S]*auth\.uid\(\) = user_id_a or auth\.uid\(\) = user_id_b/i);
    expect(matching).toMatch(/revoke all on function public\.accept_match\(uuid\) from public/i);
    expect(matching).toMatch(/grant execute on function public\.accept_match\(uuid\) to authenticated/i);
  });

  it("documents setup, inspection, replay, recovery, and operator-managed settings", () => {
    for (const phrase of [
      "npm run db:push",
      "npm run db:status",
      "supabase db diff",
      "supabase db reset",
      "new migration",
      "Auth providers",
      "email delivery",
      "backups",
      "environment secrets",
    ]) {
      expect(feature).toContain(phrase);
    }
  });
});
