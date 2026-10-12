import type { ExistingRequest, RequestState } from "./send-request";

/** How often a waiting requester re-checks whether the request was accepted. */
export const ACCEPTANCE_POLL_MS = 30_000;

/** Route of the conversation that belongs to an accepted match. */
export function chatHref(matchId: string): string {
  return `/chats/${encodeURIComponent(matchId)}`;
}

/**
 * Where the "open chat" link next to a request should go. Only an accepted
 * request has a conversation (Android opens the chat from an accepted match);
 * pending and rejected requests lead to the request list on `/chats`.
 */
export function chatLinkFor(
  request: Pick<ExistingRequest, "id" | "status"> | null,
): {
  href: string;
  label: string;
} {
  if (request?.status === "accepted") {
    return { href: chatHref(request.id), label: "Odpri klepet →" };
  }
  return { href: "/chats", label: "Odpri klepete →" };
}

/**
 * A request I sent that is still pending can be accepted at any moment, so its
 * state is re-checked periodically (and on window focus) to reveal the chat link
 * without a reload. Nothing else changes on its own.
 */
export function shouldWatchForAcceptance(
  state: RequestState | undefined,
): boolean {
  return (
    state?.kind === "exists" &&
    state.request.status === "pending" &&
    state.request.sentByMe
  );
}
