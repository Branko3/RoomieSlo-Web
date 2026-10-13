import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminCredentials,
  ensureAcceptedMatch,
  isRlsRefusal,
  marker,
  signIn,
  signInA,
  signInB,
  skip,
  type PairMatch,
  type Session,
} from "./clients";

/**
 * Negative-access checks: user A must not be able to read or change B's data.
 * Rows created here carry an `it-…` marker and are removed where RLS allows it;
 * matches and messages have no delete policy, so a single A↔B match is reused.
 */
describe.skipIf(skip)("RLS negative access", () => {
  let a: Session;
  let b: Session;
  let listingB: string;
  let matchAB: string;
  let requesterAnswer: PairMatch["requesterAnswer"] = null;
  const createdListings: Array<{ session: () => Session; id: string }> = [];

  beforeAll(async () => {
    a = await signInA();
    b = await signInB();

    const listing = await b.client
      .from("listings")
      .insert({
        owner_id: b.userId,
        location: marker("rls"),
        price_per_month: 300,
      })
      .select("id")
      .single();
    if (listing.error) throw listing.error;
    listingB = listing.data.id;
    createdListings.push({ session: () => b, id: listingB });

    const match = await ensureAcceptedMatch(a, b);
    matchAB = match.id;
    requesterAnswer = match.requesterAnswer;
  });

  afterAll(async () => {
    for (const { session, id } of createdListings) {
      await session().client.from("listings").delete().eq("id", id);
    }
    await a?.client
      .from("favorites")
      .delete()
      .eq("profile_id", a.userId)
      .eq("listing_id", listingB);
    await a?.client.auth.signOut();
    await b?.client.auth.signOut();
  });

  describe("profiles", () => {
    it("lets A read but not update B's profile", async () => {
      const read = await a.client
        .from("profiles")
        .select("id")
        .eq("id", b.userId);
      expect(read.data).toHaveLength(1);
      const update = await a.client
        .from("profiles")
        .update({ bio: marker("hijack") })
        .eq("id", b.userId)
        .select("id");
      expect(update.error ? [] : update.data).toEqual([]);
    });

    it("does not let A insert a profile for someone else", async () => {
      const { error } = await a.client
        .from("profiles")
        .insert({ id: b.userId, display_name: "x" });
      expect(error).not.toBeNull();
    });

    // Known gap noted in PR #20, fixed by the trigger in PR #51.
    it("does not let a non-admin verify their own academic status", async () => {
      await a.client
        .from("profiles")
        .update({ academic_status_verified: true })
        .eq("id", a.userId);
      const { data } = await a.client
        .from("profiles")
        .select("academic_status_verified")
        .eq("id", a.userId)
        .single();
      expect(data?.academic_status_verified).toBe(false);
    });
  });

  describe("listings", () => {
    it("refuses a listing owned by someone else", async () => {
      const { data, error } = await a.client
        .from("listings")
        .insert({
          owner_id: b.userId,
          location: marker("forge"),
          price_per_month: 1,
        })
        .select("id");
      if (data?.length)
        createdListings.push({ session: () => b, id: data[0].id });
      expect(isRlsRefusal(error)).toBe(true);
    });

    it("ignores A's update and delete of B's listing", async () => {
      const update = await a.client
        .from("listings")
        .update({ price_per_month: 1 })
        .eq("id", listingB)
        .select("id");
      expect(update.error ? [] : update.data).toEqual([]);
      const remove = await a.client
        .from("listings")
        .delete()
        .eq("id", listingB)
        .select("id");
      expect(remove.error ? [] : remove.data).toEqual([]);
      const still = await b.client
        .from("listings")
        .select("price_per_month")
        .eq("id", listingB)
        .single();
      expect(Number(still.data?.price_per_month)).toBe(300);
    });
  });

  describe("favorites and questionnaire answers", () => {
    it("keeps questionnaire answers private to their owner", async () => {
      await b.client
        .from("questionnaire_answers")
        .upsert(
          { profile_id: b.userId, question_id: "q_noise", value: 0.5 },
          { onConflict: "profile_id,question_id" },
        );
      const own = await b.client
        .from("questionnaire_answers")
        .select("question_id")
        .eq("profile_id", b.userId);
      expect(own.data?.length).toBeGreaterThan(0);
      const theirs = await a.client
        .from("questionnaire_answers")
        .select("question_id")
        .eq("profile_id", b.userId);
      expect(theirs.error ? [] : theirs.data).toEqual([]);
      // Recommendations still work for A, and carry no one else's answers.
      const ranked = await a.client.functions.invoke("recommendations");
      expect(ranked.error).toBeNull();
      const others = (
        ranked.data as { recommendations: Array<Record<string, unknown>> }
      ).recommendations;
      for (const entry of others) {
        expect(entry).not.toHaveProperty("answers");
        expect(entry.profile).not.toHaveProperty("answers");
      }
    });

    it("keeps favorites private and refuses favorites for someone else", async () => {
      const own = await a.client
        .from("favorites")
        .insert({ profile_id: a.userId, listing_id: listingB });
      expect(own.error).toBeNull();
      const seenByB = await b.client
        .from("favorites")
        .select("profile_id")
        .eq("profile_id", a.userId);
      expect(seenByB.data).toEqual([]);
      const forged = await a.client
        .from("favorites")
        .insert({ profile_id: b.userId, listing_id: listingB });
      expect(isRlsRefusal(forged.error)).toBe(true);
    });

    it("refuses writing answers for someone else", async () => {
      const { error } = await a.client
        .from("questionnaire_answers")
        .insert({ profile_id: b.userId, question_id: marker("q"), value: 1 });
      expect(isRlsRefusal(error)).toBe(true);
    });
  });

  describe("matches and messages", () => {
    it("refuses a match request made in someone else's name", async () => {
      const { error } = await a.client
        .from("matches")
        .insert({ user_id_a: b.userId, user_id_b: a.userId });
      expect(isRlsRefusal(error)).toBe(true);
    });

    it("refuses a message sent as the other participant", async () => {
      const { error } = await a.client.from("messages").insert({
        match_id: matchAB,
        sender_id: b.userId,
        body: marker("forged"),
      });
      expect(isRlsRefusal(error)).toBe(true);
    });

    // Gap noted in PR #42, closed by migration 20261013000000.
    it("does not let a participant rewrite the other person's message", async () => {
      const sent = await b.client
        .from("messages")
        .insert({
          match_id: matchAB,
          sender_id: b.userId,
          body: marker("original"),
        })
        .select("id, body")
        .single();
      if (sent.error) {
        // Blocked users or an unaccepted match may refuse the insert; nothing to rewrite.
        return;
      }
      await a.client
        .from("messages")
        .update({ body: "rewritten" })
        .eq("id", sent.data.id);
      const after = await b.client
        .from("messages")
        .select("body")
        .eq("id", sent.data.id)
        .single();
      expect(after.data?.body).toBe(sent.data.body);
    });
    it("does not let the requester accept their own request", () => {
      // Only observable when this run created the match (it is reused later).
      if (!requesterAnswer) return;
      expect(requesterAnswer.rpcError).not.toBeNull();
      expect(requesterAnswer.updatedRows).toBe(0);
    });

    it("lets the recipient mark a message read but not move it backwards", async () => {
      const sent = await a.client
        .from("messages")
        .insert({ match_id: matchAB, sender_id: a.userId, body: marker("dl") })
        .select("id")
        .single();
      expect(sent.error).toBeNull();
      const read = await b.client
        .from("messages")
        .update({ delivery_status: "read" })
        .eq("id", sent.data!.id)
        .select("delivery_status");
      expect(read.data).toEqual([{ delivery_status: "read" }]);
      const back = await b.client
        .from("messages")
        .update({ delivery_status: "sent" })
        .eq("id", sent.data!.id)
        .select("id");
      expect(back.error).not.toBeNull();
    });

    it("does not let the sender change their own message's delivery status", async () => {
      const sent = await a.client
        .from("messages")
        .insert({ match_id: matchAB, sender_id: a.userId, body: marker("own") })
        .select("id")
        .single();
      const update = await a.client
        .from("messages")
        .update({ delivery_status: "read" })
        .eq("id", sent.data!.id)
        .select("id");
      expect(update.error ? [] : update.data).toEqual([]);
    });
  });

  describe("reports and admins", () => {
    it("refuses direct report inserts, even in one's own name", async () => {
      for (const reporter of [b.userId, a.userId]) {
        const direct = await a.client.from("reports").insert({
          reporter_id: reporter,
          reported_id: reporter === a.userId ? b.userId : a.userId,
          reason: "Drugo",
          description: marker("direct"),
        });
        expect(isRlsRefusal(direct.error)).toBe(true);
      }
    });

    it("files a chat report through submit_report, only for that conversation", async () => {
      const bogus = await a.client.rpc("submit_report", {
        p_reported: b.userId,
        p_reason: "Drugo",
        p_description: marker("bogus"),
        p_match: "00000000-0000-4000-8000-000000000000",
      });
      expect(bogus.error).not.toBeNull();
      const self = await a.client.rpc("submit_report", {
        p_reported: a.userId,
        p_reason: "Drugo",
        p_description: marker("self"),
        p_match: null,
      });
      expect(self.error).not.toBeNull();
      // One real report per run (reports cannot be deleted through the API).
      const filed = await a.client.rpc("submit_report", {
        p_reported: b.userId,
        p_reason: "Drugo",
        p_description: marker("evidence"),
        p_match: matchAB,
      });
      expect(filed.error).toBeNull();
      expect(typeof filed.data).toBe("string");
      // The snapshot is not readable through the API.
      const evidence = await a.client
        .from("report_evidence")
        .select("body")
        .eq("report_id", filed.data);
      expect(evidence.error ? [] : evidence.data).toEqual([]);
    });

    it("hides reports from non-admins and ignores their status updates", async () => {
      const read = await a.client.from("reports").select("id").limit(5);
      expect(read.error ? [] : read.data).toEqual([]);
      const update = await a.client
        .from("reports")
        .update({ status: "dismissed" })
        .neq("status", "dismissed")
        .select("id");
      expect(update.error ? [] : update.data).toEqual([]);
    });

    it("does not let anyone make themselves an admin", async () => {
      const { error } = await a.client
        .from("admins")
        .insert({ user_id: a.userId });
      expect(error).not.toBeNull();
      const self = await a.client
        .from("admins")
        .select("user_id")
        .eq("user_id", a.userId);
      expect(self.data).toEqual([]);
    });

    it("refuses the reported-conversation view to non-admins", async () => {
      const { error } = await a.client.rpc("admin_report_conversation", {
        p_report_id: "00000000-0000-4000-8000-000000000000",
      });
      expect(error).not.toBeNull();
      const log = await a.client.from("admin_message_reads").select("id");
      expect(log.error ? [] : log.data).toEqual([]);
    });

    it.skipIf(!adminCredentials())(
      "records every admin read of a reported conversation",
      async () => {
        const admin = await signIn(adminCredentials()!);
        const reports = await admin.client
          .from("reports")
          .select("id")
          .not("match_id", "is", null)
          .limit(1);
        const reportId = reports.data?.[0]?.id;
        if (reportId) {
          const count = async () =>
            (
              await admin.client
                .from("admin_message_reads")
                .select("id", { count: "exact", head: true })
                .eq("report_id", reportId)
            ).count ?? 0;
          const before = await count();
          const read = await admin.client.rpc("admin_report_conversation", {
            p_report_id: reportId,
          });
          expect(read.error).toBeNull();
          expect(await count()).toBe(before + 1);
          // The log is append-only, even for admins.
          const tamper = await admin.client
            .from("admin_message_reads")
            .delete()
            .eq("report_id", reportId)
            .select("id");
          expect(tamper.error ? [] : tamper.data).toEqual([]);
        }
        await admin.client.auth.signOut();
      },
    );

    it.skipIf(!adminCredentials())("lets an admin read reports", async () => {
      const admin = await signIn(adminCredentials()!);
      const { error } = await admin.client
        .from("reports")
        .select("id")
        .limit(1);
      expect(error).toBeNull();
      await admin.client.auth.signOut();
    });
  });
});
