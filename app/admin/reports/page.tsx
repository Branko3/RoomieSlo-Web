"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import {
  adminCopy,
  AdminError,
  countByStatus,
  filterReports,
  isAdmin,
  listReports,
  nextStatus,
  REPORT_LIMIT,
  replaceStatus,
  reportedLabel,
  setReportStatus,
  statusLabel,
  type AdminClient,
  type AdminReport,
  type StatusFilter,
} from "../../../lib/admin/reports";
import { AdminReportConversation } from "../../../components/admin-report-conversation";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import type { ReportStatus } from "../../../lib/supabase/types";

type DashboardData = { admin: false } | { admin: true; reports: AdminReport[] };

const queryKey = ["admin", "reports"] as const;

function client() {
  return createSupabaseBrowserClient() as unknown as AdminClient;
}

function safeMessage(error: unknown, fallback: string) {
  return error instanceof AdminError ? error.message : fallback;
}

const dateFormat = new Intl.DateTimeFormat("sl-SI", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function AdminReportsPage() {
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
        <p>Nalaganje prijav ...</p>
      </div>
    );
  }

  if (query.isError) {
    const signedOut =
      query.error instanceof AdminError && query.error.kind === "signed-out";
    return (
      <div className="page-state" role="alert">
        <h1>Administratorska plošča</h1>
        <p>{safeMessage(query.error, adminCopy.loadFailed)}</p>
        {signedOut ? (
          <Link className="button" href="/login">
            Prijava
          </Link>
        ) : (
          <button className="button" onClick={() => query.refetch()}>
            Poskusi znova
          </button>
        )}
      </div>
    );
  }

  if (!query.data.admin) {
    return (
      <div className="page-state" role="alert">
        <h1>Administratorska plošča</h1>
        <p>{adminCopy.notAdmin}</p>
        <Link className="button" href="/">
          Na začetek
        </Link>
      </div>
    );
  }

  const reports = query.data.reports;
  const counts = countByStatus(reports);
  const visible = filterReports(reports, filter);
  const pendingId = mutation.isPending ? mutation.variables?.id : undefined;

  return (
    <div className="content-wrap admin-page">
      <h1>Administratorska plošča</h1>
      <p className="muted">Prijave uporabnikov, najnovejše najprej.</p>
      <div className="admin-filters" role="group" aria-label="Status prijav">
        {(["open", "reviewed", "dismissed", "all"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`chip admin-filter${filter === value ? " is-active" : ""}`}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {value === "all" ? "Vse" : statusLabel[value]} ({counts[value]})
          </button>
        ))}
      </div>
      {mutation.isError && (
        <p className="admin-error" role="alert">
          {safeMessage(mutation.error, adminCopy.updateFailed)}
        </p>
      )}
      {visible.length === 0 ? (
        <p className="muted">
          {reports.length === 0 ? adminCopy.empty : adminCopy.emptyFilter}
        </p>
      ) : (
        <ul className="admin-reports">
          {visible.map((report) => (
            <li key={report.id} className="admin-report">
              <div className="admin-report-body">
                <div className="admin-report-head">
                  <b>{report.reason}</b>
                  <span
                    className={`admin-status admin-status-${report.status}`}
                  >
                    {statusLabel[report.status]}
                  </span>
                </div>
                {report.description && (
                  <p className="admin-report-description">
                    {report.description}
                  </p>
                )}
                <small className="muted">
                  {dateFormat.format(new Date(report.created_at))} · prijavljen{" "}
                  {reportedLabel(report)}
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
                  {report.status === "open"
                    ? "Označi kot rešeno"
                    : "Ponovno odpri"}
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
                    Zavrni
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="muted admin-footnote">
        Prikazanih je največ {REPORT_LIMIT} najnovejših prijav.
      </p>
    </div>
  );
}
