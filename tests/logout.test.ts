import { describe, expect, it, vi } from "vitest";
import {
  clearLocalUserData,
  LOGOUT_ERROR,
  performLogout,
  type LogoutAuthClient,
  type LogoutDependencies,
} from "../lib/auth/logout";

function memoryStorage(entries: Record<string, string>) {
  const data = new Map(Object.entries(entries));
  return {
    data,
    get length() {
      return data.size;
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

function setup(
  signOut: LogoutAuthClient["auth"]["signOut"] | null = vi
    .fn()
    .mockResolvedValue({ error: null }),
) {
  const storage = memoryStorage({
    "roomieslo:favorites": '["listing-1"]',
    "roomieslo:search": "{}",
    "sb-project-auth-token": "managed-by-supabase",
    "other-app": "keep",
  });
  const deps = {
    client: signOut ? { auth: { signOut } } : null,
    clearServerState: vi.fn(),
    resetUserState: vi.fn(),
    storage,
  } satisfies LogoutDependencies;
  return { deps, storage, signOut };
}

describe("performLogout", () => {
  it("signs out on this device only and redirects to login", async () => {
    const { deps, signOut } = setup();
    const result = await performLogout(deps);

    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(result).toEqual({ ok: true, redirectTo: "/login" });
  });

  it("clears cached server state, in-memory user data, and app storage", async () => {
    const { deps, storage } = setup();
    await performLogout(deps);

    expect(deps.clearServerState).toHaveBeenCalledOnce();
    expect(deps.resetUserState).toHaveBeenCalledOnce();
    expect([...storage.data.keys()]).toEqual([
      "sb-project-auth-token",
      "other-app",
    ]);
  });

  it("still completes when Supabase reports a server-side revoke error", async () => {
    const { deps } = setup(
      vi.fn().mockResolvedValue({ error: { message: "network" } }),
    );
    const result = await performLogout(deps);

    expect(result).toEqual({ ok: true, redirectTo: "/login" });
    expect(deps.clearServerState).toHaveBeenCalledOnce();
  });

  it("keeps the user signed in and data intact when sign-out throws", async () => {
    const { deps, storage } = setup(
      vi.fn().mockRejectedValue(new Error("boom")),
    );
    const result = await performLogout(deps);

    expect(result).toEqual({ ok: false, message: LOGOUT_ERROR });
    expect(deps.clearServerState).not.toHaveBeenCalled();
    expect(deps.resetUserState).not.toHaveBeenCalled();
    expect(storage.data.has("roomieslo:favorites")).toBe(true);
  });

  it("clears local prototype data when Supabase is not configured", async () => {
    const { deps, storage } = setup(null);
    const result = await performLogout(deps);

    expect(result).toEqual({ ok: true, redirectTo: "/login" });
    expect(storage.data.has("roomieslo:favorites")).toBe(false);
  });

  it("tolerates unavailable storage", async () => {
    const { deps } = setup();
    await expect(performLogout({ ...deps, storage: null })).resolves.toEqual({
      ok: true,
      redirectTo: "/login",
    });
  });
});

describe("clearLocalUserData", () => {
  it("removes every roomieslo key, including adjacent ones", () => {
    const storage = memoryStorage({
      "roomieslo:a": "1",
      "roomieslo:b": "2",
      "roomieslo:c": "3",
      unrelated: "x",
    });
    clearLocalUserData(storage);
    expect([...storage.data.keys()]).toEqual(["unrelated"]);
  });
});
