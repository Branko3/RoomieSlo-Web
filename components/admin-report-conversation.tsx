"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  adminCopy,
  AdminError,
  loadReportConversation,
  type AdminClient,
} from "../lib/admin/reports";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

const timeFormat = new Intl.DateTimeFormat("sl-SI", {
  dateStyle: "short",
  timeStyle: "short",
});

/**
 * "Prikaži pogovor" for a report filed from a chat. Nothing is loaded until the
 * admin asks, because every load is written to the audit log.
 */
export function AdminReportConversation({ reportId }: { reportId: string }) {
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
        {open ? "Skrij pogovor" : "Prikaži pogovor"}
      </button>
      {!open && <small className="muted">{adminCopy.conversationLogged}</small>}
      {open && (
        <section id={regionId} aria-label="Prijavljeni pogovor">
          {query.isPending ? (
            <p role="status">Nalaganje pogovora …</p>
          ) : query.isError ? (
            <p className="error-message" role="alert">
              {query.error instanceof AdminError
                ? query.error.message
                : adminCopy.conversationFailed}
            </p>
          ) : query.data.length === 0 ? (
            <p className="muted">{adminCopy.conversationEmpty}</p>
          ) : (
            <ol className="admin-transcript">
              {query.data.map((entry) => (
                <li key={entry.id} className={`admin-transcript-${entry.role}`}>
                  <small>
                    <b>{entry.label}</b> ·{" "}
                    {timeFormat.format(new Date(entry.sentAt))}
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
