import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.RUN_SUPABASE_INTEGRATION === "1";
const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const canRun = enabled && Boolean(url && anonKey && serviceRoleKey);

type FixtureUser = {
  id: string;
  client: SupabaseClient;
  email: string;
  password: string;
};

const describeIntegration = canRun ? describe : describe.skip;

describeIntegration("disposable Supabase migration contract", () => {
  const admin = canRun ? createClient(url!, serviceRoleKey!) : null;
  const users: FixtureUser[] = [];
  let listingId = "";
  let matchId = "";
  let messageId = "";

  async function createFixtureUser(label: string): Promise<FixtureUser> {
    const email = `migration-${label}-${randomUUID()}@example.test`;
    const password = `Test-${randomUUID()}-Aa1!`;
    const created = await admin!.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    const client = createClient(url!, anonKey!);
    const signedIn = await client.auth.signInWithPassword({ email, password });
    expect(signedIn.error).toBeNull();
    expect(signedIn.data.user).not.toBeNull();
    return { id: signedIn.data.user!.id, client, email, password };
  }

  beforeAll(async () => {
    users.push(
      await createFixtureUser("owner"),
      await createFixtureUser("participant"),
      await createFixtureUser("outsider"),
      await createFixtureUser("admin"),
    );
    const adminInsert = await admin!.from("admins").insert({ user_id: users[3].id });
    expect(adminInsert.error).toBeNull();
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("storage.objects").delete().in("bucket_id", ["vpisnice"]);
    for (const user of users) await admin.auth.admin.deleteUser(user.id);
  });

  it("applies without demo rows and exposes the private academic-document bucket", async () => {
    for (const table of ["listings", "matches", "messages", "favorites", "reports"]) {
      const result = await admin!.from(table).select("*", { count: "exact", head: true });
      expect(result.error).toBeNull();
      expect(result.count).toBe(0);
    }
    const bucket = await admin!.storage.getBucket("vpisnice");
    expect(bucket.error).toBeNull();
    expect(bucket.data?.public).toBe(false);
  });

  it("enforces owner, participant, questionnaire, favorite, report, and admin policies", async () => {
    const owner = users[0].client;
    const outsider = users[2].client;
    const ownerListing = await owner.from("listings").insert({
      owner_id: users[0].id,
      location: "Ljubljana",
      price_per_month: 400,
    }).select("id").single();
    expect(ownerListing.error).toBeNull();
    listingId = ownerListing.data!.id;

    const outsiderUpdate = await outsider.from("listings").update({ description: "blocked" }).eq("id", listingId);
    expect(outsiderUpdate.error).not.toBeNull();
    const ownerUpdate = await owner.from("listings").update({ description: "allowed" }).eq("id", listingId);
    expect(ownerUpdate.error).toBeNull();

    expect((await owner.from("questionnaire_answers").insert({
      profile_id: users[0].id, question_id: "quiet", value: 5,
    })).error).toBeNull();
    expect((await outsider.from("questionnaire_answers").insert({
      profile_id: users[0].id, question_id: "noise", value: 1,
    })).error).not.toBeNull();

    expect((await owner.from("favorites").insert({
      profile_id: users[0].id, listing_id: listingId,
    })).error).toBeNull();
    expect((await owner.from("favorites").insert({
      profile_id: users[0].id, listing_id: listingId,
    })).error).not.toBeNull();
    expect((await outsider.from("favorites").insert({
      profile_id: users[0].id, listing_id: listingId,
    })).error).not.toBeNull();

    expect((await owner.from("reports").insert({
      reporter_id: users[0].id, reported_id: users[2].id, reason: "test",
    })).error).toBeNull();
    expect((await outsider.from("reports").select("*")).error).not.toBeNull();
    expect((await users[3].client.from("reports").select("*")).error).toBeNull();
  });

  it("enforces canonical match uniqueness and participant-only atomic acceptance", async () => {
    const participant = users[1].client;
    const outsider = users[2].client;
    const created = await users[0].client.from("matches").insert({
      user_id_a: users[0].id, user_id_b: users[1].id,
    }).select("id").single();
    expect(created.error).toBeNull();
    matchId = created.data!.id;
    expect((await participant.from("matches").insert({
      user_id_a: users[1].id, user_id_b: users[0].id,
    })).error).not.toBeNull();
    expect((await outsider.rpc("accept_match", { p_match_id: matchId })).error).not.toBeNull();

    const results = await Promise.all([
      users[0].client.rpc("accept_match", { p_match_id: matchId }),
      participant.rpc("accept_match", { p_match_id: matchId }),
    ]);
    expect(results.filter((result) => !result.error)).toHaveLength(1);
    const finalMatch = await admin!.from("matches").select("status, version").eq("id", matchId).single();
    expect(finalMatch.data).toEqual({ status: "accepted", version: 2 });
  });

  it("restricts messages and private Storage while permitting Realtime messages", async () => {
    const owner = users[0].client;
    const participant = users[1].client;
    const outsider = users[2].client;
    const inserted = await owner.from("messages").insert({
      match_id: matchId, sender_id: users[0].id, body: "hello",
    }).select("id").single();
    expect(inserted.error).toBeNull();
    messageId = inserted.data!.id;
    expect((await outsider.from("messages").select("*").eq("id", messageId)).error).toBeNull();
    expect((await outsider.from("messages").insert({
      match_id: matchId, sender_id: users[2].id, body: "blocked",
    })).error).not.toBeNull();

    const path = `${users[0].id}/document-${randomUUID()}.pdf`;
    expect((await owner.storage.from("vpisnice").upload(path, new Blob(["pdf"]))).error).toBeNull();
    expect((await outsider.storage.from("vpisnice").download(path)).error).not.toBeNull();
    const publicUrl = owner.storage.from("vpisnice").getPublicUrl(path).data.publicUrl;
    expect((await fetch(publicUrl)).ok).toBe(false);

    const received = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Realtime message was not received")), 5000);
      const channel = owner
        .channel(`migration-test-${randomUUID()}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` }, () => {
          clearTimeout(timeout);
          void owner.removeChannel(channel);
          resolve();
        });
      void channel.subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timeout);
          reject(new Error(`Realtime subscription failed: ${status}`));
        }
      });
    });
    expect((await participant.from("messages").insert({
      match_id: matchId, sender_id: users[1].id, body: "realtime",
    })).error).toBeNull();
    await received;
  });
});
