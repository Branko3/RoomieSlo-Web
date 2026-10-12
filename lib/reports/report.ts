type DbError = { code?: string; message?: string; status?: number } | null;

/** Structural subset of the Supabase client used to file a report. */
export type ReportClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: DbError;
    }>;
  };
  from: (table: "reports") => {
    insert: (row: NewReport) => PromiseLike<{ error: DbError }>;
  };
};

export type NewReport = {
  reporter_id: string;
  reported_id: string;
  reason: string;
  description: string;
};

/** Same reasons and default as Android's `ReportUserScreen`. */
export const REPORT_REASONS = [
  "Neprimerna vsebina",
  "Lažen profil ali oglas",
  "Nadlegovanje",
  "Drugo",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const DEFAULT_REASON: ReportReason = REPORT_REASONS[0];

export const DESCRIPTION_MAX = 1000;

export const reportCopy = {
  invalidUser: "Neveljaven uporabnik.",
  invalidReason: "Izberi razlog prijave.",
  tooLong: `Opis je lahko dolg največ ${DESCRIPTION_MAX} znakov.`,
  self: "Sebe ne moreš prijaviti.",
  signedOut: "Za prijavo se moraš prijaviti v svoj račun.",
  missingUser: "Tega uporabnika ni več mogoče prijaviti.",
  offline: "Ni povezave. Preveri internetno povezavo.",
  failed: "Prijava ni bila poslana.",
  sent: "Hvala. Prijava je poslana in jo bo pregledal administrator.",
} as const;

export type ReportErrorKind =
  | "invalid-user"
  | "invalid-reason"
  | "too-long"
  | "self"
  | "signed-out"
  | "missing-user"
  | "offline"
  | "failed";

export class ReportError extends Error {
  constructor(
    public readonly kind: ReportErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "ReportError";
  }
}

/** Where the report was started; stored as a note so admins see the context. */
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

export function contextNote(context: ReportContext): string {
  if (!context) return "";
  return context.kind === "chat"
    ? `[Prijava iz klepeta: ${context.matchId}]`
    : `[Prijava iz oglasa: ${context.listingId}]`;
}

/** Where "Nazaj" leads after (or instead of) reporting. */
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
  if (!isUserId(draft.reportedId))
    return new ReportError("invalid-user", reportCopy.invalidUser);
  if (!(REPORT_REASONS as readonly string[]).includes(draft.reason))
    return new ReportError("invalid-reason", reportCopy.invalidReason);
  if (draft.description.trim().length > DESCRIPTION_MAX)
    return new ReportError("too-long", reportCopy.tooLong);
  return null;
}

export function buildReport(reporterId: string, draft: ReportDraft): NewReport {
  return {
    reporter_id: reporterId,
    reported_id: draft.reportedId,
    reason: draft.reason,
    description: [draft.description.trim(), contextNote(draft.context)]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function toReportError(error: unknown): ReportError {
  if (error instanceof ReportError) return error;
  const e = (error ?? {}) as { code?: string; message?: string };
  if (e.code === "23503")
    return new ReportError("missing-user", reportCopy.missingUser);
  if (error instanceof TypeError || /fetch|network/i.test(e.message ?? ""))
    return new ReportError("offline", reportCopy.offline);
  return new ReportError("failed", reportCopy.failed);
}

/** Validates and inserts a report as the current user (RLS: `reporter_id = auth.uid()`). */
export async function submitReport(
  client: ReportClient,
  draft: ReportDraft,
): Promise<void> {
  const invalid = validateReport(draft);
  if (invalid) throw invalid;
  try {
    const { data } = await client.auth.getUser();
    if (!data.user) throw new ReportError("signed-out", reportCopy.signedOut);
    if (data.user.id === draft.reportedId)
      throw new ReportError("self", reportCopy.self);
    const { error } = await client
      .from("reports")
      .insert(buildReport(data.user.id, draft));
    if (error) throw error;
  } catch (error) {
    throw toReportError(error);
  }
}
