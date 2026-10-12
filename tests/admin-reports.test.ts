import { describe, expect, it, vi } from "vitest";
import {
  adminCopy,
  countByStatus,
  filterReports,
  isAdmin,
  listReports,
  nextStatus,
  REPORT_COLUMNS,
  REPORT_LIMIT,
  replaceStatus,
  setReportStatus,
  type AdminClient,
  type AdminReport,
} from "../lib/admin/reports";

const ME = "admin-1";

type Outcome = { data?: unknown; error: unknown } | Error;
const settle = (r: Outcome) =>
  r instanceof Error ? Promise.reject(r) : Promise.resolve(r);

function makeClient({
  user = { id: ME } as { id: string } | null,
  admins = { data: { user_id: ME }, error: null } as Outcome,
  reports = { data: [], error: null } as Outcome,
  update = { data: [{ id: "r1", status: "reviewed" }], error: null } as Outcome,
} = {}) {
  const calls: Array<[string, ...unknown[]]> = [];
  const chain = (outcome: Outcome) => {
    const c: Record<string, unknown> = {};
    for (const name of ["select", "eq", "order", "limit", "update"]) {
      c[name] = (...args: unknown[]) => {
        calls.push([name, ...args]);
        if (
          name === "limit" ||
          (name === "select" && calls.some(([n]) => n === "update"))
        )
          return settle(outcome);
        return c;
      };
    }
    c.maybeSingle = () => settle(outcome);
    return c;
  };
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    from: (table: string) => {
      calls.push(["from", table]);
      if (table === "admins") return chain(admins);
      return calls.some(([n]) => n === "update")
        ? chain(update)
        : {
            ...chain(reports),
            update: (values: unknown) => {
              calls.push(["update", values]);
              return chain(update);
            },
          };
    },
  };
  return { client: client as unknown as AdminClient, calls };
}

const report = (id: string, status: AdminReport["status"]): AdminReport => ({
  id,
  reported_id: "u1",
  reason: "Nadlegovanje",
  description: "",
  status,
  created_at: "2026-10-11T10:00:00Z",
});

describe("isAdmin", () => {
  it("looks up only the current user's admin row", async () => {
    const { client, calls } = makeClient();
    await expect(isAdmin(client)).resolves.toBe(true);
    expect(calls).toEqual([
      ["from", "admins"],
      ["select", "user_id"],
      ["eq", "user_id", ME],
    ]);
  });

  it("is false without a row, and requires a signed-in user", async () => {
    await expect(
      isAdmin(makeClient({ admins: { data: null, error: null } }).client),
    ).resolves.toBe(false);
    await expect(
      isAdmin(makeClient({ user: null }).client),
    ).rejects.toMatchObject({ kind: "signed-out" });
  });

  it("maps failures without exposing database messages", async () => {
    await expect(
      isAdmin(makeClient({ admins: new TypeError("Failed to fetch") }).client),
    ).rejects.toMatchObject({ kind: "offline" });
    const error = await isAdmin(
      makeClient({
        admins: { data: null, error: { code: "XX000", message: "secret" } },
      }).client,
    ).catch((e: Error) => e);
    expect(error).toMatchObject({
      kind: "load-failed",
      message: adminCopy.loadFailed,
    });
    expect(String((error as Error).message)).not.toContain("secret");
  });
});

describe("listReports", () => {
  it("selects the dashboard columns, newest first, with a limit", async () => {
    const rows = [report("r1", "open")];
    const { client, calls } = makeClient({
      reports: { data: rows, error: null },
    });
    await expect(listReports(client)).resolves.toEqual(rows);
    expect(calls).toEqual([
      ["from", "reports"],
      ["select", REPORT_COLUMNS],
      ["order", "created_at", { ascending: false }],
      ["limit", REPORT_LIMIT],
    ]);
    expect(REPORT_COLUMNS).not.toContain("reporter_id");
  });

  it("treats a null result as empty and maps permission errors", async () => {
    await expect(
      listReports(makeClient({ reports: { data: null, error: null } }).client),
    ).resolves.toEqual([]);
    await expect(
      listReports(
        makeClient({ reports: { data: null, error: { code: "42501" } } })
          .client,
      ),
    ).rejects.toMatchObject({ kind: "not-admin", message: adminCopy.notAdmin });
  });
});

describe("setReportStatus", () => {
  it("updates one report and returns the stored status", async () => {
    const { client, calls } = makeClient();
    await expect(setReportStatus(client, "r1", "reviewed")).resolves.toBe(
      "reviewed",
    );
    expect(calls).toEqual([
      ["from", "reports"],
      ["update", { status: "reviewed" }],
      ["eq", "id", "r1"],
      ["select", "id,status"],
    ]);
  });

  it("treats an update RLS silently skipped as a failure, not success", async () => {
    await expect(
      setReportStatus(
        makeClient({ update: { data: [], error: null } }).client,
        "r1",
        "reviewed",
      ),
    ).rejects.toMatchObject({
      kind: "not-admin",
      message: adminCopy.updateFailed,
    });
  });

  it("maps other failures to safe copy", async () => {
    await expect(
      setReportStatus(
        makeClient({ update: { data: null, error: { code: "23514" } } }).client,
        "r1",
        "reviewed",
      ),
    ).rejects.toMatchObject({
      kind: "update-failed",
      message: adminCopy.updateFailed,
    });
  });
});

describe("status helpers", () => {
  it("toggles like Android and reopens dismissed reports", () => {
    expect(nextStatus("open")).toBe("reviewed");
    expect(nextStatus("reviewed")).toBe("open");
    expect(nextStatus("dismissed")).toBe("open");
  });

  it("replaces one report's status without touching others", () => {
    const list = [report("r1", "open"), report("r2", "open")];
    expect(replaceStatus(list, "r2", "dismissed")).toEqual([
      report("r1", "open"),
      report("r2", "dismissed"),
    ]);
    expect(list[1].status).toBe("open");
  });

  it("filters and counts by status", () => {
    const list = [
      report("r1", "open"),
      report("r2", "reviewed"),
      report("r3", "open"),
    ];
    expect(filterReports(list, "open").map((r) => r.id)).toEqual(["r1", "r3"]);
    expect(filterReports(list, "all")).toBe(list);
    expect(countByStatus(list)).toEqual({
      all: 3,
      open: 2,
      reviewed: 1,
      dismissed: 0,
    });
  });
});
