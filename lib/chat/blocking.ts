type DbError = { code?: string; message?: string; status?: number } | null;

/** Structural subset of the Supabase client used for blocking. */
export type BlockClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: DbError;
    }>;
  };
  from: (table: "blocks") => {
    select: (columns: string) => {
      eq: (
        column: "blocker_id",
        value: string,
      ) => {
        eq: (
          column: "blocked_id",
          value: string,
        ) => {
          maybeSingle: () => PromiseLike<{
            data: { blocked_id: string } | null;
            error: DbError;
          }>;
        };
      };
    };
    insert: (row: {
      blocker_id: string;
      blocked_id: string;
    }) => PromiseLike<{ error: DbError }>;
    delete: () => {
      eq: (
        column: "blocker_id",
        value: string,
      ) => {
        eq: (
          column: "blocked_id",
          value: string,
        ) => PromiseLike<{ error: DbError }>;
      };
    };
  };
};

export const blockCopy = {
  blocked:
    "Blokiral(a) si to osebo. Sporočil si ne moreta pošiljati, dokler je ne odblokiraš.",
  confirm:
    "Blokiraj to osebo? Ne bosta si mogla pošiljati sporočil ali novih zahtev za ujemanje.",
  failed: "Dejanja ni bilo mogoče izvesti. Poskusi znova.",
  offline: "Ni povezave. Poskusi znova.",
  signedOut: "Za to dejanje se moraš prijaviti.",
} as const;

export class BlockError extends Error {
  constructor(
    public readonly kind: "signed-out" | "self" | "offline" | "failed",
    message: string,
  ) {
    super(message);
    this.name = "BlockError";
  }
}

function toBlockError(error: unknown): BlockError {
  if (error instanceof BlockError) return error;
  const message = (error as { message?: string } | null)?.message ?? "";
  return error instanceof TypeError || /fetch|network/i.test(message)
    ? new BlockError("offline", blockCopy.offline)
    : new BlockError("failed", blockCopy.failed);
}

async function me(client: BlockClient): Promise<string> {
  const { data } = await client.auth.getUser();
  if (!data.user) throw new BlockError("signed-out", blockCopy.signedOut);
  return data.user.id;
}

/** Whether I have blocked this person (RLS only shows my own blocks). */
export async function hasBlocked(
  client: BlockClient,
  peerId: string,
): Promise<boolean> {
  try {
    const myId = await me(client);
    const { data, error } = await client
      .from("blocks")
      .select("blocked_id")
      .eq("blocker_id", myId)
      .eq("blocked_id", peerId)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  } catch (error) {
    throw toBlockError(error);
  }
}

/** Blocks a person; blocking someone already blocked (23505) is treated as success. */
export async function blockUser(
  client: BlockClient,
  peerId: string,
): Promise<void> {
  try {
    const myId = await me(client);
    if (myId === peerId) throw new BlockError("self", blockCopy.failed);
    const { error } = await client
      .from("blocks")
      .insert({ blocker_id: myId, blocked_id: peerId });
    if (error && error.code !== "23505") throw error;
  } catch (error) {
    throw toBlockError(error);
  }
}

/** Removes my block on a person; removing a missing block is a no-op. */
export async function unblockUser(
  client: BlockClient,
  peerId: string,
): Promise<void> {
  try {
    const myId = await me(client);
    const { error } = await client
      .from("blocks")
      .delete()
      .eq("blocker_id", myId)
      .eq("blocked_id", peerId);
    if (error) throw error;
  } catch (error) {
    throw toBlockError(error);
  }
}

/** Report route for a user, carrying the chat as context (route added by "Report user/listing"). */
export function reportHref(peerId: string, matchId: string): string {
  return `/report/${encodeURIComponent(peerId)}?from=chat&match=${encodeURIComponent(matchId)}`;
}
