import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  env,
  marker,
  signInB,
  skip,
  type Session,
} from "./clients";

/**
 * End-to-end account deletion against staging, through the deployed
 * `delete-account` Edge Function. It never deletes the shared test users: it
 * signs up a throwaway account, which needs e-mail confirmation turned off on
 * the staging project (otherwise the suite skips itself).
 */
describe.skipIf(skip)("account deletion (throwaway user)", () => {
  let doomed: { client: SupabaseClient; userId: string; token: string } | null =
    null;
  let b: Session;
  let matchId = "";
  let messageBody = "";
  const email = `${marker("delete")}@example.test`;
  const password = `It-${Math.random().toString(36).slice(2)}-Aa1!`;

  beforeAll(async () => {
    b = await signInB();
    const client = anonClient();
    const { data } = await client.auth.signUp({
      email,
      password,
      options: { data: { display_name: "Za izbris" } },
    });
    if (!data.session || !data.user) return; // confirmations are on: skip
    doomed = {
      client,
      userId: data.user.id,
      token: data.session.access_token,
    };

    // A chat with B, so the tombstone can be checked from B's side.
    const match = await client
      .from("matches")
      .insert({ user_id_a: doomed.userId, user_id_b: b.userId })
      .select("id")
      .single();
    if (match.error) throw match.error;
    matchId = match.data.id;
    const accepted = await b.client.rpc("accept_match", {
      p_match_id: matchId,
    });
    if (accepted.error) throw accepted.error;
    messageBody = marker("last-words");
    const sent = await client.from("messages").insert({
      match_id: matchId,
      sender_id: doomed.userId,
      body: messageBody,
    });
    if (sent.error) throw sent.error;
    await client
      .from("questionnaire_answers")
      .insert({ profile_id: doomed.userId, question_id: "q_noise", value: 1 });
  });

  afterAll(async () => {
    await b?.client.auth.signOut();
  });

  it("refuses a wrong confirmation phrase without deleting anything", async (context) => {
    if (!doomed) return context.skip();
    const { error } = await doomed.client.functions.invoke("delete-account", {
      body: { confirm: "NE" },
    });
    expect((error as { context?: Response } | null)?.context?.status).toBe(400);
    const still = await b.client
      .from("profiles")
      .select("deleted_at")
      .eq("id", doomed.userId)
      .single();
    expect(still.data?.deleted_at).toBeNull();
  });

  it("deletes the account and leaves a tombstone for the other participant", async (context) => {
    if (!doomed) return context.skip();
    const { error } = await doomed.client.functions.invoke("delete-account", {
      body: { confirm: "IZBRIŠI" },
    });
    expect(error).toBeNull();

    const profile = await b.client
      .from("profiles")
      .select("display_name, faculty, bio, deleted_at, is_available")
      .eq("id", doomed.userId)
      .single();
    expect(profile.data).toMatchObject({
      display_name: "Izbrisan uporabnik",
      faculty: "",
      bio: "",
      is_available: false,
    });
    expect(profile.data?.deleted_at).not.toBeNull();

    // B keeps the conversation and the deleted user's message.
    const messages = await b.client
      .from("messages")
      .select("body")
      .eq("match_id", matchId);
    expect(messages.data?.map((m) => m.body)).toContain(messageBody);

    // B can no longer write to the deleted account.
    const reply = await b.client
      .from("messages")
      .insert({ match_id: matchId, sender_id: b.userId, body: marker("late") });
    expect(reply.error).not.toBeNull();
  });

  it("answers a repeated request as already deleted", async (context) => {
    if (!doomed || !env.configured) return context.skip();
    const response = await fetch(`${env.url}/functions/v1/delete-account`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${doomed.token}`,
        apikey: env.anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirm: "IZBRIŠI" }),
    });
    expect(response.status).toBe(410);
  });

  it("no longer lets the account sign in", async (context) => {
    if (!doomed) return context.skip();
    const { error } = await anonClient().auth.signInWithPassword({
      email,
      password,
    });
    expect(error).not.toBeNull();
  });
});
