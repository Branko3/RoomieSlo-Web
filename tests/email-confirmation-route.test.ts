import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createSupabaseServerClient = vi.fn();

vi.mock("../lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClient(),
}));

const { GET } = await import("../app/auth/confirm/route");

const verifyOtp = vi.fn();

beforeEach(() => {
  verifyOtp.mockReset();
  createSupabaseServerClient.mockReset();
  createSupabaseServerClient.mockReturnValue({
    auth: { verifyOtp, exchangeCodeForSession: vi.fn() },
  });
});

const get = (query: string) =>
  GET(new NextRequest(`https://roomieslo.test/auth/confirm${query}`));

describe("GET /auth/confirm", () => {
  it("redirects to the requested page after a successful confirmation", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const response = await get("?token_hash=abc&type=signup&next=/profile");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://roomieslo.test/profile",
    );
  });

  it("redirects to the confirmation page when the link expired", async () => {
    verifyOtp.mockResolvedValue({ error: { code: "otp_expired" } });
    const response = await get("?token_hash=abc&type=signup");

    expect(response.headers.get("location")).toBe(
      "https://roomieslo.test/auth/confirmation?error=expired",
    );
  });

  it("never redirects off-site", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const response = await get(
      "?token_hash=abc&type=signup&next=https://evil.example",
    );

    expect(response.headers.get("location")).toBe(
      "https://roomieslo.test/listings",
    );
  });

  it("does not create a Supabase client for incomplete links", async () => {
    const response = await get("");

    expect(createSupabaseServerClient).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://roomieslo.test/auth/confirmation?error=missing",
    );
  });
});
