import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  DELETION_PHRASE,
  deleteOwnAccount,
  deletionCopy,
  resultFromResponse,
  type DeleteAccountClient,
} from "../lib/account/deletion";
import {
  documentFolder,
  documentPaths,
  isConfirmationValid,
  isMissingUserError,
  isRecentSignIn,
  logLine,
  REAUTH_WINDOW_MS,
  statusFor,
} from "../supabase/functions/_shared/account-deletion";

const UID = "11111111-1111-4111-8111-111111111111";
const NOW = Date.UTC(2026, 9, 14, 12);

describe("shared deletion rules", () => {
  it("accepts the confirmation phrase only, ignoring case and surrounding spaces", () => {
    expect(isConfirmationValid(DELETION_PHRASE)).toBe(true);
    expect(isConfirmationValid("  izbriši ")).toBe(true);
    expect(isConfirmationValid("IZBRISI")).toBe(false);
    expect(isConfirmationValid("")).toBe(false);
    expect(isConfirmationValid(undefined)).toBe(false);
    expect(isConfirmationValid({ confirm: DELETION_PHRASE })).toBe(false);
  });

  it("requires a sign-in within the last 10 minutes", () => {
    const at = (offset: number) => new Date(NOW - offset).toISOString();
    expect(isRecentSignIn(at(0), NOW)).toBe(true);
    expect(isRecentSignIn(at(REAUTH_WINDOW_MS), NOW)).toBe(true);
    expect(isRecentSignIn(at(REAUTH_WINDOW_MS + 1), NOW)).toBe(false);
    expect(isRecentSignIn(undefined, NOW)).toBe(false);
    expect(isRecentSignIn("not a date", NOW)).toBe(false);
    // A sign-in claimed far in the future is not trusted.
    expect(isRecentSignIn(at(-5 * 60_000), NOW)).toBe(false);
  });

  it("builds document paths only inside the user's own UUID folder", () => {
    expect(documentFolder(UID)).toBe(UID);
    expect(() => documentFolder("../other")).toThrow();
    expect(() => documentFolder("")).toThrow();
    expect(
      documentPaths(UID, ["vpisni-list.pdf", "a/b.pdf", "..", ""]),
    ).toEqual([`${UID}/vpisni-list.pdf`]);
  });

  it("recognises a token whose user no longer exists", () => {
    expect(isMissingUserError({ code: "user_not_found" })).toBe(true);
    expect(isMissingUserError({ status: 404 })).toBe(true);
    expect(
      isMissingUserError({
        message: "User from sub claim in JWT does not exist",
      }),
    ).toBe(true);
    expect(isMissingUserError({ status: 401, message: "JWT expired" })).toBe(
      false,
    );
    expect(isMissingUserError(null)).toBe(false);
  });

  it("maps outcomes to the agreed status codes", () => {
    expect(statusFor("deleted")).toBe(200);
    expect(statusFor("already_deleted")).toBe(410);
    expect(statusFor("invalid_confirmation")).toBe(400);
    expect(statusFor("reauth_required")).toBe(401);
    expect(statusFor("session_expired")).toBe(401);
    expect(statusFor("partial_failure")).toBe(500);
  });

  it("logs only the outcome and request id", () => {
    const line = JSON.parse(
      logLine("partial_failure", "req-1", "storage_list"),
    );
    expect(line).toEqual({
      event: "account_deletion",
      outcome: "partial_failure",
      request_id: "req-1",
      detail: "storage_list",
    });
  });
});

function makeClient({
  user = { id: UID, email: "ana@example.com" } as {
    id: string;
    email?: string;
  } | null,
  signIn = { error: null } as { error: unknown },
  invoke = { data: { outcome: "deleted" }, error: null } as {
    data: unknown;
    error: unknown;
  },
} = {}) {
  const calls: Array<[string, unknown]> = [];
  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: null })),
      signInWithPassword: vi.fn(async (credentials: unknown) => {
        calls.push(["signIn", credentials]);
        return signIn;
      }),
    },
    functions: {
      invoke: vi.fn(async (name: string, options: unknown) => {
        calls.push(["invoke", { name, options }]);
        return invoke;
      }),
    },
  };
  return { client: client as unknown as DeleteAccountClient, calls };
}

/** A FunctionsHttpError as supabase-js returns it for a non-2xx response. */
function httpError(status: number, outcome: string) {
  return {
    name: "FunctionsHttpError",
    context: new Response(JSON.stringify({ outcome }), { status }),
  };
}

const valid = { password: "geslo1234", confirm: " izbriši " };

describe("deleteOwnAccount", () => {
  it("sends nothing for a wrong phrase or an empty password", async () => {
    const { client, calls } = makeClient();
    await expect(
      deleteOwnAccount(client, { password: "x", confirm: "BRIŠI" }),
    ).resolves.toEqual({
      ok: false,
      kind: "invalid-confirmation",
      message: deletionCopy["invalid-confirmation"],
    });
    await expect(
      deleteOwnAccount(client, { password: "", confirm: DELETION_PHRASE }),
    ).resolves.toMatchObject({ kind: "missing-password" });
    expect(calls).toEqual([]);
    expect(client.auth.getUser).not.toHaveBeenCalled();
  });

  it("re-authenticates, then asks the function without sending a user id", async () => {
    const { client, calls } = makeClient();
    await expect(deleteOwnAccount(client, valid)).resolves.toEqual({
      ok: true,
    });
    expect(calls).toEqual([
      ["signIn", { email: "ana@example.com", password: "geslo1234" }],
      [
        "invoke",
        { name: "delete-account", options: { body: { confirm: "izbriši" } } },
      ],
    ]);
    expect(JSON.stringify(calls[1])).not.toContain(UID);
  });

  it("stops on a wrong password", async () => {
    const { client, calls } = makeClient({
      signIn: { error: { status: 400, message: "Invalid login credentials" } },
    });
    await expect(deleteOwnAccount(client, valid)).resolves.toMatchObject({
      kind: "wrong-password",
    });
    expect(calls.map(([name]) => name)).toEqual(["signIn"]);
  });

  it("needs a signed-in user", async () => {
    await expect(
      deleteOwnAccount(makeClient({ user: null }).client, valid),
    ).resolves.toMatchObject({ kind: "signed-out" });
  });

  it("treats an already-deleted account as done (idempotent)", async () => {
    await expect(
      deleteOwnAccount(
        makeClient({
          invoke: { data: null, error: httpError(410, "already_deleted") },
        }).client,
        valid,
      ),
    ).resolves.toEqual({ ok: true });
  });

  it("maps the function's refusals and failures", async () => {
    const run = (status: number, outcome: string) =>
      deleteOwnAccount(
        makeClient({
          invoke: { data: null, error: httpError(status, outcome) },
        }).client,
        valid,
      );
    await expect(run(401, "reauth_required")).resolves.toMatchObject({
      kind: "reauth",
    });
    await expect(run(401, "session_expired")).resolves.toMatchObject({
      kind: "signed-out",
    });
    await expect(run(400, "invalid_confirmation")).resolves.toMatchObject({
      kind: "invalid-confirmation",
    });
    await expect(run(500, "partial_failure")).resolves.toMatchObject({
      kind: "partial",
      message: deletionCopy.partial,
    });
  });

  it("reports network failures as offline", async () => {
    await expect(
      deleteOwnAccount(
        makeClient({
          invoke: {
            data: null,
            error: { name: "FunctionsFetchError", message: "Failed to send" },
          },
        }).client,
        valid,
      ),
    ).resolves.toMatchObject({ kind: "offline" });
  });

  it("only treats 200 and 410 as success", () => {
    expect(resultFromResponse(200)).toEqual({ ok: true });
    expect(resultFromResponse(410)).toEqual({ ok: true });
    expect(resultFromResponse(403).ok).toBe(false);
  });
});

describe("delete-account Edge Function (static)", () => {
  const source = readFileSync(
    join(process.cwd(), "supabase/functions/delete-account/index.ts"),
    "utf8",
  );

  it("takes the user only from the verified token", () => {
    expect(source).toContain("admin.auth.getUser(token)");
    expect(source).not.toMatch(/body\.(user|user_id|userId|id)\b/);
    expect(source).toContain("deleteUser(user.id)");
  });

  it("removes and verifies documents before deleting the Auth user", () => {
    const remove = source.indexOf("storage.remove(paths)");
    const verify = source.indexOf("storage_verify");
    const deleteUser = source.indexOf("admin.auth.admin.deleteUser");
    expect(remove).toBeGreaterThan(0);
    expect(remove).toBeLessThan(verify);
    expect(verify).toBeLessThan(deleteUser);
  });

  it("checks confirmation and re-authentication before touching data", () => {
    const confirm = source.indexOf("isConfirmationValid(body.confirm)");
    const reauth = source.indexOf("isRecentSignIn(user.last_sign_in_at");
    const storage = source.indexOf("storage.list(folder");
    expect(confirm).toBeLessThan(reauth);
    expect(reauth).toBeLessThan(storage);
  });

  it("keeps the service-role key in the function environment only", () => {
    expect(source).toContain('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');
    const tsconfig = readFileSync(join(process.cwd(), "tsconfig.json"), "utf8");
    expect(tsconfig).toContain('"supabase/functions"');
  });

  it("writes the deletion register for completed and partial deletions", () => {
    expect(source).toContain('from("deletion_register").insert');
    const migration = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20261014000300_deletion_register.sql",
      ),
      "utf8",
    );
    expect(migration).toContain(
      "alter table public.deletion_register enable row level security",
    );
    expect(migration).toContain(
      "revoke all on public.deletion_register from anon, authenticated",
    );
    expect(migration).toContain(
      "check (outcome in ('deleted', 'partial_failure'))",
    );
  });
});
