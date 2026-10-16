import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  jwtRole,
  readIntegrationEnv,
  REQUIRED_VARIABLES,
} from "../integration/env";

const jwt = (payload: object) =>
  `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;

const complete = {
  SUPABASE_TEST_URL: "https://staging.supabase.co",
  SUPABASE_TEST_ANON_KEY: jwt({ role: "anon" }),
  SUPABASE_TEST_USER_A_EMAIL: "a@example.test",
  SUPABASE_TEST_USER_A_PASSWORD: "pa",
  SUPABASE_TEST_USER_B_EMAIL: "b@example.test",
  SUPABASE_TEST_USER_B_PASSWORD: "pb",
};

describe("readIntegrationEnv", () => {
  it("is unconfigured, listing what is missing, when variables are absent", () => {
    expect(readIntegrationEnv({})).toEqual({
      configured: false,
      missing: [...REQUIRED_VARIABLES],
    });
    expect(
      readIntegrationEnv({ ...complete, SUPABASE_TEST_USER_B_PASSWORD: "  " }),
    ).toEqual({
      configured: false,
      missing: ["SUPABASE_TEST_USER_B_PASSWORD"],
    });
  });

  it("reads two users and an optional admin", () => {
    const env = readIntegrationEnv(complete);
    expect(env).toMatchObject({
      configured: true,
      url: complete.SUPABASE_TEST_URL,
      userA: { email: "a@example.test", password: "pa" },
      userB: { email: "b@example.test", password: "pb" },
      admin: null,
    });
    expect(
      readIntegrationEnv({
        ...complete,
        SUPABASE_TEST_ADMIN_EMAIL: "admin@example.test",
        SUPABASE_TEST_ADMIN_PASSWORD: "px",
      }),
    ).toMatchObject({ admin: { email: "admin@example.test", password: "px" } });
  });

  it("refuses service-role and secret keys, since they bypass RLS", () => {
    expect(() =>
      readIntegrationEnv({
        ...complete,
        SUPABASE_TEST_ANON_KEY: jwt({ role: "service_role" }),
      }),
    ).toThrow(/anon key/);
    expect(() =>
      readIntegrationEnv({
        ...complete,
        SUPABASE_TEST_ANON_KEY: "sb_secret_abc",
      }),
    ).toThrow(/anon key/);
    // Publishable (non-JWT) keys are allowed.
    expect(
      readIntegrationEnv({
        ...complete,
        SUPABASE_TEST_ANON_KEY: "sb_publishable_abc",
      }).configured,
    ).toBe(true);
  });

  it("refuses a non-http URL and identical users", () => {
    expect(() =>
      readIntegrationEnv({ ...complete, SUPABASE_TEST_URL: "staging" }),
    ).toThrow(/URL/);
    expect(() =>
      readIntegrationEnv({
        ...complete,
        SUPABASE_TEST_USER_B_EMAIL: complete.SUPABASE_TEST_USER_A_EMAIL,
      }),
    ).toThrow(/different/);
  });
});

describe("jwtRole", () => {
  it("reads the role claim and tolerates non-JWT input", () => {
    expect(jwtRole(jwt({ role: "anon" }))).toBe("anon");
    expect(jwtRole("not-a-jwt")).toBeNull();
    expect(jwtRole("a.!!!.c")).toBeNull();
  });
});

describe("integration suite layout", () => {
  const dir = join(process.cwd(), "integration");
  const suites = readdirSync(dir).filter((f) => f.endsWith(".int.ts"));

  it("covers auth, account deletion, cohabitation, ratings, RLS, Storage, and Realtime", () => {
    expect(suites.sort()).toEqual([
      "auth.int.ts",
      "cohabitation.int.ts",
      "deletion.int.ts",
      "ratings.int.ts",
      "realtime.int.ts",
      "rls.int.ts",
      "storage.int.ts",
    ]);
  });

  it("skips itself without configuration and never uses a service-role key", () => {
    for (const suite of suites) {
      const source = readFileSync(join(dir, suite), "utf8");
      expect(source, suite).toContain("describe.skipIf(skip)");
      expect(source, suite).not.toMatch(/service_role|SERVICE_ROLE/);
    }
  });

  it("is not picked up by the unit test run", () => {
    expect(suites.every((f) => !f.endsWith(".test.ts"))).toBe(true);
  });
});
