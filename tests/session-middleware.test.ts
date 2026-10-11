import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createServerClient = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => createServerClient(...args),
}));

const { updateSession } = await import("../lib/supabase/middleware");

type CookieAdapter = {
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: { name: string; value: string; options: object }[]) => void;
};

const env = { ...process.env };

beforeEach(() => {
  createServerClient.mockReset();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
});

afterEach(() => {
  process.env = { ...env };
});

function request() {
  return new NextRequest("https://roomieslo.test/listings", {
    headers: { cookie: "sb-example-auth-token=old" },
  });
}

describe("session refresh middleware", () => {
  it("passes requests through untouched when Supabase is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const response = await updateSession(request());

    expect(createServerClient).not.toHaveBeenCalled();
    expect(response.cookies.getAll()).toEqual([]);
  });

  it("uses only the public anon key and the request cookies", async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: null } });
    let seenCookies: unknown;
    createServerClient.mockImplementation(
      (_url: string, _key: string, { cookies }: { cookies: CookieAdapter }) => {
        seenCookies = cookies.getAll();
        return { auth: { getUser } };
      },
    );

    await updateSession(request());

    expect(createServerClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
      expect.any(Object),
    );
    expect(seenCookies).toEqual([
      { name: "sb-example-auth-token", value: "old" },
    ]);
    expect(getUser).toHaveBeenCalledOnce();
  });

  it("writes refreshed auth cookies to the response so a reload restores the session", async () => {
    createServerClient.mockImplementation(
      (
        _url: string,
        _key: string,
        { cookies }: { cookies: CookieAdapter },
      ) => ({
        auth: {
          getUser: async () => {
            cookies.setAll([
              {
                name: "sb-example-auth-token",
                value: "new",
                options: { path: "/" },
              },
            ]);
            return { data: { user: { id: "user-1" } } };
          },
        },
      }),
    );

    const response = await updateSession(request());

    expect(response.cookies.get("sb-example-auth-token")?.value).toBe("new");
  });

  it("keeps existing cookies when the refresh request fails", async () => {
    createServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
      },
    });

    const response = await updateSession(request());

    expect(response.status).toBe(200);
    expect(response.cookies.getAll()).toEqual([]);
  });
});
