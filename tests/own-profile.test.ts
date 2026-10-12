import { describe, expect, it, vi } from "vitest";
import {
  draftFromProfile,
  fetchOwnProfile,
  initialsFor,
  profileErrorMessages,
  ProfileRequestError,
  updateOwnProfile,
  validateProfileDraft,
  type ProfileClient,
  type ProfileDraft,
} from "../lib/profile/own-profile";
import type { Database } from "../lib/supabase/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type Result = { data: ProfileRow | null; error: unknown };

const row: ProfileRow = {
  id: "user-1",
  display_name: "Ana Novak",
  academic_status_verified: true,
  is_available: true,
  created_at: "2026-01-01T00:00:00Z",
  age: 22,
  faculty: "FRI, Univerza v Ljubljani",
  bio: "Rada kuham.",
  avatar_url: "",
};

function makeClient({
  user = { id: "user-1" } as { id: string } | null,
  userError = null as unknown,
  select = { data: row, error: null } as Result | Error,
  update = { data: row, error: null } as Result | Error,
} = {}) {
  const calls: Array<[string, unknown[]]> = [];
  const settle = (result: Result | Error) =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: userError })),
    },
    from: vi.fn((table: string) => {
      calls.push(["from", [table]]);
      return {
        select: (columns: string) => {
          calls.push(["select", [columns]]);
          return {
            eq: (column: string, value: string) => {
              calls.push(["eq", [column, value]]);
              return { maybeSingle: () => settle(select) };
            },
          };
        },
        update: (values: unknown) => {
          calls.push(["update", [values]]);
          return {
            eq: (column: string, value: string) => {
              calls.push(["eq", [column, value]]);
              return {
                select: (columns: string) => {
                  calls.push(["select", [columns]]);
                  return { maybeSingle: () => settle(update) };
                },
              };
            },
          };
        },
      };
    }),
  };
  return { client: client as unknown as ProfileClient, calls };
}

const draft = (overrides: Partial<ProfileDraft> = {}): ProfileDraft => ({
  displayName: "Ana Novak",
  faculty: "FRI",
  age: "22",
  bio: "",
  ...overrides,
});

describe("fetchOwnProfile", () => {
  it("loads the signed-in user's own profile row", async () => {
    const { client, calls } = makeClient();
    await expect(fetchOwnProfile(client)).resolves.toEqual({
      status: "ready",
      userId: "user-1",
      profile: row,
    });
    expect(calls).toEqual([
      ["from", ["profiles"]],
      ["select", ["*"]],
      ["eq", ["id", "user-1"]],
    ]);
  });

  it("reports a signed-out visitor without querying profiles", async () => {
    const { client, calls } = makeClient({
      user: null,
      userError: { status: 401, message: "Auth session missing" },
    });
    await expect(fetchOwnProfile(client)).resolves.toEqual({
      status: "signed-out",
    });
    expect(calls).toEqual([]);
  });

  it("reports a missing profile row", async () => {
    const { client } = makeClient({ select: { data: null, error: null } });
    await expect(fetchOwnProfile(client)).resolves.toEqual({
      status: "missing",
      userId: "user-1",
    });
  });

  it("maps permission errors to a safe message", async () => {
    const { client } = makeClient({
      select: { data: null, error: { code: "42501", message: "RLS" } },
    });
    await expect(fetchOwnProfile(client)).rejects.toMatchObject({
      kind: "permission",
      message: profileErrorMessages.permission,
    });
  });

  it("maps network failures to the offline message", async () => {
    const { client } = makeClient({ select: new TypeError("Failed to fetch") });
    await expect(fetchOwnProfile(client)).rejects.toMatchObject({
      kind: "offline",
      message: profileErrorMessages.offline,
    });
  });

  it("treats an unexpected auth server error as a failure, not a sign-out", async () => {
    const { client } = makeClient({
      user: null,
      userError: { status: 500, message: "boom" },
    });
    await expect(fetchOwnProfile(client)).rejects.toBeInstanceOf(
      ProfileRequestError,
    );
  });

  it("rejects malformed rows instead of rendering them", async () => {
    const { client } = makeClient({
      select: {
        data: { ...row, is_available: "yes" as unknown as boolean },
        error: null,
      },
    });
    await expect(fetchOwnProfile(client)).rejects.toMatchObject({
      kind: "unknown",
    });
  });
});

describe("updateOwnProfile", () => {
  const values = { display_name: "Ana N.", faculty: "FF", age: 23, bio: "Hi" };

  it("updates only editable fields on the user's own row", async () => {
    const updated = { ...row, ...values };
    const { client, calls } = makeClient({
      update: { data: updated, error: null },
    });
    await expect(updateOwnProfile(client, "user-1", values)).resolves.toEqual(
      updated,
    );
    expect(calls).toEqual([
      ["from", ["profiles"]],
      ["update", [values]],
      ["eq", ["id", "user-1"]],
      ["select", ["*"]],
    ]);
  });

  it("never sends verification or availability, even if passed extra fields", async () => {
    const { client, calls } = makeClient();
    await updateOwnProfile(client, "user-1", {
      ...values,
      academic_status_verified: true,
      is_available: false,
    } as typeof values);
    expect(calls.find(([name]) => name === "update")?.[1][0]).toEqual(values);
  });

  it("treats an RLS-hidden row as a permission error", async () => {
    const { client } = makeClient({ update: { data: null, error: null } });
    await expect(
      updateOwnProfile(client, "user-1", values),
    ).rejects.toMatchObject({ kind: "permission" });
  });

  it("maps server errors to a safe generic message", async () => {
    const { client } = makeClient({
      update: { data: null, error: { code: "23514", message: "check failed" } },
    });
    const error = await updateOwnProfile(client, "user-1", values).catch(
      (e: unknown) => e,
    );
    expect(error).toMatchObject({
      kind: "unknown",
      message: profileErrorMessages.unknown,
    });
    expect((error as Error).message).not.toContain("check failed");
  });
});

describe("validateProfileDraft", () => {
  it("normalizes valid input", () => {
    expect(
      validateProfileDraft(
        draft({
          displayName: "  Ana   Novak ",
          faculty: " FRI ",
          age: " 22 ",
          bio: " Hej \n",
        }),
      ),
    ).toEqual({
      ok: true,
      values: {
        display_name: "Ana Novak",
        faculty: "FRI",
        age: 22,
        bio: "Hej",
      },
    });
  });

  it("allows an empty age, faculty, and bio", () => {
    expect(
      validateProfileDraft(draft({ age: "", faculty: "", bio: "" })),
    ).toMatchObject({ ok: true, values: { age: null, faculty: "", bio: "" } });
  });

  it.each([
    ["displayName", draft({ displayName: " a " })],
    ["displayName", draft({ displayName: "x".repeat(61) })],
    ["faculty", draft({ faculty: "x".repeat(121) })],
    ["bio", draft({ bio: "x".repeat(501) })],
    ["age", draft({ age: "15" })],
    ["age", draft({ age: "100" })],
    ["age", draft({ age: "22.5" })],
    ["age", draft({ age: "dvaindvajset" })],
  ])("rejects an invalid %s", (field, input) => {
    const result = validateProfileDraft(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toEqual([field]);
  });

  it("accepts the boundary values", () => {
    expect(
      validateProfileDraft(
        draft({
          displayName: "Al",
          age: "16",
          faculty: "x".repeat(120),
          bio: "x".repeat(500),
        }),
      ).ok,
    ).toBe(true);
    expect(validateProfileDraft(draft({ age: "99" })).ok).toBe(true);
  });
});

describe("profile display helpers", () => {
  it("builds an editable draft from a profile", () => {
    expect(draftFromProfile(row)).toEqual({
      displayName: "Ana Novak",
      faculty: "FRI, Univerza v Ljubljani",
      age: "22",
      bio: "Rada kuham.",
    });
    expect(draftFromProfile({ ...row, age: null }).age).toBe("");
  });

  it("derives avatar initials", () => {
    expect(initialsFor("Ana Novak")).toBe("AN");
    expect(initialsFor("ana maria novak")).toBe("AM");
    expect(initialsFor("   ")).toBe("?");
  });
});
