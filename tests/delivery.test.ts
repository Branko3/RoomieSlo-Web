import { describe, expect, it, vi } from "vitest";
import {
  applyReadLocally,
  deliveryLabel,
  isAdvance,
  markAcceptedDelivered,
  markDelivered,
  markRead,
  needsReadMarker,
  type DeliveryClient,
} from "../lib/chat/delivery";

const ME = "me";
const PEER = "peer";

function makeClient({
  user = { id: ME } as { id: string } | null,
  result = { error: null } as { error: unknown } | Error,
} = {}) {
  const calls: Array<[string, unknown[]]> = [];
  const filter = {
    eq: (column: string, value: string) => {
      calls.push(["eq", [column, value]]);
      return filter;
    },
    neq: (column: string, value: string) => {
      calls.push(["neq", [column, value]]);
      return filter;
    },
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      (result instanceof Error
        ? Promise.reject(result)
        : Promise.resolve(result)
      ).then(resolve, reject),
  };
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    from: (table: string) => {
      calls.push(["from", [table]]);
      return {
        update: (values: unknown) => {
          calls.push(["update", [values]]);
          return filter;
        },
      };
    },
  };
  return { client: client as unknown as DeliveryClient, calls };
}

describe("deliveryLabel (Android besediloStanja)", () => {
  it.each([
    ["sent", "Poslano"],
    ["delivered", "Dostavljeno"],
    ["read", "Prebrano"],
  ] as const)("%s → %s", (status, label) => {
    expect(deliveryLabel(status)).toBe(label);
  });
});

describe("isAdvance", () => {
  it("only moves forward", () => {
    expect(isAdvance("sent", "delivered")).toBe(true);
    expect(isAdvance("delivered", "read")).toBe(true);
    expect(isAdvance("sent", "read")).toBe(true);
    expect(isAdvance("read", "delivered")).toBe(false);
    expect(isAdvance("delivered", "delivered")).toBe(false);
  });
});

describe("markRead (Android ChatRepository.markRead)", () => {
  it("marks only the other person's unread messages in the match as read", async () => {
    const { client, calls } = makeClient();
    await expect(markRead(client, "m1")).resolves.toBe(true);
    expect(calls).toEqual([
      ["from", ["messages"]],
      ["update", [{ delivery_status: "read" }]],
      ["eq", ["match_id", "m1"]],
      ["neq", ["sender_id", ME]],
      ["neq", ["delivery_status", "read"]],
    ]);
  });

  it("does nothing without a session and swallows failures", async () => {
    const signedOut = makeClient({ user: null });
    await expect(markRead(signedOut.client, "m1")).resolves.toBe(false);
    expect(signedOut.calls).toEqual([]);
    await expect(
      markRead(
        makeClient({ result: { error: { code: "42501" } } }).client,
        "m1",
      ),
    ).resolves.toBe(false);
    await expect(
      markRead(
        makeClient({ result: new TypeError("Failed to fetch") }).client,
        "m1",
      ),
    ).resolves.toBe(false);
  });
});

describe("markDelivered (Android ChatRepository.markDelivered)", () => {
  it("moves only the other person's sent messages to delivered", async () => {
    const { client, calls } = makeClient();
    await expect(markDelivered(client, "m1")).resolves.toBe(true);
    expect(calls).toEqual([
      ["from", ["messages"]],
      ["update", [{ delivery_status: "delivered" }]],
      ["eq", ["match_id", "m1"]],
      ["neq", ["sender_id", ME]],
      ["eq", ["delivery_status", "sent"]],
    ]);
  });

  it("swallows failures", async () => {
    await expect(
      markDelivered(makeClient({ result: new TypeError("x") }).client, "m1"),
    ).resolves.toBe(false);
    await expect(
      markDelivered(makeClient({ user: null }).client, "m1"),
    ).resolves.toBe(false);
  });
});

describe("markAcceptedDelivered (Android ChatListViewModel.load)", () => {
  const rows = [
    { match: { id: "accepted-1", status: "accepted" } },
    { match: { id: "pending-1", status: "pending" } },
    { match: { id: "rejected-1", status: "rejected" } },
    { match: { id: "accepted-2", status: "accepted" } },
  ];

  it("marks only accepted matches delivered", async () => {
    const { client, calls } = makeClient();
    await expect(markAcceptedDelivered(client, rows)).resolves.toBe(2);
    const matchIds = calls
      .filter(([name, args]) => name === "eq" && args[0] === "match_id")
      .map(([, args]) => args[1]);
    expect(matchIds.sort()).toEqual(["accepted-1", "accepted-2"]);
  });

  it("does nothing without accepted matches", async () => {
    const { client, calls } = makeClient();
    await expect(markAcceptedDelivered(client, rows.slice(1, 3))).resolves.toBe(
      0,
    );
    expect(calls).toEqual([]);
  });

  it("never throws when the updates fail", async () => {
    await expect(
      markAcceptedDelivered(
        makeClient({ result: new TypeError("Failed to fetch") }).client,
        rows,
      ),
    ).resolves.toBe(0);
  });
});

describe("local read state", () => {
  const history = {
    myUserId: ME,
    messages: [
      { id: "1", sender_id: PEER, delivery_status: "sent" as const },
      { id: "2", sender_id: ME, delivery_status: "sent" as const },
      { id: "3", sender_id: PEER, delivery_status: "delivered" as const },
      { id: "4", sender_id: PEER, delivery_status: "read" as const },
    ],
  };

  it("detects unread messages from the other person", () => {
    expect(needsReadMarker(history.messages, ME)).toBe(true);
    expect(
      needsReadMarker(
        [
          { sender_id: ME, delivery_status: "sent" },
          { sender_id: PEER, delivery_status: "read" },
        ],
        ME,
      ),
    ).toBe(false);
  });

  it("marks only the other person's messages as read and never touches mine", () => {
    const next = applyReadLocally(history, ME);
    expect(next?.messages.map((m) => [m.id, m.delivery_status])).toEqual([
      ["1", "read"],
      ["2", "sent"],
      ["3", "read"],
      ["4", "read"],
    ]);
  });

  it("returns the same object when nothing changes", () => {
    const allRead = {
      myUserId: ME,
      messages: [
        { id: "4", sender_id: PEER, delivery_status: "read" as const },
      ],
    };
    expect(applyReadLocally(allRead, ME)).toBe(allRead);
    expect(applyReadLocally(undefined, ME)).toBeUndefined();
  });
});
