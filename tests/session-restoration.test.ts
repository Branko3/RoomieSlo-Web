import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  initialSessionState,
  profileSummary,
  SESSION_RESTORE_ERROR,
  startSessionRestoration,
  type SessionAuthClient,
  type SessionState,
} from "../lib/auth/session";

function makeSession(overrides: Partial<Session["user"]> = {}): Session {
  return {
    access_token: "access",
    refresh_token: "refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "user-1",
      email: "ana.novak@student.uni-lj.si",
      app_metadata: {},
      user_metadata: { display_name: "Ana Novak" },
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00Z",
      ...overrides,
    },
  } as Session;
}

type GetSessionResult = Awaited<
  ReturnType<SessionAuthClient["auth"]["getSession"]>
>;

function makeClient() {
  let listener:
    ((event: AuthChangeEvent, session: Session | null) => void) | null = null;
  const deferred = {} as {
    resolve: (value: GetSessionResult) => void;
    reject: (error: unknown) => void;
  };
  const unsubscribe = vi.fn();
  const client: SessionAuthClient = {
    auth: {
      getSession: vi.fn(
        () =>
          new Promise<GetSessionResult>((resolve, reject) => {
            deferred.resolve = resolve;
            deferred.reject = reject;
          }),
      ),
      onAuthStateChange: vi.fn((callback) => {
        listener = callback;
        return { data: { subscription: { unsubscribe } } };
      }),
    },
  };
  return {
    client,
    deferred,
    unsubscribe,
    emit: (event: AuthChangeEvent, session: Session | null) =>
      listener?.(event, session),
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function track(client: SessionAuthClient | null) {
  const states: SessionState[] = [];
  const stop = startSessionRestoration(client, (state) => states.push(state));
  return { states, stop, last: () => states.at(-1) };
}

describe("session restoration after refresh", () => {
  it("starts in a loading state before the stored session is read", () => {
    expect(initialSessionState).toEqual({
      status: "loading",
      user: null,
      error: null,
    });
    expect(profileSummary(initialSessionState)).toEqual({ kind: "loading" });
  });

  it("restores a persisted session as an authenticated user", async () => {
    const { client, deferred } = makeClient();
    const { last } = track(client);
    deferred.resolve({ data: { session: makeSession() }, error: null });
    await flush();

    expect(last()).toEqual({
      status: "authenticated",
      user: {
        id: "user-1",
        email: "ana.novak@student.uni-lj.si",
        displayName: "Ana Novak",
      },
      error: null,
    });
    expect(profileSummary(last()!)).toEqual({
      kind: "signed-in",
      name: "Ana Novak",
      initials: "AN",
    });
  });

  it("falls back to the email name when no display name metadata exists", async () => {
    const { client, deferred } = makeClient();
    const { last } = track(client);
    deferred.resolve({
      data: { session: makeSession({ user_metadata: {} }) },
      error: null,
    });
    await flush();

    expect(last()?.user?.displayName).toBe("ana.novak");
  });

  it("reports an unauthenticated visitor when no session is stored", async () => {
    const { client, deferred } = makeClient();
    const { last } = track(client);
    deferred.resolve({ data: { session: null }, error: null });
    await flush();

    expect(last()).toEqual({
      status: "unauthenticated",
      user: null,
      error: null,
    });
    expect(profileSummary(last()!)).toEqual({
      kind: "signed-out",
      error: null,
    });
  });

  it("shows a recoverable error when restoring the session fails", async () => {
    const { client, deferred } = makeClient();
    const { last } = track(client);
    deferred.resolve({
      data: { session: null },
      error: { message: "invalid refresh token" },
    });
    await flush();

    expect(last()).toEqual({
      status: "unauthenticated",
      user: null,
      error: SESSION_RESTORE_ERROR,
    });
    expect(last()?.error).not.toContain("refresh token");
  });

  it("treats a network failure during restore as signed out with an error", async () => {
    const { client, deferred } = makeClient();
    const { last } = track(client);
    deferred.reject(new TypeError("Failed to fetch"));
    await flush();

    expect(last()).toEqual({
      status: "unauthenticated",
      user: null,
      error: SESSION_RESTORE_ERROR,
    });
  });

  it("follows later sign-in, token refresh, and sign-out events", async () => {
    const { client, deferred, emit } = makeClient();
    const { last } = track(client);
    deferred.resolve({ data: { session: null }, error: null });
    await flush();

    emit("SIGNED_IN", makeSession());
    expect(last()?.status).toBe("authenticated");

    emit(
      "TOKEN_REFRESHED",
      makeSession({ user_metadata: { display_name: "Ana N." } }),
    );
    expect(last()?.user?.displayName).toBe("Ana N.");

    emit("SIGNED_OUT", null);
    expect(last()).toEqual({
      status: "unauthenticated",
      user: null,
      error: null,
    });
  });

  it("never lets a stale restore overwrite a newer auth event", async () => {
    const { client, deferred, emit } = makeClient();
    const { last } = track(client);
    emit("SIGNED_IN", makeSession());
    deferred.resolve({ data: { session: null }, error: null });
    await flush();

    expect(last()?.status).toBe("authenticated");
  });

  it("ignores an empty INITIAL_SESSION event so restore errors still surface", async () => {
    const { client, deferred, emit } = makeClient();
    const { last } = track(client);
    emit("INITIAL_SESSION", null);
    deferred.resolve({ data: { session: null }, error: { message: "boom" } });
    await flush();

    expect(last()?.error).toBe(SESSION_RESTORE_ERROR);
  });

  it("stops updating and unsubscribes after cleanup", async () => {
    const { client, deferred, emit, unsubscribe } = makeClient();
    const { states, stop } = track(client);
    stop();
    deferred.resolve({ data: { session: makeSession() }, error: null });
    emit("SIGNED_IN", makeSession());
    await flush();

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(states).toEqual([]);
  });

  it("keeps the preview profile when Supabase is not configured", () => {
    const { last } = track(null);
    expect(last()).toEqual({ status: "unconfigured", user: null, error: null });
    expect(profileSummary(last()!)).toEqual({ kind: "preview" });
  });
});
