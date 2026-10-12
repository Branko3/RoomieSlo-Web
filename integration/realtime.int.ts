import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  marker,
  signInA,
  signInB,
  skip,
  type Session,
} from "./clients";

const WAIT_MS = 8000;

/** Subscribes to message inserts and resolves once the channel is joined. */
async function listen(
  client: SupabaseClient,
  name: string,
  received: string[],
): Promise<RealtimeChannel> {
  const channel = client
    .channel(name)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) =>
        received.push(String((payload.new as { body?: string }).body)),
    );
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("subscribe timed out")),
      WAIT_MS,
    );
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timer);
        reject(new Error(`subscribe failed: ${status}`));
      }
    });
  });
  return channel;
}

async function waitFor(check: () => boolean, ms = WAIT_MS) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return check();
}

/**
 * Realtime `postgres_changes` must respect RLS: a participant receives a new
 * message in their match; an anonymous subscriber receives nothing.
 */
describe.skipIf(skip)("Realtime (messages)", () => {
  let a: Session;
  let b: Session;
  let anon: SupabaseClient;
  let matchAB: string | null = null;
  const channels: Array<{ client: SupabaseClient; channel: RealtimeChannel }> =
    [];

  beforeAll(async () => {
    a = await signInA();
    b = await signInB();
    anon = anonClient();
    // Realtime evaluates RLS with the socket's token.
    b.client.realtime.setAuth(
      (await b.client.auth.getSession()).data.session?.access_token ?? null,
    );
    const { data } = await a.client
      .from("matches")
      .select("id")
      .or(
        `and(user_id_a.eq.${a.userId},user_id_b.eq.${b.userId}),and(user_id_a.eq.${b.userId},user_id_b.eq.${a.userId})`,
      )
      .limit(1);
    matchAB = data?.[0]?.id ?? null;
    if (!matchAB) {
      const created = await a.client
        .from("matches")
        .insert({ user_id_a: a.userId, user_id_b: b.userId })
        .select("id")
        .single();
      matchAB = created.data?.id ?? null;
    }
  });

  afterAll(async () => {
    for (const { client, channel } of channels)
      await client.removeChannel(channel);
    await a?.client.auth.signOut();
    await b?.client.auth.signOut();
  });

  it("delivers a new message to the other participant but not to an anonymous subscriber", async () => {
    expect(matchAB, "an A↔B match is needed").not.toBeNull();
    const toB: string[] = [];
    const toAnon: string[] = [];
    channels.push({
      client: b.client,
      channel: await listen(b.client, marker("b"), toB),
    });
    channels.push({
      client: anon,
      channel: await listen(anon, marker("anon"), toAnon),
    });

    const body = marker("rt");
    const { error } = await a.client
      .from("messages")
      .insert({ match_id: matchAB, sender_id: a.userId, body });
    expect(error).toBeNull();

    expect(await waitFor(() => toB.includes(body))).toBe(true);
    // Give a leaking subscription the same window to (wrongly) receive it.
    await waitFor(() => toAnon.length > 0, 2000);
    expect(toAnon).toEqual([]);
  });

  it("stops delivering after the channel is removed", async () => {
    const received: string[] = [];
    const channel = await listen(b.client, marker("gone"), received);
    await b.client.removeChannel(channel);
    const body = marker("after");
    await a.client
      .from("messages")
      .insert({ match_id: matchAB, sender_id: a.userId, body });
    await waitFor(() => received.length > 0, 2000);
    expect(received).toEqual([]);
  });
});
