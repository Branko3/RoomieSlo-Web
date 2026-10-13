import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  exportCopy,
  exportFileName,
  exportMyData,
  OWNED_TABLES,
  privacyRequestHref,
  type ExportClient,
} from "../lib/privacy/export";

const ME = "11111111-2222-4333-8444-555555555555";
const NOW = new Date("2026-10-12T09:00:00Z");

type Outcome = { data: unknown; error: unknown } | Error;

function makeClient({
  user = { id: ME, email: "ana@example.test", created_at: "2026-01-01" } as {
    id: string;
    email?: string;
    created_at?: string;
  } | null,
  tables = {} as Record<string, Outcome>,
  files = { data: [{ name: "vpis.pdf" }], error: null } as Outcome,
} = {}) {
  const calls: string[] = [];
  const settle = (o: Outcome) =>
    o instanceof Error ? Promise.reject(o) : Promise.resolve(o);
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user } })) },
    from: (table: string) => ({
      select: (columns: string) => {
        const outcome = tables[table] ?? { data: [{ table }], error: null };
        const filter = {
          eq: (column: string, value: string) => {
            calls.push(`${table}.${columns} ${column}=${value}`);
            return Object.assign(filter, {
              then: (
                resolve: (v: unknown) => unknown,
                reject: (e: unknown) => unknown,
              ) => settle(outcome).then(resolve, reject),
            });
          },
          or: (expression: string) => {
            calls.push(`${table}.${columns} or ${expression}`);
            return settle(outcome);
          },
        };
        return filter;
      },
    }),
    storage: {
      from: (bucket: string) => ({
        list: (path: string) => {
          calls.push(`storage ${bucket}/${path}`);
          return settle(files);
        },
      }),
    },
  };
  return { client: client as unknown as ExportClient, calls };
}

describe("exportMyData", () => {
  it("reads only the signed-in user's rows from every owned table", async () => {
    const { client, calls } = makeClient();
    const result = await exportMyData(client, NOW);
    expect(calls).toEqual([
      ...OWNED_TABLES.map(({ table, column }) => `${table}.* ${column}=${ME}`),
      `matches.* or user_id_a.eq.${ME},user_id_b.eq.${ME}`,
      `storage vpisnice/${ME}`,
    ]);
    expect(result).toMatchObject({
      format: "roomieslo-data-export",
      version: 1,
      exportedAt: "2026-10-12T09:00:00.000Z",
      account: { id: ME, email: "ana@example.test", createdAt: "2026-01-01" },
      matches: [{ table: "matches" }],
      academicDocuments: ["vpis.pdf"],
    });
    expect(Object.keys(result.data)).toEqual(OWNED_TABLES.map((t) => t.table));
  });

  it("covers every table that references the user", () => {
    expect(OWNED_TABLES.map((t) => t.table)).toEqual([
      "profiles",
      "questionnaire_answers",
      "listings",
      "favorites",
      "messages",
      "reports",
    ]);
  });

  it("treats missing data as empty lists", async () => {
    const { client } = makeClient({
      tables: { profiles: { data: null, error: null } },
      files: { data: null, error: null },
    });
    const result = await exportMyData(client, NOW);
    expect(result.data.profiles).toEqual([]);
    expect(result.academicDocuments).toEqual([]);
  });

  it("requires a signed-in user and makes no queries otherwise", async () => {
    const { client, calls } = makeClient({ user: null });
    await expect(exportMyData(client, NOW)).rejects.toMatchObject({
      kind: "signed-out",
      message: exportCopy.signedOut,
    });
    expect(calls).toEqual([]);
  });

  it("maps failures to safe copy instead of partial exports", async () => {
    await expect(
      exportMyData(
        makeClient({ tables: { listings: new TypeError("Failed to fetch") } })
          .client,
        NOW,
      ),
    ).rejects.toMatchObject({ kind: "offline" });
    await expect(
      exportMyData(
        makeClient({ files: { data: null, error: { message: "denied" } } })
          .client,
        NOW,
      ),
    ).rejects.toMatchObject({ kind: "failed", message: exportCopy.failed });
  });
});

describe("helpers", () => {
  it("names the export file without the full id", () => {
    expect(exportFileName(ME, NOW)).toBe(
      "roomieslo-podatki-11111111-2026-10-12.json",
    );
  });

  it("builds request emails with an encoded subject and optional id", () => {
    expect(privacyRequestHref("zasebnost@roomieslo.si", "deletion")).toBe(
      "mailto:zasebnost@roomieslo.si?subject=Zahteva%20za%20izbris%20ra%C4%8Duna&body=Opis%20zahteve%3A%0A",
    );
    expect(
      decodeURIComponent(
        privacyRequestHref("p@x.si", "correction", ME).split("body=")[1],
      ),
    ).toContain(`ID računa: ${ME}`);
  });
});

describe("privacy procedures document", () => {
  const doc = readFileSync(
    join(process.cwd(), "docs/operations/privacy-procedures.md"),
    "utf8",
  );

  it("covers requests, verification, deletion, minimisation, breaches, and review", () => {
    for (const heading of [
      "## 1. Requests and deadlines",
      "## 2. Identity verification",
      "## 3. Account deletion procedure (operator)",
      "## 4. Data minimisation in operations",
      "## 5. Personal-data incident (breach) response",
      "## 6. Retention review (quarterly)",
      "## Open decisions",
    ]) {
      expect(doc).toContain(heading);
    }
  });

  it("deletes Storage documents before the Auth user and verifies afterwards", () => {
    const storage = doc.indexOf("**Delete academic documents:**");
    const auth = doc.indexOf("**Delete the Auth user:**");
    const verify = doc.indexOf("**Verify** in the SQL editor");
    expect(storage).toBeGreaterThan(0);
    expect(storage).toBeLessThan(auth);
    expect(auth).toBeLessThan(verify);
  });

  it("states the 72-hour breach notification and follows the approved retention record", () => {
    expect(doc).toContain("72 hours");
    expect(doc).toContain("account-document-deletion-retention-rules.md");
    expect(doc).toMatch(/approved on\s+2026-10-12/);
    // The tombstone trigger replaced the cascade; old "awaiting migration" requests are finished with it.
    expect(doc).toContain("on_auth_user_deleted");
    expect(doc).toContain("deleted_user_safety_records");
    expect(doc).not.toMatch(/on delete cascade. this removes/i);
  });
});
