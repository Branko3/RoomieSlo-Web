import type { ReportStatus } from "../supabase/types";

type DbError = { code?: string; message?: string; status?: number } | null;

/** A report as the dashboard shows it. The reporter is not selected (same as Android's `ReportDto`). */
export type AdminReport = {
  id: string;
  reported_id: string;
  reason: string;
  description: string;
  status: ReportStatus;
  created_at: string;
  /** The conversation the report was filed from, if any. */
  match_id: string | null;
  /** The reported account was deleted (its profile is a tombstone). */
  reported_deleted: boolean;
};

/** A report row as selected, with the reported profile embedded. */
type AdminReportRow = Omit<AdminReport, "match_id" | "reported_deleted"> & {
  match_id?: string | null;
  reported?: { deleted_at: string | null } | null;
};

/** One message of a reported conversation, as `admin_report_conversation` returns it. */
export type ConversationRow = {
  message_id: string;
  sender_role: "reporter" | "reported";
  body: string;
  sent_at: string;
  /** "snapshot": evidence saved with the report; "live": the current conversation. */
  source: "snapshot" | "live";
};

export type TranscriptEntry = {
  id: string;
  role: ConversationRow["sender_role"];
  label: "Prijavitelj" | "Prijavljeni";
  body: string;
  sentAt: string;
};

/** Structural subset of the Supabase client used by the dashboard. */
export type AdminClient = {
  rpc: (
    fn: "admin_report_conversation",
    args: { p_report_id: string },
  ) => PromiseLike<{ data: ConversationRow[] | null; error: DbError }>;
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: DbError;
    }>;
  };
  from: ((table: "admins") => {
    select: (columns: "user_id") => {
      eq: (
        column: "user_id",
        value: string,
      ) => {
        maybeSingle: () => PromiseLike<{
          data: { user_id: string } | null;
          error: DbError;
        }>;
      };
    };
  }) &
    ((table: "reports") => {
      select: (columns: string) => {
        order: (
          column: "created_at",
          options: { ascending: boolean },
        ) => {
          limit: (
            count: number,
          ) => PromiseLike<{ data: AdminReportRow[] | null; error: DbError }>;
        };
      };
      update: (values: { status: ReportStatus }) => {
        eq: (
          column: "id",
          value: string,
        ) => {
          select: (columns: "id,status") => PromiseLike<{
            data: { id: string; status: ReportStatus }[] | null;
            error: DbError;
          }>;
        };
      };
    });
};

// Two foreign keys point at profiles, so the embed names the column.
export const REPORT_COLUMNS =
  "id,reported_id,reason,description,status,created_at,match_id,reported:profiles!reported_id(deleted_at)";
export const REPORT_LIMIT = 200;

export const REPORT_STATUSES: readonly ReportStatus[] = [
  "open",
  "reviewed",
  "dismissed",
];

export const statusLabel: Record<ReportStatus, string> = {
  open: "Odprto",
  reviewed: "Rešeno",
  dismissed: "Zavrnjeno",
};

/**
 * Who was reported, as the dashboard shows it. Deleted accounts only get a
 * label: their identity is kept in a record that only the database owner can read.
 */
export function reportedLabel(report: AdminReport): string {
  return report.reported_deleted
    ? "Izbrisan uporabnik (identiteta hranjena za varnostne namene; za razkritje kontaktiraj upravljavca baze)"
    : `uporabnik ${report.reported_id}`;
}

export const adminCopy = {
  notAdmin: "Nimaš administratorskih pravic.",
  signedOut: "Za administratorsko ploščo se moraš prijaviti.",
  empty: "Ni prijav.",
  emptyFilter: "Ni prijav s tem statusom.",
  loadFailed: "Napaka pri nalaganju prijav.",
  updateFailed: "Statusa prijave ni bilo mogoče spremeniti.",
  conversationLogged:
    "Vsak ogled pogovora se zabeleži (administrator, prijava, čas).",
  conversationEmpty: "Pogovor ni več na voljo.",
  conversationFailed: "Pogovora ni bilo mogoče naložiti.",
  offline: "Ni povezave. Preveri internetno povezavo.",
} as const;

export type AdminErrorKind =
  "signed-out" | "not-admin" | "offline" | "load-failed" | "update-failed";

/** Errors carry only safe copy; database messages and ids are never shown or logged. */
export class AdminError extends Error {
  constructor(
    public readonly kind: AdminErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "AdminError";
  }
}

function toAdminError(
  error: unknown,
  fallback: "load-failed" | "update-failed",
): AdminError {
  if (error instanceof AdminError) return error;
  const e = (error ?? {}) as { code?: string; message?: string };
  if (error instanceof TypeError || /fetch|network/i.test(e.message ?? ""))
    return new AdminError("offline", adminCopy.offline);
  if (e.code === "42501")
    return new AdminError("not-admin", adminCopy.notAdmin);
  return fallback === "load-failed"
    ? new AdminError("load-failed", adminCopy.loadFailed)
    : new AdminError("update-failed", adminCopy.updateFailed);
}

/** Whether the current user has a row in `admins` (RLS `admins_self_select` shows only their own). */
export async function isAdmin(client: AdminClient): Promise<boolean> {
  try {
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) throw new AdminError("signed-out", adminCopy.signedOut);
    const { data, error } = await client
      .from("admins")
      .select("user_id")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  } catch (error) {
    throw toAdminError(error, "load-failed");
  }
}

/** Newest reports first. RLS `reports_admin_select` returns nothing to non-admins. */
export async function listReports(client: AdminClient): Promise<AdminReport[]> {
  try {
    const { data, error } = await client
      .from("reports")
      .select(REPORT_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(REPORT_LIMIT);
    if (error) throw error;
    return (data ?? []).map(({ reported, ...row }) => ({
      ...row,
      match_id: row.match_id ?? null,
      reported_deleted: Boolean(reported?.deleted_at),
    }));
  } catch (error) {
    throw toAdminError(error, "load-failed");
  }
}

/**
 * Sets a report's status. RLS silently skips rows a non-admin may not update,
 * so an empty result is treated as "not authorized" rather than success.
 */
export async function setReportStatus(
  client: AdminClient,
  reportId: string,
  status: ReportStatus,
): Promise<ReportStatus> {
  try {
    const { data, error } = await client
      .from("reports")
      .update({ status })
      .eq("id", reportId)
      .select("id,status");
    if (error) throw error;
    const row = data?.[0];
    if (!row) throw new AdminError("not-admin", adminCopy.updateFailed);
    return row.status;
  } catch (error) {
    throw toAdminError(error, "update-failed");
  }
}

/**
 * Reads the conversation linked to a report through the audited
 * `admin_report_conversation` function (the only admin path to messages).
 * Every call is recorded server-side, so call it only on an explicit request.
 */
export async function loadReportConversation(
  client: AdminClient,
  reportId: string,
): Promise<TranscriptEntry[]> {
  try {
    const { data, error } = await client.rpc("admin_report_conversation", {
      p_report_id: reportId,
    });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.message_id,
      role: row.sender_role,
      label: row.sender_role === "reporter" ? "Prijavitelj" : "Prijavljeni",
      body: row.body,
      sentAt: row.sent_at,
    }));
  } catch (error) {
    const mapped = toAdminError(error, "load-failed");
    throw mapped.kind === "load-failed"
      ? new AdminError("load-failed", adminCopy.conversationFailed)
      : mapped;
  }
}

/** Android's one-tap toggle: open ↔ reviewed; a dismissed report reopens. */
export function nextStatus(status: ReportStatus): ReportStatus {
  return status === "open" ? "reviewed" : "open";
}

export function replaceStatus(
  reports: AdminReport[],
  id: string,
  status: ReportStatus,
): AdminReport[] {
  return reports.map((report) =>
    report.id === id ? { ...report, status } : report,
  );
}

export type StatusFilter = ReportStatus | "all";

export function filterReports(
  reports: AdminReport[],
  filter: StatusFilter,
): AdminReport[] {
  return filter === "all"
    ? reports
    : reports.filter((report) => report.status === filter);
}

export function countByStatus(
  reports: AdminReport[],
): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = {
    all: reports.length,
    open: 0,
    reviewed: 0,
    dismissed: 0,
  };
  for (const report of reports) counts[report.status] += 1;
  return counts;
}
