import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminCredentials,
  ensureAcceptedMatch,
  signIn,
  signInA,
  signInB,
  skip,
  type Session,
} from "./clients";

/** Current month (first day) in Slovenian time, as the database computes it. */
function currentMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Ljubljana",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-01`;
}

/**
 * Rating RLS checks with users A and B and, when configured, the admin account
 * as an unrelated third party. Each run confirms and immediately ends a new
 * A↔B cohabitation (the window then opens at once), and only A rates B, so A
 * never receives ratings and A's summary stays below the threshold however
 * often the suite runs. Ratings have no delete policy and stay behind.
 */
describe.skipIf(skip)("roommate ratings RLS", () => {
  let a: Session;
  let b: Session;
  let cohabitationId: string;
  let ratingId: string;
  const month = currentMonth();

  beforeAll(async () => {
    a = await signInA();
    b = await signInB();
    const matchId = (await ensureAcceptedMatch(a, b)).id;

    // Close anything an earlier run left open, then start a fresh cohabitation.
    const open = await a.client
      .from("cohabitations")
      .select("id, status, initiated_by")
      .eq("match_id", matchId)
      .in("status", ["pending", "active"])
      .maybeSingle();
    if (open.error) throw open.error;
    if (open.data?.status === "pending") {
      const responder = open.data.initiated_by === a.userId ? b : a;
      await responder.client.rpc("respond_cohabitation", {
        p_id: open.data.id,
        p_confirm: true,
      });
    }
    if (open.data)
      await a.client.rpc("end_cohabitation", {
        p_id: open.data.id,
        p_ended_month: month,
      });

    const declared = await a.client.rpc("declare_cohabitation", {
      p_match_id: matchId,
      p_started_month: month,
    });
    if (declared.error) throw declared.error;
    cohabitationId = (declared.data as { id: string }).id;
    const confirmed = await b.client.rpc("respond_cohabitation", {
      p_id: cohabitationId,
      p_confirm: true,
    });
    if (confirmed.error) throw confirmed.error;
    const ended = await a.client.rpc("end_cohabitation", {
      p_id: cohabitationId,
      p_ended_month: month,
    });
    if (ended.error) throw ended.error;

    const rated = await a.client.rpc("submit_roommate_rating", {
      p_cohabitation_id: cohabitationId,
      p_would_live_again: true,
      p_strengths: ["clean_tidy"],
      p_improvements: ["noise"],
    });
    if (rated.error) throw rated.error;
    ratingId = (rated.data as { id: string }).id;
  });

  afterAll(async () => {
    await a?.client.auth.signOut();
    await b?.client.auth.signOut();
  });

  it("lets the rater read their own hidden rating", async () => {
    const { data, error } = await a.client
      .from("roommate_ratings")
      .select("id, status, rated_id")
      .eq("id", ratingId);
    expect(error).toBeNull();
    expect(data).toEqual([
      { id: ratingId, status: "hidden", rated_id: b.userId },
    ]);
  });

  it("never lets the rated person read rating rows", async () => {
    const { data, error } = await b.client
      .from("roommate_ratings")
      .select("id")
      .eq("cohabitation_id", cohabitationId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("refuses direct writes and the service-only batch summary", async () => {
    const update = await a.client
      .from("roommate_ratings")
      .update({ status: "revealed" })
      .eq("id", ratingId)
      .select("id");
    if (!update.error) expect(update.data).toEqual([]);
    const batch = await b.client.rpc("rating_summaries", {
      p_profile_ids: [b.userId],
    });
    expect(batch.error).not.toBeNull();
  });

  it("returns 'insufficient' for a summary below 3 ratings", async () => {
    const publicSummary = await b.client.rpc("rating_summary", {
      p_profile_id: a.userId,
    });
    expect(publicSummary.error).toBeNull();
    expect(publicSummary.data).toEqual({ state: "insufficient" });
    const own = await a.client.rpc("my_rating_summary");
    expect(own.error).toBeNull();
    expect(own.data).toMatchObject({ state: "insufficient", count: 0 });
  });

  it.skipIf(!adminCredentials())(
    "shows nothing to a third party, even an admin, and refuses their rating",
    async () => {
      const third = await signIn(adminCredentials()!);
      const read = await third.client
        .from("roommate_ratings")
        .select("id")
        .eq("cohabitation_id", cohabitationId);
      expect(read.error).toBeNull();
      expect(read.data).toEqual([]);
      const rate = await third.client.rpc("submit_roommate_rating", {
        p_cohabitation_id: cohabitationId,
        p_would_live_again: false,
        p_strengths: [],
        p_improvements: [],
      });
      expect(rate.error?.code).toBe("42501");
      await third.client.auth.signOut();
    },
  );
});
