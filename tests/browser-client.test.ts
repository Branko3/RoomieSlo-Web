import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn((url: string, key: string) => ({ url, key })),
}));

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "../lib/config";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

const saved = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

function setEnv(url?: string, key?: string) {
  if (url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  if (key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = key;
}

afterEach(() => {
  setEnv(saved.url, saved.key);
  vi.mocked(createBrowserClient).mockClear();
});

describe("getSupabaseConfig", () => {
  it("is unconfigured when either public variable is missing or empty", () => {
    for (const [url, key] of [
      [undefined, undefined],
      ["https://x.supabase.co", undefined],
      [undefined, "anon"],
      ["", "anon"],
    ] as const) {
      setEnv(url, key);
      expect(getSupabaseConfig()).toEqual({
        configured: false,
        url: "",
        anonKey: "",
      });
    }
  });
});

describe("createSupabaseBrowserClient", () => {
  it("creates the client with only the public URL and anon key", () => {
    setEnv("https://x.supabase.co", "anon");
    expect(createSupabaseBrowserClient()).toEqual({
      url: "https://x.supabase.co",
      key: "anon",
    });
    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://x.supabase.co",
      "anon",
    );
  });

  it("fails clearly instead of creating a client without configuration", () => {
    setEnv(undefined, undefined);
    expect(() => createSupabaseBrowserClient()).toThrow(/not configured/);
    expect(createBrowserClient).not.toHaveBeenCalled();
  });
});
