import { describe, expect, it, vi } from "vitest";
import {
  dayKey,
  dayLabel,
  groupByDay,
  loadMessages,
  MESSAGE_COLUMNS,
  messageTime,
  MessagesError,
  type MessagesClient,
} from "../lib/chat/messages";
import type { Row } from "../lib/supabase/types";

const ME = "me";

function row(
  id: string,
  sentAt: string,
  extra: Partial<Row<"messages">> = {},
): Row<"messages"> {
  return {
    id,
    match_id: "m1",
    sender_id: ME,
    body: `Sporočilo ${id}`,
    delivery_status: "sent",
    sent_at: sentAt,
    ...extra,
  };
}

function makeClient({
  user = { id: ME } as { id: string } | null,
  result = { data: [], error: null } as
    { data: Row<"messages">[] | null; error: unknown } | Error,
} = {}) {
  const calls: Array<[string, unknown[]]> = [];
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    from: (table: string) => {
      calls.push(["from", [table]]);
      return {
        select: (columns: string) => {
          calls.push(["select", [columns]]);
          return {
            eq: (column: string, value: string) => {
              calls.push(["eq", [column, value]]);
              return {
                order: (column2: string, options: unknown) => {
                  calls.push(["order", [column2, options]]);
                  return result instanceof Error
                    ? Promise.reject(result)
                    : Promise.resolve(result);
                },
              };
            },
          };
        },
      };
    },
  };
  return { client: client as unknown as MessagesClient, calls };
}

describe("loadMessages (Android ChatRepository.getMessages)", () => {
  it("loads the match's messages oldest first", async () => {
    const { client, calls } = makeClient({
      result: {
        data: [
          row("a", "2026-10-11T10:00:00Z"),
          row("b", "2026-10-11T10:05:00Z", { sender_id: "peer" }),
        ],
        error: null,
      },
    });
    const result = await loadMessages(client, "m1");
    expect(result.myUserId).toBe(ME);
    expect(result.messages.map((m) => m.id)).toEqual(["a", "b"]);
    expect(calls).toEqual([
      ["from", ["messages"]],
      ["select", [MESSAGE_COLUMNS]],
      ["eq", ["match_id", "m1"]],
      ["order", ["sent_at", { ascending: true }]],
    ]);
    expect(MESSAGE_COLUMNS).toContain("sent_at");
  });

  it("skips malformed rows and duplicate ids instead of failing", async () => {
    const { client } = makeClient({
      result: {
        data: [
          row("a", "2026-10-11T10:00:00Z"),
          row("bad", "2026-10-11T10:01:00Z", { body: "" }),
          row("wrong", "2026-10-11T10:02:00Z", {
            delivery_status: "lost" as never,
          }),
          row("a", "2026-10-11T10:00:00Z"),
          row("c", "2026-10-11T10:03:00Z"),
        ],
        error: null,
      },
    });
    expect(
      (await loadMessages(client, "m1")).messages.map((m) => m.id),
    ).toEqual(["a", "c"]);
  });

  it("returns an empty conversation", async () => {
    const { client } = makeClient({ result: { data: null, error: null } });
    await expect(loadMessages(client, "m1")).resolves.toEqual({
      myUserId: ME,
      messages: [],
    });
  });

  it("requires a signed-in user", async () => {
    const { client, calls } = makeClient({ user: null });
    await expect(loadMessages(client, "m1")).rejects.toMatchObject({
      kind: "signed-out",
    });
    expect(calls).toEqual([]);
  });

  it("maps failures to Android's safe copy", async () => {
    await expect(
      loadMessages(
        makeClient({ result: new TypeError("Failed to fetch") }).client,
        "m1",
      ),
    ).rejects.toMatchObject({ kind: "offline" });
    const error = await loadMessages(
      makeClient({
        result: { data: null, error: { code: "42501", message: "rls" } },
      }).client,
      "m1",
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MessagesError);
    expect(error).toMatchObject({
      kind: "failed",
      message: "Napaka pri nalaganju sporočil.",
    });
  });
});

describe("day grouping and time formatting (Europe/Ljubljana)", () => {
  const now = new Date("2026-10-11T12:00:00Z");

  it("uses the Ljubljana calendar day, not UTC", () => {
    // 23:30 UTC on 10 Oct is 01:30 on 11 Oct in Ljubljana (CEST).
    expect(dayKey("2026-10-10T23:30:00Z")).toBe("2026-10-11");
    expect(messageTime("2026-10-10T23:30:00Z")).toBe("01:30");
  });

  it("labels today, yesterday, and older days in Slovenian", () => {
    expect(dayLabel("2026-10-11", now)).toBe("Danes");
    expect(dayLabel("2026-10-10", now)).toBe("Včeraj");
    expect(dayLabel("2026-10-05", now).toLowerCase()).toContain("oktober");
  });

  it("groups consecutive messages by day in order", () => {
    const messages = [
      row("a", "2026-10-09T08:00:00Z"),
      row("b", "2026-10-09T09:00:00Z"),
      row("c", "2026-10-10T21:00:00Z"),
      row("d", "2026-10-11T08:00:00Z"),
    ];
    expect(
      groupByDay(messages, now).map((day) => [
        day.key,
        day.label,
        day.messages.map((m) => m.id),
      ]),
    ).toEqual([
      ["2026-10-09", dayLabel("2026-10-09", now), ["a", "b"]],
      ["2026-10-10", "Včeraj", ["c"]],
      ["2026-10-11", "Danes", ["d"]],
    ]);
  });

  it("handles an empty list", () => {
    expect(groupByDay([], now)).toEqual([]);
  });
});
