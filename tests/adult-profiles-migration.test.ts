import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROFILE_LIMITS } from "../lib/profile/own-profile";

// Static checks only: the SQL is not executed here (no Supabase project or CLI).
const NAME = "20261016000200_adult_profiles.sql";
const dir = join(process.cwd(), "supabase/migrations");
const files = readdirSync(dir)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const sql = readFileSync(join(dir, NAME), "utf8")
  .toLowerCase()
  .replace(/--.*$/gm, "")
  .replace(/\s+/g, " ")
  .trim();

describe("adult profiles (18+)", () => {
  it("runs after the migration that added profiles.age", () => {
    expect(files.indexOf(NAME)).toBeGreaterThan(
      files.indexOf("20261007000002_display_fields.sql"),
    );
  });

  it("refuses ages under 18 for new and changed rows without failing on existing ones", () => {
    expect(sql).toContain(
      "alter table public.profiles add constraint profiles_age_adult check (age is null or age >= 18) not valid",
    );
    expect(sql).toContain(
      "alter table public.profiles drop constraint if exists profiles_age_adult",
    );
  });

  it("matches the profile form's minimum age", () => {
    expect(PROFILE_LIMITS.ageMin).toBe(18);
  });
});
