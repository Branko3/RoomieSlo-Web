import { describe, expect, it } from "vitest";
import {
  getDeploymentEnvironment,
  getSupabaseConfig,
  validateEnvironment,
} from "../lib/config";
import { isPrivilegedSupabaseKey } from "../lib/environment-validation.mjs";

const publicConfig = {
  NEXT_PUBLIC_SUPABASE_URL: "https://dev-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

describe("deployment environment contract", () => {
  it("defaults to isolated development semantics", () => {
    expect(getDeploymentEnvironment({})).toBe("development");
  });

  it("recognizes staging and production only through deployment configuration", () => {
    expect(getDeploymentEnvironment({ ROOMIESLO_ENV: "staging" })).toBe(
      "staging",
    );
    expect(getDeploymentEnvironment({ ROOMIESLO_ENV: "production" })).toBe(
      "production",
    );
    expect(getDeploymentEnvironment({ ROOMIESLO_ENV: "unexpected" })).toBe(
      "development",
    );
  });

  it("fails explicitly when public Supabase configuration is missing", () => {
    const result = validateEnvironment({ ROOMIESLO_ENV: "development" });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL is required.",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is required.",
    ]);
  });

  it("rejects an invalid deployment environment", () => {
    const result = validateEnvironment({
      ...publicConfig,
      ROOMIESLO_ENV: "unexpected",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "ROOMIESLO_ENV must be development, staging, or production.",
    );
  });

  it("rejects local or insecure staging and production endpoints", () => {
    const result = validateEnvironment({
      ...publicConfig,
      ROOMIESLO_ENV: "staging",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("non-local HTTPS URL");
  });

  it("rejects a service-role JWT in the public key slot", () => {
    const payload = Buffer.from(
      JSON.stringify({ role: "service_role" }),
    ).toString("base64url");
    const result = validateEnvironment({
      ...publicConfig,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: `header.${payload}.signature`,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("service-role");
  });
});

describe("deployment environment hardening", () => {
  const jwt = (role: string) =>
    `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;

  it("rejects opaque Supabase secret keys in the public key slot", () => {
    const result = validateEnvironment({
      ...publicConfig,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_abc123",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("service-role");
  });

  it("accepts publishable and anon keys", () => {
    expect(isPrivilegedSupabaseKey("sb_publishable_abc123")).toBe(false);
    expect(isPrivilegedSupabaseKey(jwt("anon"))).toBe(false);
    expect(isPrivilegedSupabaseKey(jwt("service_role"))).toBe(true);
  });

  it.each([
    "https://[::1]",
    "https://127.0.0.2",
    "https://0.0.0.0",
    "https://db.localhost",
  ])("rejects the loopback endpoint %s outside development", (url) => {
    const result = validateEnvironment({
      ...publicConfig,
      ROOMIESLO_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: url,
    });
    expect(result.errors).toContain(
      "production Supabase configuration must use a non-local HTTPS URL.",
    );
  });

  it("rejects credentials embedded in the public Supabase URL", () => {
    const result = validateEnvironment({
      ...publicConfig,
      NEXT_PUBLIC_SUPABASE_URL: "https://user:pass@dev-project.supabase.co",
    });
    expect(result.errors).toContain(
      "NEXT_PUBLIC_SUPABASE_URL must not contain credentials.",
    );
  });

  it("never hands a privileged key to the browser client", () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      publicConfig.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = jwt("service_role");
    try {
      expect(getSupabaseConfig()).toEqual({
        configured: false,
        url: "",
        anonKey: "",
      });
    } finally {
      if (originalUrl === undefined)
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      if (originalKey === undefined)
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    }
  });
});
