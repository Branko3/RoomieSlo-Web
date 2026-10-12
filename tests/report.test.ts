import { describe, expect, it, vi } from "vitest";
import {
  backHref,
  buildReport,
  contextNote,
  DEFAULT_REASON,
  DESCRIPTION_MAX,
  listingReportHref,
  parseReportContext,
  REPORT_REASONS,
  reportCopy,
  submitReport,
  validateReport,
  type NewReport,
  type ReportClient,
  type ReportDraft,
} from "../lib/reports/report";

const ME = "11111111-1111-4111-8111-111111111111";
const PEER = "22222222-2222-4222-8222-222222222222";

function draft(overrides: Partial<ReportDraft> = {}): ReportDraft {
  return {
    reportedId: PEER,
    reason: DEFAULT_REASON,
    description: "",
    context: null,
    ...overrides,
  };
}

function makeClient({
  user = { id: ME } as { id: string } | null,
  insert = { error: null } as { error: unknown } | Error,
} = {}) {
  const inserted: NewReport[] = [];
  const tables: string[] = [];
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    from: (table: string) => {
      tables.push(table);
      return {
        insert: (row: NewReport) => {
          inserted.push(row);
          return insert instanceof Error
            ? Promise.reject(insert)
            : Promise.resolve(insert);
        },
      };
    },
  };
  return { client: client as unknown as ReportClient, inserted, tables };
}

const params = (query: string) => new URLSearchParams(query);

describe("report reasons", () => {
  it("match Android's options and default", () => {
    expect(REPORT_REASONS).toEqual([
      "Neprimerna vsebina",
      "Lažen profil ali oglas",
      "Nadlegovanje",
      "Drugo",
    ]);
    expect(DEFAULT_REASON).toBe("Neprimerna vsebina");
  });
});

describe("parseReportContext", () => {
  it("reads chat and listing context", () => {
    expect(parseReportContext(params("from=chat&match=m1"))).toEqual({
      kind: "chat",
      matchId: "m1",
    });
    expect(parseReportContext(params("from=listing&listing=l1"))).toEqual({
      kind: "listing",
      listingId: "l1",
    });
  });

  it("ignores missing or mismatched parameters", () => {
    expect(parseReportContext(params(""))).toBeNull();
    expect(parseReportContext(params("from=chat"))).toBeNull();
    expect(parseReportContext(params("from=listing&match=m1"))).toBeNull();
    expect(parseReportContext(params("from=other&listing=l1"))).toBeNull();
    expect(parseReportContext(params("from=chat&match=%20"))).toBeNull();
  });
});

describe("links", () => {
  it("builds the listing report link from the owner", () => {
    expect(listingReportHref("o/1", "l 1")).toBe(
      "/report/o%2F1?from=listing&listing=l%201",
    );
  });

  it("returns to where the report started", () => {
    expect(backHref({ kind: "chat", matchId: "m1" })).toBe("/chats/m1");
    expect(backHref({ kind: "listing", listingId: "l/1" })).toBe(
      "/listings/l%2F1",
    );
    expect(backHref(null)).toBe("/");
  });
});

describe("validateReport", () => {
  it("accepts a valid draft", () => {
    expect(validateReport(draft())).toBeNull();
    expect(
      validateReport(draft({ description: "x".repeat(DESCRIPTION_MAX) })),
    ).toBeNull();
  });

  it("rejects a malformed user id, unknown reason, or long description", () => {
    expect(validateReport(draft({ reportedId: "abc" }))?.kind).toBe(
      "invalid-user",
    );
    expect(validateReport(draft({ reason: "Spam" }))?.kind).toBe(
      "invalid-reason",
    );
    expect(
      validateReport(draft({ description: "x".repeat(DESCRIPTION_MAX + 1) }))
        ?.kind,
    ).toBe("too-long");
  });
});

describe("buildReport", () => {
  it("trims the description and adds the context note", () => {
    expect(
      buildReport(
        ME,
        draft({
          reason: "Nadlegovanje",
          description: "  Žaljiva sporočila.  ",
          context: { kind: "chat", matchId: "m1" },
        }),
      ),
    ).toEqual({
      reporter_id: ME,
      reported_id: PEER,
      reason: "Nadlegovanje",
      description: "Žaljiva sporočila.\n\n[Prijava iz klepeta: m1]",
    });
  });

  it("stores only the note, or an empty description, when nothing was written", () => {
    expect(
      buildReport(ME, draft({ context: { kind: "listing", listingId: "l1" } }))
        .description,
    ).toBe(contextNote({ kind: "listing", listingId: "l1" }));
    expect(buildReport(ME, draft()).description).toBe("");
  });
});

describe("submitReport", () => {
  it("inserts as the current user", async () => {
    const { client, inserted, tables } = makeClient();
    await submitReport(client, draft({ description: "Opis" }));
    expect(tables).toEqual(["reports"]);
    expect(inserted).toEqual([
      {
        reporter_id: ME,
        reported_id: PEER,
        reason: DEFAULT_REASON,
        description: "Opis",
      },
    ]);
  });

  it("validates before calling the server", async () => {
    const { client, inserted } = makeClient();
    await expect(
      submitReport(client, draft({ reason: "Spam" })),
    ).rejects.toMatchObject({ kind: "invalid-reason" });
    expect(client.auth.getUser).not.toHaveBeenCalled();
    expect(inserted).toEqual([]);
  });

  it("requires a signed-in user and refuses self-reports", async () => {
    await expect(
      submitReport(makeClient({ user: null }).client, draft()),
    ).rejects.toMatchObject({
      kind: "signed-out",
      message: reportCopy.signedOut,
    });
    const { client, inserted } = makeClient();
    await expect(
      submitReport(client, draft({ reportedId: ME })),
    ).rejects.toMatchObject({ kind: "self" });
    expect(inserted).toEqual([]);
  });

  it("maps database and network failures to safe copy", async () => {
    await expect(
      submitReport(
        makeClient({ insert: { error: { code: "23503", message: "fk" } } })
          .client,
        draft(),
      ),
    ).rejects.toMatchObject({ kind: "missing-user" });
    await expect(
      submitReport(
        makeClient({ insert: new TypeError("Failed to fetch") }).client,
        draft(),
      ),
    ).rejects.toMatchObject({ kind: "offline", message: reportCopy.offline });
    await expect(
      submitReport(
        makeClient({
          insert: { error: { code: "42501", message: "row-level security" } },
        }).client,
        draft(),
      ),
    ).rejects.toMatchObject({ kind: "failed", message: reportCopy.failed });
  });
});
