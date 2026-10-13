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
  type ReportClient,
  type SubmitReportArgs,
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
  insert = { data: "r1", error: null } as
    { data?: unknown; error: unknown } | Error,
} = {}) {
  const inserted: SubmitReportArgs[] = [];
  const tables: string[] = [];
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    rpc: (fn: string, args: SubmitReportArgs) => {
      tables.push(fn);
      inserted.push(args);
      return insert instanceof Error
        ? Promise.reject(insert)
        : Promise.resolve(insert);
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

const MATCH = "33333333-3333-4333-8333-333333333333";

describe("buildReport", () => {
  it("links a chat report's conversation as evidence instead of a note", () => {
    expect(
      buildReport(
        draft({
          reason: "Nadlegovanje",
          description: "  Žaljiva sporočila.  ",
          context: { kind: "chat", matchId: MATCH },
        }),
      ),
    ).toEqual({
      p_reported: PEER,
      p_reason: "Nadlegovanje",
      p_description: "Žaljiva sporočila.",
      p_match: MATCH,
    });
  });

  it("never sends a malformed conversation id", () => {
    expect(
      buildReport(draft({ context: { kind: "chat", matchId: "m1" } })).p_match,
    ).toBeNull();
  });

  it("keeps a listing report's listing as a note", () => {
    const args = buildReport(
      draft({ context: { kind: "listing", listingId: "l1" } }),
    );
    expect(args.p_description).toBe(
      contextNote({ kind: "listing", listingId: "l1" }),
    );
    expect(args.p_match).toBeNull();
    expect(buildReport(draft()).p_description).toBe("");
    expect(contextNote({ kind: "chat", matchId: MATCH })).toBe("");
  });
});

describe("submitReport", () => {
  it("files through submit_report without sending a reporter id", async () => {
    const { client, inserted, tables } = makeClient();
    await submitReport(client, draft({ description: "Opis" }));
    expect(tables).toEqual(["submit_report"]);
    expect(inserted).toEqual([
      {
        p_reported: PEER,
        p_reason: DEFAULT_REASON,
        p_description: "Opis",
        p_match: null,
      },
    ]);
    expect(JSON.stringify(inserted)).not.toContain(ME);
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
