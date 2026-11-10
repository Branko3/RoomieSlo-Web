/**
 * Self-service export of a user's own data (GDPR access and portability).
 * Read-only: every query is filtered to the signed-in user and RLS allows only
 * what the user may already read. Academic documents are listed by name, not
 * downloaded; deletion is an operator procedure (docs/operations/privacy-procedures.md).
 */

type DbError = { code?: string; message?: string } | null;
type Result = PromiseLike<{ data: unknown; error: DbError }>;

type Filter = {
  eq: (column: string, value: string) => Filter & Result;
  or: (filter: string) => Result;
};

/** Structural subset of the Supabase client used for the export. */
export type ExportClient = {
  auth: {
    getUser: () => Promise<{
      data: {
        user: { id: string; email?: string; created_at?: string } | null;
      };
    }>;
  };
  from: (table: string) => { select: (columns: string) => Filter };
  rpc: (fn: "my_rating_summary") => Result;
  storage: {
    from: (bucket: string) => {
      list: (path: string) => PromiseLike<{
        data: Array<{ name: string }> | null;
        error: DbError;
      }>;
    };
  };
};

/** Owned tables and the column holding the owner's id. */
export const OWNED_TABLES = [
  { table: "profiles", column: "id" },
  { table: "questionnaire_answers", column: "profile_id" },
  { table: "listings", column: "owner_id" },
  { table: "favorites", column: "profile_id" },
  { table: "messages", column: "sender_id" },
  { table: "reports", column: "reporter_id" },
  // Ratings I gave (RLS shows raters only their own rows).
  { table: "roommate_ratings", column: "rater_id" },
] as const;

export const EXPORT_VERSION = 2;

export type DataExport = {
  format: "roomieslo-data-export";
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  account: { id: string; email: string | null; createdAt: string | null };
  data: Record<string, unknown[]>;
  matches: unknown[];
  /** My "Živiva skupaj" declarations, as either participant. */
  cohabitations: unknown[];
  /**
   * The aggregate of ratings I received (`my_rating_summary`). Who gave which
   * rating is never included (GDPR art. 15(4): the rights of others).
   */
  receivedRatings: unknown;
  academicDocuments: string[];
  notes: string[];
};

export type ExportErrorKind = "signed-out" | "offline" | "failed";

/** The page shows `m.privacy.export.errors[kind]`. */
export class ExportError extends Error {
  constructor(public readonly kind: ExportErrorKind) {
    super(`Data export failed: ${kind}`);
    this.name = "ExportError";
  }
}

function toExportError(error: unknown): ExportError {
  if (error instanceof ExportError) return error;
  const message = (error as { message?: string } | null)?.message ?? "";
  return error instanceof TypeError || /fetch|network/i.test(message)
    ? new ExportError("offline")
    : new ExportError("failed");
}

async function rows(result: Result): Promise<unknown[]> {
  const { data, error } = await result;
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/**
 * `notes` are the explanatory notes written into the file, in the interface
 * language (`m.privacy.export.notes`); the file's structure never changes.
 */
export async function exportMyData(
  client: ExportClient,
  notes: readonly string[],
  now: Date = new Date(),
): Promise<DataExport> {
  try {
    const { data: auth } = await client.auth.getUser();
    const user = auth.user;
    if (!user) throw new ExportError("signed-out");

    const data: Record<string, unknown[]> = {};
    for (const { table, column } of OWNED_TABLES) {
      data[table] = await rows(
        client.from(table).select("*").eq(column, user.id),
      );
    }
    const matches = await rows(
      client
        .from("matches")
        .select("*")
        .or(`user_id_a.eq.${user.id},user_id_b.eq.${user.id}`),
    );
    const cohabitations = await rows(
      client
        .from("cohabitations")
        .select("*")
        .or(`user_id_a.eq.${user.id},user_id_b.eq.${user.id}`),
    );
    const received = await client.rpc("my_rating_summary");
    if (received.error) throw received.error;
    const documents = await client.storage.from("vpisnice").list(user.id);
    if (documents.error) throw documents.error;

    return {
      format: "roomieslo-data-export",
      version: EXPORT_VERSION,
      exportedAt: now.toISOString(),
      account: {
        id: user.id,
        email: user.email ?? null,
        createdAt: user.created_at ?? null,
      },
      data,
      matches,
      cohabitations,
      receivedRatings: received.data ?? null,
      academicDocuments: (documents.data ?? []).map((file) => file.name),
      notes: [...notes],
    };
  } catch (error) {
    throw toExportError(error);
  }
}

/** `label` is `m.privacy.export.fileLabel` ("podatki" / "data"). */
export function exportFileName(
  userId: string,
  label: string,
  now: Date = new Date(),
): string {
  return `roomieslo-${label}-${userId.slice(0, 8)}-${now.toISOString().slice(0, 10)}.json`;
}

/** Texts of a request e-mail, from `m.privacy.requests`. */
export type PrivacyRequestCopy = {
  subject: string;
  accountId: string;
  description: string;
};

/** mailto link for requests the app can't perform itself (deletion, correction). */
export function privacyRequestHref(
  contact: string,
  copy: PrivacyRequestCopy,
  userId?: string,
): string {
  const body = userId
    ? `${copy.accountId}: ${userId}\n\n${copy.description}:\n`
    : `${copy.description}:\n`;
  return `mailto:${contact}?subject=${encodeURIComponent(copy.subject)}&body=${encodeURIComponent(body)}`;
}
