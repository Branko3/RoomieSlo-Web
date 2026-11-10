"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import {
  AdminError,
  countByStatus,
  filterReports,
  isAdmin,
  listReports,
  nextStatus,
  REPORT_LIMIT,
  replaceStatus,
  setReportStatus,
  type AdminClient,
  type AdminErrorCode,
  type AdminReport,
  type StatusFilter,
} from "../../../lib/admin/reports";
import { AdminReportConversation } from "../../../components/admin-report-conversation";
import { useI18n } from "../../../lib/i18n/provider";
import { reasonKey } from "../../../lib/reports/report";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import type { ReportStatus } from "../../../lib/supabase/types";

type DashboardData = { admin: false } | { admin: true; reports: AdminReport[] };

const queryKey = ["admin", "reports"] as const;

function client() {
  return createSupabaseBrowserClient() as unknown as AdminClient;
}

/** Only the code of a known error is shown; anything else gets the fallback. */
function safeCode(error: unknown, fallback: AdminErrorCode): AdminErrorCode {
  return error instanceof AdminError ? error.code : fallback;
}

export default function AdminReportsPage() {
  const { m, format, formatters } = useI18n();
  const copy = m.admin;
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("open");
  const query = useQuery<DashboardData>({
    queryKey,
    retry: false,
    queryFn: async () => {
      const c = client();
      if (!(await isAdmin(c))) return { admin: false };
      return { admin: true, reports: await listReports(c) };
    },
  });
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReportStatus }) =>
      setReportStatus(client(), id, status),
    onSuccess: (status, { id }) => {
      const current = queryClient.getQueryData<DashboardData>(queryKey);
      if (!current?.admin) return;
      const next: DashboardData = {
        admin: true,
        reports: replaceStatus(current.reports, id, status),
      };
      queryClient.setQueryData(queryKey, next);
    },
  });

  if (query.isPending) {
    return (
      <div className="page-state">
        <p>{copy.loading}</p>
      </div>
    );
  }

  if (query.isError) {
    const signedOut =
      query.error instanceof AdminError && query.error.kind === "signed-out";
    return (
      <div className="page-state" role="alert">
        <h1>{copy.title}</h1>
        <p>{copy.errors[safeCode(query.error, "loadFailed")]}</p>
        {signedOut ? (
          <Link className="button" href="/login">
            {copy.signIn}
          </Link>
        ) : (
          <button className="button" onClick={() => query.refetch()}>
            {m.common.actions.retry}
          </button>
        )}
      </div>
    );
  }

  if (!query.data.admin) {
    return (
      <div className="page-state" role="alert">
        <h1>{copy.title}</h1>
        <p>{copy.errors.notAdmin}</p>
        <Link className="button" href="/">
          {copy.home}
        </Link>
      </div>
    );
  }

  const reports = query.data.reports;
  // Reasons are stored in Slovenian; unknown values are shown as stored.
  const reasonLabel = (stored: string) => {
    const key = reasonKey(stored);
    return key ? m.reports.reasons[key] : stored;
  };
  const counts = countByStatus(reports);
  const visible = filterReports(reports, filter);
  const pendingId = mutation.isPending ? mutation.variables?.id : undefined;

  return (
    <div className="content-wrap admin-page">
      <h1>{copy.title}</h1>
      <p className="muted">{copy.intro}</p>
      <div className="admin-filters" role="group" aria-label={copy.filters}>
        {(["open", "reviewed", "dismissed", "all"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`chip admin-filter${filter === value ? " is-active" : ""}`}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {format(copy.filterCount, {
              label: value === "all" ? copy.all : copy.status[value],
              count: counts[value],
            })}
          </button>
        ))}
      </div>
      {mutation.isError && (
        <p className="admin-error" role="alert">
          {copy.errors[safeCode(mutation.error, "updateFailed")]}
        </p>
      )}
      {visible.length === 0 ? (
        <p className="muted">
          {reports.length === 0 ? copy.empty : copy.emptyFilter}
        </p>
      ) : (
        <ul className="admin-reports">
          {visible.map((report) => (
            <li key={report.id} className="admin-report">
              <div className="admin-report-body">
                <div className="admin-report-head">
                  <b>{reasonLabel(report.reason)}</b>
                  <span
                    className={`admin-status admin-status-${report.status}`}
                  >
                    {copy.status[report.status]}
                  </span>
                </div>
                {report.description && (
                  <p className="admin-report-description">
                    {report.description}
                  </p>
                )}
                <small className="muted">
                  {format(copy.reportedLine, {
                    date: formatters.dateTimeMedium(report.created_at),
                    who: report.reported_deleted
                      ? copy.reportedDeleted
                      : format(copy.reportedUser, { id: report.reported_id }),
                  })}
                </small>
                {report.match_id && (
                  <AdminReportConversation reportId={report.id} />
                )}
              </div>
              <div className="admin-report-actions">
                <button
                  type="button"
                  className="button button-outline"
                  disabled={pendingId === report.id}
                  onClick={() =>
                    mutation.mutate({
                      id: report.id,
                      status: nextStatus(report.status),
                    })
                  }
                >
                  {report.status === "open" ? copy.markReviewed : copy.reopen}
                </button>
                {report.status === "open" && (
                  <button
                    type="button"
                    className="text-link"
                    disabled={pendingId === report.id}
                    onClick={() =>
                      mutation.mutate({ id: report.id, status: "dismissed" })
                    }
                  >
                    {copy.dismiss}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="muted admin-footnote">
        {format(copy.footnote, { limit: REPORT_LIMIT })}
      </p>
    </div>
  );
}
