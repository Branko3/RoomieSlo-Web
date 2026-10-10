import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  authMessage,
  safeDestination,
  submitLogin,
  validateLogin,
} from "../lib/auth/login";
import { initializeAuthSession } from "../components/auth-provider";

describe("email/password login boundary", () => {
  it("validates email and password before an auth request", () => {
    expect(validateLogin("", "secret").error).toBe(
      "Vnesite veljaven e-naslov.",
    );
    expect(validateLogin("not-an-email", "secret").error).toBe(
      "Vnesite veljaven e-naslov.",
    );
    expect(validateLogin("user@example.com", "").error).toBe("Vnesite geslo.");
    expect(validateLogin(" user@example.com ", "secret")).toEqual({
      email: "user@example.com",
      error: null,
    });
  });

  it("maps auth and network failures without exposing raw messages", () => {
    expect(authMessage("Invalid login credentials")).toBe(
      "E-naslov ali geslo nista pravilna.",
    );
    expect(authMessage("Email not confirmed")).toContain("še ni potrjen");
    expect(authMessage("Failed to fetch")).toContain("Povezava ni uspela");
    expect(authMessage("secret password leaked")).not.toContain("secret");
  });

  it("selects only same-origin paths for redirects", () => {
    expect(safeDestination("/listings?location=Center")).toBe(
      "/listings?location=Center",
    );
    expect(safeDestination("//evil.example")).toBe("/listings");
    expect(safeDestination("https://evil.example")).toBe("/listings");
    expect(safeDestination(null)).toBe("/listings");
  });

  it("passes trimmed credentials to signInWithPassword and prevents duplicate pending calls", async () => {
    const signIn = vi.fn().mockResolvedValue({ error: null });
    const onSuccess = vi.fn();
    const onError = vi.fn();

    expect(
      await submitLogin({
        email: " user@example.com ",
        password: "secret",
        pending: false,
        destination: "/listings?next=1",
        signIn,
        onError,
        onSuccess,
      }),
    ).toBe(true);
    expect(signIn).toHaveBeenCalledWith("user@example.com", "secret");
    expect(onSuccess).toHaveBeenCalledWith("/listings?next=1");

    expect(
      await submitLogin({
        email: "user@example.com",
        password: "secret",
        pending: true,
        destination: null,
        signIn,
        onError,
        onSuccess,
      }),
    ).toBe(false);
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it("reports rejected and thrown auth requests safely", async () => {
    const onError = vi.fn();
    const options = {
      email: "user@example.com",
      password: "secret",
      pending: false,
      destination: null,
      onError,
      onSuccess: vi.fn(),
    };

    await submitLogin({
      ...options,
      signIn: vi
        .fn()
        .mockResolvedValue({ error: { message: "Invalid login credentials" } }),
    });
    expect(onError).toHaveBeenCalledWith("E-naslov ali geslo nista pravilna.");

    await submitLogin({
      ...options,
      signIn: vi.fn().mockRejectedValue(new Error("network password=secret")),
    });
    expect(onError).toHaveBeenLastCalledWith(
      "Prijava ni uspela. Preverite povezavo in poskusite znova.",
    );
  });
});

describe("shared auth session boundary", () => {
  const session = { access_token: "token" } as never;
  let authStateChange: ((event: string, session: unknown) => void) | undefined;
  const getSession = vi
    .fn()
    .mockResolvedValue({ data: { session: null }, error: null });
  const unsubscribe = vi.fn();
  const client = {
    auth: {
      getSession,
      onAuthStateChange: vi.fn(
        (callback: (event: string, session: unknown) => void) => {
          authStateChange = callback;
          return { data: { subscription: { unsubscribe } } };
        },
      ),
    },
  } as never;

  beforeEach(() => {
    authStateChange = undefined;
    vi.clearAllMocks();
  });

  it("restores the session and reacts to sign-in/sign-out transitions", async () => {
    const setSession = vi.fn();
    const setLoading = vi.fn();
    const setError = vi.fn();
    const initialized = initializeAuthSession(client, {
      setSession,
      setLoading,
      setError,
    });

    await initialized.sessionRequest;
    expect(setSession).toHaveBeenCalledWith(null);
    expect(setLoading).toHaveBeenCalledWith(false);

    authStateChange?.("SIGNED_IN", session);
    expect(setSession).toHaveBeenLastCalledWith(session);
    authStateChange?.("SIGNED_OUT", null);
    expect(setSession).toHaveBeenLastCalledWith(null);
    expect(setError).toHaveBeenLastCalledWith(null);

    initialized.unsubscribe();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("does not update state after cleanup", async () => {
    let resolveSession!: (value: {
      data: { session: unknown };
      error: null;
    }) => void;
    getSession.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );
    const setSession = vi.fn();
    const initialized = initializeAuthSession(client, {
      setSession,
      setLoading: vi.fn(),
      setError: vi.fn(),
    });
    initialized.unsubscribe();
    resolveSession({ data: { session }, error: null });
    await initialized.sessionRequest;
    expect(setSession).not.toHaveBeenCalled();
  });
});

describe("login implementation contract", () => {
  it("contains accessible fields, pending feedback, and browser auth only", () => {
    const source = readFileSync(
      join(process.cwd(), "app/login/page.tsx"),
      "utf8",
    );
    expect(source).toContain('htmlFor="email"');
    expect(source).toContain('autoComplete="email"');
    expect(source).toContain('autoComplete="current-password"');
    expect(source).toContain('role="alert"');
    expect(source).toContain("disabled={pending || authLoading}");
    expect(source).toContain("signIn(validation.email, password)");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
