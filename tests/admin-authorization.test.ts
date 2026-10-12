import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Static checks only: the SQL is not executed here (no Supabase project or CLI).
const dir = join(process.cwd(), "supabase/migrations");
const files = readdirSync(dir)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const all = files.map((file) =>
  readFileSync(join(dir, file), "utf8").toLowerCase(),
);
const migration = readFileSync(
  join(dir, "20261011000100_admin_authorization_boundary.sql"),
  "utf8",
).toLowerCase();

type Policy = { name: string; table: string; command: string; body: string };

/** The effective policies after applying every migration in order (later `create policy` wins). */
function effectivePolicies(): Map<string, Policy> {
  const policies = new Map<string, Policy>();
  const pattern =
    /create policy (\w+) on ([\w.]+)\s+for (\w+)([\s\S]*?);\s*(?=\n|$)/g;
  for (const sql of all) {
    for (const [, name, table, command, body] of sql.matchAll(pattern)) {
      policies.set(`${table}:${name}`, { name, table, command, body });
    }
  }
  return policies;
}

describe("migration order", () => {
  it("runs after the baseline policies it replaces (later migrations may follow)", () => {
    const index = files.indexOf(
      "20261011000100_admin_authorization_boundary.sql",
    );
    expect(
      files.indexOf("20261007000001_security_and_storage.sql"),
    ).toBeLessThan(index);
  });
});

describe("is_admin()", () => {
  it("is a locked-down security definer helper based on auth.uid()", () => {
    expect(migration).toContain("create or replace function public.is_admin()");
    expect(migration).toMatch(
      /function public\.is_admin\(\)[\s\S]*?security definer[\s\S]*?set search_path = public/,
    );
    expect(migration).toContain("a.user_id = auth.uid()");
    expect(migration).toContain(
      "revoke all on function public.is_admin() from public",
    );
    expect(migration).toContain(
      "grant execute on function public.is_admin() to authenticated",
    );
    expect(migration).not.toMatch(
      /grant execute on function public\.is_admin\(\) to anon/,
    );
  });
});

describe("admins table", () => {
  const policies = [...effectivePolicies().values()].filter(
    (p) => p.table === "public.admins",
  );

  it("only lets users see their own membership", () => {
    expect(policies).toHaveLength(1);
    expect(policies[0]).toMatchObject({
      name: "admins_self_select",
      command: "select",
    });
    expect(policies[0].body).toContain("auth.uid() = user_id");
  });

  it("revokes every write privilege from API roles", () => {
    expect(migration).toContain(
      "revoke insert, update, delete, truncate on public.admins from anon, authenticated",
    );
  });
});

describe("reports", () => {
  const policies = [...effectivePolicies().values()].filter(
    (p) => p.table === "public.reports",
  );
  const byName = new Map(policies.map((p) => [p.name, p]));

  it("allows reading and updating only to admins", () => {
    expect(byName.get("reports_admin_select")?.command).toBe("select");
    expect(byName.get("reports_admin_select")?.body).toContain(
      "public.is_admin()",
    );
    const update = byName.get("reports_admin_update");
    expect(update?.command).toBe("update");
    expect(update?.body).toMatch(/using \(public\.is_admin\(\)\)/);
    expect(update?.body).toMatch(/with check \(public\.is_admin\(\)\)/);
  });

  it("keeps inserts tied to the reporter and has no delete or broad policy", () => {
    expect(byName.get("reports_insert")?.body).toContain(
      "auth.uid() = reporter_id",
    );
    expect(policies.map((p) => p.command).sort()).toEqual([
      "insert",
      "select",
      "update",
    ]);
  });

  it("limits updates to the status column and forbids deletes", () => {
    expect(migration).toContain(
      "revoke update on public.reports from anon, authenticated",
    );
    expect(migration).toContain(
      "grant update (status) on public.reports to authenticated",
    );
    expect(migration).toContain(
      "revoke delete, truncate on public.reports from anon, authenticated",
    );
  });
});

describe("academic verification", () => {
  it("keeps the flag unchanged for signed-in non-admins instead of failing", () => {
    expect(migration).toMatch(
      /auth\.role\(\), ''\) = 'authenticated' and not public\.is_admin\(\)/,
    );
    expect(migration).toContain("new.academic_status_verified := false");
    expect(migration).toContain(
      "new.academic_status_verified := old.academic_status_verified",
    );
    expect(migration).not.toMatch(/protect_academic_verification[\s\S]*raise/);
  });

  it("runs before every insert and update on profiles", () => {
    expect(migration).toMatch(
      /create trigger protect_academic_verification\s+before insert or update on public\.profiles\s+for each row/,
    );
  });
});

describe("web code never bypasses RLS", () => {
  const roots = ["app", "lib", "components"].map((d) => join(process.cwd(), d));
  const sources = roots.flatMap((root) =>
    readdirSync(root, { recursive: true })
      .filter(
        (file): file is string =>
          typeof file === "string" && /\.(ts|tsx)$/.test(file),
      )
      .map((file) => readFileSync(join(root, file), "utf8")),
  );

  it("does not reference the service role or write to admins", () => {
    for (const source of sources) {
      expect(source).not.toMatch(/service_role|SERVICE_ROLE/);
      expect(source).not.toMatch(
        /from\(\s*["']admins["']\s*\)\s*\.(insert|update|upsert|delete)/,
      );
    }
  });
});
