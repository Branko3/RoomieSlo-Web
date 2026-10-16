import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminCredentials,
  ensureAcceptedMatch,
  isRlsRefusal,
  signIn,
  signInA,
  signInB,
  skip,
  type Session,
} from "./clients";

/** Current month (first day) in Slovenian time, as `cohabitation_current_month()` computes it. */
function currentMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Ljubljana",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-01`;
}

type Row = { id: string; status: string; initiated_by: string };

/**
 * Cohabitation RLS and RPC checks with users A and B and, when configured, the
 * admin account as an unrelated third party. Cohabitations have no delete
 * policy, so each run leaves an `ended` row behind; ending (rather than
 * declining) keeps A out of the 30-day cooldown, so the suite can run again.
 */
describe.skipIf(skip)("cohabitation RLS", () => {
  let a: Session;
  let b: Session;
  let matchId: string;
  let declared: Row;
  const month = currentMonth();

  async function openRow(): Promise<Row | null> {
    const { data, error } = await a.client
      .from("cohabitations")
      .select("id, status, initiated_by")
      .eq("match_id", matchId)
      .in("status", ["pending", "active"])
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /** Brings an open declaration left by an earlier run to `ended`. */
  async function closeOpen() {
    const open = await openRow();
    if (!open) return;
    if (open.status === "pending") {
      const responder = open.initiated_by === a.userId ? b : a;
      const confirmed = await responder.client.rpc("respond_cohabitation", {
        p_id: open.id,
        p_confirm: true,
      });
      if (confirmed.error) throw confirmed.error;
    }
    const ended = await a.client.rpc("end_cohabitation", {
      p_id: open.id,
      p_ended_month: month,
    });
    if (ended.error) throw ended.error;
  }

  beforeAll(async () => {
    a = await signInA();
    b = await signInB();
    matchId = (await ensureAcceptedMatch(a, b)).id;
    await closeOpen();
    const { data, error } = await a.client.rpc("declare_cohabitation", {
      p_match_id: matchId,
      p_started_month: month,
    });
    if (error) throw error;
    declared = data as Row;
  });

  afterAll(async () => {
    if (a && b && matchId) await closeOpen().catch(() => undefined);
    await a?.client.auth.signOut();
    await b?.client.auth.signOut();
  });

  it("lets both participants read the declaration", async () => {
    expect(declared).toMatchObject({
      status: "pending",
      initiated_by: a.userId,
    });
    for (const session of [a, b]) {
      const { data, error } = await session.client
        .from("cohabitations")
        .select("id, status")
        .eq("id", declared.id);
      expect(error).toBeNull();
      expect(data).toEqual([{ id: declared.id, status: "pending" }]);
    }
  });

  it("does not let the initiator confirm their own declaration", async () => {
    const { error } = await a.client.rpc("respond_cohabitation", {
      p_id: declared.id,
      p_confirm: true,
    });
    expect(error?.code).toBe("42501");
    expect((await openRow())?.status).toBe("pending");
  });

  it("refuses a second open declaration for the same match", async () => {
    const { error } = await b.client.rpc("declare_cohabitation", {
      p_match_id: matchId,
      p_started_month: month,
    });
    expect(error?.code).toBe("23505");
  });

  it("refuses direct writes to the table", async () => {
    const insert = await a.client.from("cohabitations").insert({
      match_id: matchId,
      user_id_a: a.userId,
      user_id_b: b.userId,
      initiated_by: a.userId,
      status: "active",
      started_month: month,
    });
    expect(isRlsRefusal(insert.error)).toBe(true);

    const update = await a.client
      .from("cohabitations")
      .update({ status: "active" })
      .eq("id", declared.id)
      .select("id");
    if (update.error) expect(isRlsRefusal(update.error)).toBe(true);
    else expect(update.data).toEqual([]);
    expect((await openRow())?.status).toBe("pending");

    const remove = await a.client
      .from("cohabitations")
      .delete()
      .eq("id", declared.id)
      .select("id");
    if (!remove.error) expect(remove.data).toEqual([]);
    expect(await openRow()).not.toBeNull();
  });

  it.skipIf(!adminCredentials())(
    "shows nothing to a third party, even an admin, and refuses their answer",
    async () => {
      const third = await signIn(adminCredentials()!);
      const read = await third.client
        .from("cohabitations")
        .select("id")
        .eq("match_id", matchId);
      expect(read.error).toBeNull();
      expect(read.data).toEqual([]);

      const respond = await third.client.rpc("respond_cohabitation", {
        p_id: declared.id,
        p_confirm: true,
      });
      expect(respond.error?.code).toBe("42501");

      const declare = await third.client.rpc("declare_cohabitation", {
        p_match_id: matchId,
        p_started_month: month,
      });
      expect(declare.error?.code).toBe("42501");
      await third.client.auth.signOut();
    },
  );

  it("lets the other person confirm, and either person end it", async () => {
    const confirmed = await b.client.rpc("respond_cohabitation", {
      p_id: declared.id,
      p_confirm: true,
    });
    expect(confirmed.error).toBeNull();
    expect(confirmed.data).toMatchObject({ status: "active", version: 2 });

    const ended = await b.client.rpc("end_cohabitation", {
      p_id: declared.id,
      p_ended_month: month,
    });
    expect(ended.error).toBeNull();
    expect(ended.data).toMatchObject({
      status: "ended",
      ended_month: month,
      version: 3,
    });
  });
});
