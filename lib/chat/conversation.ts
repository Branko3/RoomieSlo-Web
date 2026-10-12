import { mapListing, type Listing } from "../supabase/mappers";
import type { MatchStatus, Row } from "../supabase/types";

type DbError = { code?: string; message?: string; status?: number } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isMatchId(value: string): boolean {
  return UUID.test(value);
}

type MatchRow = {
  id: string;
  user_id_a: string;
  user_id_b: string;
  status: MatchStatus;
};

type PeerRow = {
  id: string;
  display_name: string | null;
  academic_status_verified: boolean;
  faculty: string | null;
};

export type ConversationPeer = {
  id: string;
  name: string;
  verified: boolean;
  faculty: string;
};

export type Conversation =
  | { status: "signed-out" }
  | { status: "not-found" }
  | {
      status: MatchStatus;
      matchId: string;
      peer: ConversationPeer;
      /** I received the request (relevant while it is pending). */
      iAmRecipient: boolean;
      /** The other person's available listings, as context for the chat. */
      peerListings: Listing[];
    };

type Single<T> = PromiseLike<{ data: T | null; error: DbError }>;

/** Structural subset of the Supabase client used by the conversation route. */
export type ConversationClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: DbError;
    }>;
  };
  from(table: "matches"): {
    select: (columns: string) => {
      eq: (
        column: "id",
        value: string,
      ) => { maybeSingle: () => Single<MatchRow> };
    };
  };
  from(table: "profiles"): {
    select: (columns: string) => {
      eq: (
        column: "id",
        value: string,
      ) => { maybeSingle: () => Single<PeerRow> };
    };
  };
  from(table: "listings"): {
    select: (columns: string) => {
      eq: (
        column: "owner_id",
        value: string,
      ) => {
        eq: (
          column: "is_filled",
          value: false,
        ) => {
          order: (
            column: "created_at",
            options: { ascending: boolean },
          ) => {
            limit: (count: number) => PromiseLike<{
              data: Row<"listings">[] | null;
              error: DbError;
            }>;
          };
        };
      };
    };
  };
};

export const PEER_LISTING_LIMIT = 2;

export class ConversationError extends Error {
  constructor(public readonly kind: "offline" | "failed") {
    super(
      kind === "offline"
        ? "Ni povezave. Klepeta ni bilo mogoče odpreti."
        : "Klepeta ni bilo mogoče odpreti.",
    );
    this.name = "ConversationError";
  }
}

/**
 * Resolves `/chats/[matchId]`: the match must exist and include the signed-in
 * user (RLS hides other matches, which then read as "not found"). Returns the
 * other person and a little listing context; messages are loaded separately.
 */
export async function loadConversation(
  client: ConversationClient,
  matchId: string,
): Promise<Conversation> {
  try {
    const { data: userData } = await client.auth.getUser();
    const me = userData.user?.id;
    if (!me) return { status: "signed-out" };
    if (!isMatchId(matchId)) return { status: "not-found" };

    const match = await client
      .from("matches")
      .select("id,user_id_a,user_id_b,status")
      .eq("id", matchId)
      .maybeSingle();
    if (match.error) throw match.error;
    const row = match.data;
    if (!row || (row.user_id_a !== me && row.user_id_b !== me))
      return { status: "not-found" };

    const peerId = row.user_id_a === me ? row.user_id_b : row.user_id_a;
    const [peer, listings] = await Promise.all([
      client
        .from("profiles")
        .select("id,display_name,academic_status_verified,faculty")
        .eq("id", peerId)
        .maybeSingle(),
      client
        .from("listings")
        .select("*")
        .eq("owner_id", peerId)
        .eq("is_filled", false)
        .order("created_at", { ascending: false })
        .limit(PEER_LISTING_LIMIT),
    ]);
    if (peer.error) throw peer.error;
    // Listing context is optional: a failure there must not block the chat.
    const peerListings = listings.error
      ? []
      : (listings.data ?? []).flatMap((listing) => {
          try {
            return [mapListing(listing)];
          } catch {
            return [];
          }
        });

    return {
      status: row.status,
      matchId: row.id,
      iAmRecipient: row.user_id_b === me,
      peer: {
        id: peerId,
        name: peer.data?.display_name?.trim() || "Uporabnik",
        verified: peer.data?.academic_status_verified === true,
        faculty: peer.data?.faculty ?? "",
      },
      peerListings,
    };
  } catch (error) {
    if (error instanceof ConversationError) throw error;
    const message = (error as { message?: string } | null)?.message ?? "";
    throw new ConversationError(
      error instanceof TypeError || /fetch|network/i.test(message)
        ? "offline"
        : "failed",
    );
  }
}

/** Copy for conversations that cannot be used for messaging yet (or anymore). */
export function conversationNotice(conversation: Conversation): string | null {
  switch (conversation.status) {
    case "pending":
      return conversation.iAmRecipient
        ? "Ta oseba ti je poslala zahtevo za ujemanje. Sprejmi jo med klepeti, da odpreš pogovor."
        : "Zahteva še čaka na odgovor. Pogovor se odpre, ko jo druga oseba sprejme.";
    case "rejected":
      return "Zahteva za ujemanje je bila zavrnjena, zato pogovor ni na voljo.";
    default:
      return null;
  }
}
