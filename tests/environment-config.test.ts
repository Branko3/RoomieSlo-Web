import { describe, expect, it } from "vitest";
import { getDeploymentEnvironment, validateEnvironment } from "../lib/config";

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
