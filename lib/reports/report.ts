type DbError = { code?: string; message?: string; status?: number } | null;

/** Structural subset of the Supabase client used to file a report. */
export type ReportClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: DbError;
    }>;
  };
  rpc: (
    fn: "submit_report",
    args: SubmitReportArgs,
  ) => PromiseLike<{ data: string | null; error: DbError }>;
};

/** Arguments of the `submit_report` RPC; the reporter is always the caller. */
export type SubmitReportArgs = {
  p_reported: string;
  p_reason: string;
  p_description: string;
  /** The conversation to keep as evidence (chat reports only). */
  p_match: string | null;
};

/**
 * Same reasons and default as Android's `ReportUserScreen`. These Slovenian
 * strings are the STORED values (shared with Android): the UI never shows them
 * directly in another language, it maps them to `reports.reasons` labels.
 */
export const REPORT_REASONS = [
  "Neprimerna vsebina",
  "Lažen profil ali oglas",
  "Nadlegovanje",
  "Drugo",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const DEFAULT_REASON: ReportReason = REPORT_REASONS[0];

export type ReportReasonKey = "inappropriate" | "fake" | "harassment" | "other";

/** Label keys in the same order as `REPORT_REASONS`. */
const REASON_KEYS: readonly ReportReasonKey[] = [
  "inappropriate",
  "fake",
  "harassment",
  "other",
];

/**
 * The `reports.reasons` key of a stored reason; null for a value this version
 * does not know (an older or newer client), which is then shown as stored.
 */
export function reasonKey(stored: string): ReportReasonKey | null {
  const index = (REPORT_REASONS as readonly string[]).indexOf(stored);
  return index < 0 ? null : REASON_KEYS[index];
}

export const DESCRIPTION_MAX = 1000;

export type ReportErrorKind =
  | "invalid-user"
  | "invalid-reason"
  | "too-long"
  | "self"
  | "signed-out"
  | "missing-user"
  | "offline"
  | "failed";

/** The kind is also the key of its text in `reports.errors`. */
export class ReportError extends Error {
  constructor(public readonly kind: ReportErrorKind) {
    super(kind);
    this.name = "ReportError";
  }
}

/**
 * Where the report was started. A chat report links its conversation (kept as
 * evidence); a listing report keeps the listing as a note for admins.
 */
export type ReportContext =
  | { kind: "chat"; matchId: string }
  | { kind: "listing"; listingId: string }
  | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUserId(value: string): boolean {
  return UUID.test(value);
}

type Params = { get: (name: string) => string | null };

/** Reads `?from=chat&match=…` or `?from=listing&listing=…`; anything else is no context. */
export function parseReportContext(params: Params): ReportContext {
  const from = params.get("from");
  const matchId = params.get("match")?.trim();
  const listingId = params.get("listing")?.trim();
  if (from === "chat" && matchId) return { kind: "chat", matchId };
  if (from === "listing" && listingId) return { kind: "listing", listingId };
  return null;
}

/**
 * Stored with the report for the admins; stays Slovenian whatever the
 * interface language, like the reason (shared with Android and the dashboard).
 */
export function contextNote(context: ReportContext): string {
  return context?.kind === "listing"
    ? `[Prijava iz oglasa: ${context.listingId}]`
    : "";
}

/** Where "Back" leads after (or instead of) reporting. */
export function backHref(context: ReportContext): string {
  if (context?.kind === "chat")
    return `/chats/${encodeURIComponent(context.matchId)}`;
  if (context?.kind === "listing")
    return `/listings/${encodeURIComponent(context.listingId)}`;
  return "/";
}

export function listingReportHref(ownerId: string, listingId: string): string {
  return `/report/${encodeURIComponent(ownerId)}?from=listing&listing=${encodeURIComponent(listingId)}`;
}

export type ReportDraft = {
  reportedId: string;
  reason: string;
  description: string;
  context: ReportContext;
};

/** Client-side validation; returns the first problem or null. */
export function validateReport(draft: ReportDraft): ReportError | null {
  if (!isUserId(draft.reportedId)) return new ReportError("invalid-user");
  if (!(REPORT_REASONS as readonly string[]).includes(draft.reason))
    return new ReportError("invalid-reason");
  if (draft.description.trim().length > DESCRIPTION_MAX)
    return new ReportError("too-long");
  return null;
}

export function buildReport(draft: ReportDraft): SubmitReportArgs {
  return {
    p_reported: draft.reportedId,
    p_reason: draft.reason,
    p_match:
      draft.context?.kind === "chat" && isUserId(draft.context.matchId)
        ? draft.context.matchId
        : null,
    p_description: [draft.description.trim(), contextNote(draft.context)]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function toReportError(error: unknown): ReportError {
  if (error instanceof ReportError) return error;
  const e = (error ?? {}) as { code?: string; message?: string };
  if (e.code === "23503") return new ReportError("missing-user");
  if (error instanceof TypeError || /fetch|network/i.test(e.message ?? ""))
    return new ReportError("offline");
  return new ReportError("failed");
}

/**
 * Validates and files a report through `submit_report`, which records the
 * caller as the reporter and, for a chat report, snapshots the conversation.
 */
export async function submitReport(
  client: ReportClient,
  draft: ReportDraft,
): Promise<void> {
  const invalid = validateReport(draft);
  if (invalid) throw invalid;
  try {
    const { data } = await client.auth.getUser();
    if (!data.user) throw new ReportError("signed-out");
    if (data.user.id === draft.reportedId) throw new ReportError("self");
    const { error } = await client.rpc("submit_report", buildReport(draft));
    if (error) throw error;
  } catch (error) {
    throw toReportError(error);
  }
}
