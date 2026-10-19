import { describe, expect, it } from "vitest";
import {
  ACCEPTANCE_POLL_MS,
  chatHref,
  chatLinkFor,
  shouldWatchForAcceptance,
} from "../lib/matching/chat-link";
import type { RequestState } from "../lib/matching/send-request";

describe("chatHref", () => {
  it("links to the conversation of the match", () => {
    expect(chatHref("m1")).toBe("/chats/m1");
  });

  it("encodes unsafe characters", () => {
    expect(chatHref("a/b?c")).toBe("/chats/a%2Fb%3Fc");
  });
});

describe("chatLinkFor", () => {
  it("opens the conversation directly once the request is accepted", () => {
    expect(chatLinkFor({ id: "m1", status: "accepted" })).toEqual({
      href: "/chats/m1",
      label: "Odpri klepet",
    });
  });

  it.each([
    [{ id: "m1", status: "pending" as const }],
    [{ id: "m1", status: "rejected" as const }],
    [null],
  ])("leads to the request list for %o", (request) => {
    expect(chatLinkFor(request)).toEqual({
      href: "/chats",
      label: "Odpri klepete",
    });
  });
});

describe("shouldWatchForAcceptance", () => {
  const exists = (
    status: "pending" | "accepted" | "rejected",
    sentByMe: boolean,
  ): RequestState => ({
    kind: "exists",
    request: { id: "m1", status, sentByMe },
  });

  it("watches only my own pending request", () => {
    expect(shouldWatchForAcceptance(exists("pending", true))).toBe(true);
  });

  it.each([
    ["their pending request", exists("pending", false)],
    ["an accepted request", exists("accepted", true)],
    ["a rejected request", exists("rejected", true)],
    ["no request", { kind: "none" } as RequestState],
    ["my own listing", { kind: "own-listing" } as RequestState],
    ["a signed-out visitor", { kind: "signed-out" } as RequestState],
    ["unknown state", undefined],
  ])("does not watch %s", (_label, state) => {
    expect(shouldWatchForAcceptance(state)).toBe(false);
  });

  it("re-checks at a modest interval", () => {
    expect(ACCEPTANCE_POLL_MS).toBe(30_000);
  });
});
