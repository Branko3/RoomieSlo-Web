import { describe, expect, it } from "vitest";
import { anonClient, signInA, skip } from "./clients";

describe.skipIf(skip)("auth", () => {
  it("signs a test user in and reports the same user from getUser", async () => {
    const { client, userId } = await signInA();
    const { data, error } = await client.auth.getUser();
    expect(error).toBeNull();
    expect(data.user?.id).toBe(userId);
    await client.auth.signOut();
  });

  it("rejects a wrong password with an auth error, not a session", async () => {
    const { data, error } = await anonClient().auth.signInWithPassword({
      email: "nobody-integration@example.invalid",
      password: "definitely-wrong",
    });
    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
  });

  it("gives anonymous visitors no application data (every policy is `to authenticated`)", async () => {
    const anon = anonClient();
    for (const table of [
      "profiles",
      "listings",
      "matches",
      "messages",
      "favorites",
      "questionnaire_answers",
      "reports",
      "admins",
    ]) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      // Either refused outright or filtered to nothing; never rows.
      expect(error ? [] : data, table).toEqual([]);
    }
  });

  it("refuses anonymous writes", async () => {
    const { error } = await anonClient().from("listings").insert({
      owner_id: "00000000-0000-0000-0000-000000000000",
      location: "x",
      price_per_month: 1,
    });
    expect(error).not.toBeNull();
  });

  it("ends the session on sign-out", async () => {
    const { client } = await signInA();
    await client.auth.signOut();
    const { data } = await client.auth.getSession();
    expect(data.session).toBeNull();
  });
});
