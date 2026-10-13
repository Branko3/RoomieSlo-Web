import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Static checks only: the SQL and the Deno function are not executed here.
const dir = join(process.cwd(), "supabase/migrations");
const all = readdirSync(dir)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) =>
    readFileSync(join(dir, file), "utf8")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim(),
  );
const fn = readFileSync(
  join(process.cwd(), "supabase/functions/recommendations/index.ts"),
  "utf8",
);

/** The last definition of a policy across all migrations. */
function effectivePolicy(name: string): string {
  let body = "";
  const pattern = new RegExp(
    `create policy ${name} on public\\.questionnaire_answers (.*?);(?= drop| create| alter| revoke| grant| --|$)`,
    "g",
  );
  for (const sql of all) for (const [, b] of sql.matchAll(pattern)) body = b;
  return body;
}

describe("questionnaire answers are private", () => {
  it("are readable only by their owner", () => {
    expect(effectivePolicy("qa_select")).toBe(
      "for select to authenticated using (auth.uid() = profile_id)",
    );
    expect(effectivePolicy("qa_modify")).toContain(
      "using (auth.uid() = profile_id)",
    );
  });
});

describe("recommendations Edge Function", () => {
  it("identifies the caller from the token only", () => {
    expect(fn).toContain("admin.auth.getUser(token)");
    expect(fn).not.toMatch(/request\.json\(\)/);
    expect(fn).toContain('.eq("profile_id", user.id)');
    expect(fn).toContain('.neq("id", user.id)');
  });

  it("scores with the shared, parity-tested code and returns no answers", () => {
    expect(fn).toContain('from "../_shared/compatibility.ts"');
    expect(fn).toContain("scoreCandidates(");
    expect(fn).toContain("return json({ myAnswers, recommendations: ranked })");
    // scoreCandidates strips `answers` (see tests/recommendations.test.ts).
  });

  it("keeps the service-role key in the function environment", () => {
    expect(fn).toContain('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');
    const tsconfig = readFileSync(join(process.cwd(), "tsconfig.json"), "utf8");
    expect(tsconfig).toContain('"supabase/functions"');
  });
});
