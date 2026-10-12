import { describe, expect, it, vi } from "vitest";
import {
  completeConfirmation,
  confirmationErrorMessages,
  emailRedirectUrl,
  parseConfirmationParams,
  resendConfirmation,
  safeNextPath,
  type ConfirmationAuthClient,
  type ResendAuthClient,
} from "../lib/auth/confirmation";

const params = (query: string) => new URLSearchParams(query);

function confirmClient(
  error: { code?: string; status?: number; message?: string } | null = null,
) {
  return {
    auth: {
      verifyOtp: vi.fn().mockResolvedValue({ error }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error }),
    },
  } satisfies ConfirmationAuthClient;
}

function resendClient(
  result:
    | { error: { status?: number; code?: string; message?: string } | null }
    | Error = { error: null },
) {
  return {
    auth: {
      resend: vi.fn(() =>
        result instanceof Error
          ? Promise.reject(result)
          : Promise.resolve(result),
      ),
    },
  } satisfies ResendAuthClient;
}

describe("safeNextPath", () => {
  it.each([
    ["/profile", "/profile"],
    ["/listings?location=Ljubljana", "/listings?location=Ljubljana"],
    [null, "/listings"],
    ["", "/listings"],
    ["https://evil.example", "/listings"],
    ["//evil.example", "/listings"],
    ["/\\evil.example", "/listings"],
    ["profile", "/listings"],
    ["/auth/confirm?next=/x", "/listings"],
  ])("maps %s to %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("parseConfirmationParams", () => {
  it("reads a token-hash link from the confirmation e-mail", () => {
    expect(
      parseConfirmationParams(
        params("token_hash=abc&type=signup&next=/profile"),
      ),
    ).toEqual({
      kind: "otp",
      tokenHash: "abc",
      type: "signup",
      next: "/profile",
    });
  });

  it("reads a PKCE code link", () => {
    expect(parseConfirmationParams(params("code=xyz"))).toEqual({
      kind: "code",
      code: "xyz",
      next: "/listings",
    });
  });

  it("reports an incomplete link", () => {
    expect(parseConfirmationParams(params("type=signup"))).toMatchObject({
      kind: "error",
      error: "missing",
    });
  });

  it("rejects OTP types that are not e-mail confirmations", () => {
    expect(
      parseConfirmationParams(params("token_hash=abc&type=recovery")),
    ).toMatchObject({ kind: "error", error: "invalid" });
  });

  it("maps provider errors from the redirect", () => {
    expect(
      parseConfirmationParams(
        params("error=access_denied&error_code=otp_expired"),
      ),
    ).toMatchObject({ kind: "error", error: "expired" });
    expect(
      parseConfirmationParams(params("error=access_denied")),
    ).toMatchObject({ kind: "error", error: "invalid" });
  });

  it("never carries an off-site next path", () => {
    expect(
      parseConfirmationParams(
        params("token_hash=abc&type=email&next=https://evil.example"),
      ),
    ).toMatchObject({ next: "/listings" });
  });
});

describe("completeConfirmation", () => {
  it("verifies the token hash and redirects to the next path", async () => {
    const client = confirmClient();
    const destination = await completeConfirmation(
      parseConfirmationParams(
        params("token_hash=abc&type=signup&next=/profile"),
      ),
      client,
    );

    expect(client.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "abc",
      type: "signup",
    });
    expect(destination).toBe("/profile");
  });

  it("exchanges a PKCE code for a session", async () => {
    const client = confirmClient();
    const destination = await completeConfirmation(
      parseConfirmationParams(params("code=xyz")),
      client,
    );

    expect(client.auth.exchangeCodeForSession).toHaveBeenCalledWith("xyz");
    expect(client.auth.verifyOtp).not.toHaveBeenCalled();
    expect(destination).toBe("/listings");
  });

  it("sends expired links to the confirmation page with an expired error", async () => {
    const destination = await completeConfirmation(
      parseConfirmationParams(params("token_hash=abc&type=signup")),
      confirmClient({ code: "otp_expired", status: 403 }),
    );
    expect(destination).toBe("/auth/confirmation?error=expired");
  });

  it("sends used or invalid links to the confirmation page with an invalid error", async () => {
    const destination = await completeConfirmation(
      parseConfirmationParams(params("token_hash=abc&type=signup")),
      confirmClient({ status: 400, message: "bad token" }),
    );
    expect(destination).toBe("/auth/confirmation?error=invalid");
  });

  it("treats server and network failures as unknown errors", async () => {
    const client = confirmClient({ status: 500 });
    expect(
      await completeConfirmation(
        parseConfirmationParams(params("token_hash=abc&type=signup")),
        client,
      ),
    ).toBe("/auth/confirmation?error=unknown");

    client.auth.verifyOtp.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(
      await completeConfirmation(
        parseConfirmationParams(params("token_hash=abc&type=signup")),
        client,
      ),
    ).toBe("/auth/confirmation?error=unknown");
  });

  it("does not call Supabase for incomplete links", async () => {
    const client = confirmClient();
    const destination = await completeConfirmation(
      parseConfirmationParams(params("")),
      client,
    );
    expect(destination).toBe("/auth/confirmation?error=missing");
    expect(client.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("reports an unknown error when Supabase is not configured", async () => {
    expect(
      await completeConfirmation(
        parseConfirmationParams(params("token_hash=abc&type=signup")),
        null,
      ),
    ).toBe("/auth/confirmation?error=unknown");
  });
});

describe("confirmation error copy", () => {
  it("has a Slovenian message for every error without technical details", () => {
    for (const message of Object.values(confirmationErrorMessages)) {
      expect(message).toMatch(/povezav|potrdit/i);
      expect(message).not.toMatch(/token|otp|supabase/i);
    }
  });
});

describe("emailRedirectUrl", () => {
  it("points the e-mail link at the confirm route with a safe next path", () => {
    expect(emailRedirectUrl("https://roomieslo.si")).toBe(
      "https://roomieslo.si/auth/confirm?next=%2Flistings",
    );
    expect(emailRedirectUrl("https://roomieslo.si", "//evil")).toBe(
      "https://roomieslo.si/auth/confirm?next=%2Flistings",
    );
  });
});

describe("resendConfirmation", () => {
  const origin = "https://roomieslo.si";

  it("validates the e-mail before calling Supabase", async () => {
    const client = resendClient();
    expect(await resendConfirmation(client, "not-an-email", origin)).toEqual({
      ok: false,
      field: "email",
      message: "Vnesi veljaven e-naslov.",
    });
    expect(client.auth.resend).not.toHaveBeenCalled();
  });

  it("resends a sign-up confirmation with the normalized e-mail and redirect", async () => {
    const client = resendClient();
    const result = await resendConfirmation(
      client,
      "  Ana.Novak@Student.UNI-LJ.si ",
      origin,
    );

    expect(client.auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "ana.novak@student.uni-lj.si",
      options: {
        emailRedirectTo: "https://roomieslo.si/auth/confirm?next=%2Flistings",
      },
    });
    expect(result).toEqual({
      ok: true,
      message:
        "Če račun za ana.novak@student.uni-lj.si čaka na potrditev, smo poslali novo povezavo.",
    });
  });

  it("explains the rate limit", async () => {
    const result = await resendConfirmation(
      resendClient({ error: { status: 429 } }),
      "ana@student.uni-lj.si",
      origin,
    );
    expect(result).toMatchObject({ ok: false });
    expect(result.message).toMatch(/Počakaj nekaj minut/);
  });

  it("shows a safe message for other errors and network failures", async () => {
    const failed = await resendConfirmation(
      resendClient({ error: { status: 500, message: "SMTP exploded" } }),
      "ana@student.uni-lj.si",
      origin,
    );
    expect(failed).toMatchObject({ ok: false });
    expect(failed.message).not.toContain("SMTP");

    const offline = await resendConfirmation(
      resendClient(new TypeError("Failed to fetch")),
      "ana@student.uni-lj.si",
      origin,
    );
    expect(offline).toMatchObject({ ok: false });
    expect(offline.message).toMatch(/povezavo/);
  });

  it("reports unavailability when Supabase is not configured", async () => {
    expect(
      await resendConfirmation(null, "ana@student.uni-lj.si", origin),
    ).toMatchObject({ ok: false });
  });
});
