"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  AdminError,
  loadReportConversation,
  type AdminClient,
} from "../lib/admin/reports";
import { useI18n } from "../lib/i18n/provider";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

/**
 * "Show conversation" for a report filed from a chat. Nothing is loaded until the
 * admin asks, because every load is written to the audit log.
 */
export function AdminReportConversation({ reportId }: { reportId: string }) {
  const { m, formatters } = useI18n();
  const copy = m.admin.conversation;
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["admin", "report-conversation", reportId],
    enabled: open,
    retry: false,
    staleTime: Infinity,
    queryFn: () =>
      loadReportConversation(
        createSupabaseBrowserClient() as unknown as AdminClient,
        reportId,
      ),
  });
  const regionId = `conversation-${reportId}`;

  return (
    <div className="admin-conversation">
      <button
        type="button"
        className="text-link"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? copy.hide : copy.show}
      </button>
      {!open && <small className="muted">{copy.logged}</small>}
      {open && (
        <section id={regionId} aria-label={copy.region}>
          {query.isPending ? (
            <p role="status">{copy.loading}</p>
          ) : query.isError ? (
            <p className="error-message" role="alert">
              {query.error instanceof AdminError
                ? m.admin.errors[query.error.code]
                : m.admin.errors.conversationFailed}
            </p>
          ) : query.data.length === 0 ? (
            <p className="muted">{copy.empty}</p>
          ) : (
            <ol className="admin-transcript">
              {query.data.map((entry) => (
                <li key={entry.id} className={`admin-transcript-${entry.role}`}>
                  <small>
                    <b>{copy.roles[entry.role]}</b> ·{" "}
                    {formatters.dateTimeShort(entry.sentAt)}
                  </small>
                  <p>{entry.body}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
