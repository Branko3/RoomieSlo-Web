"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { MessageComposer } from "../../../components/message-composer";
import { MessageHistory } from "../../../components/message-history";
import { getSupabaseConfig } from "../../../lib/config";
import {
  ConversationError,
  conversationNotice,
  loadConversation,
  type ConversationClient,
} from "../../../lib/chat/conversation";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

export default function ConversationPage({
  params,
}: {
  params: { matchId: string };
}) {
  const configured = getSupabaseConfig().configured;
  const query = useQuery({
    queryKey: ["conversation", params.matchId],
    enabled: configured,
    queryFn: () =>
      loadConversation(
        createSupabaseBrowserClient() as unknown as ConversationClient,
        params.matchId,
      ),
  });

  const back = (
    <Link className="back-link" href="/chats">
      ← Nazaj na klepete
    </Link>
  );

  if (!configured) {
    return (
      <div className="content-wrap narrow-content">
        {back}
        <p className="error-message" role="alert">
          Klepet trenutno ni na voljo.
        </p>
      </div>
    );
  }

  if (query.isPending) {
    return (
      <div className="content-wrap narrow-content">
        {back}
        <p role="status">Odpiranje klepeta …</p>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="content-wrap narrow-content">
        {back}
        <div className="page-state" role="alert">
          <h1>Klepeta ni mogoče odpreti</h1>
          <p>
            {query.error instanceof ConversationError
              ? query.error.message
              : "Klepeta ni bilo mogoče odpreti."}
          </p>
          <button
            className="button"
            type="button"
            onClick={() => query.refetch()}
          >
            Poskusi znova
          </button>
        </div>
      </div>
    );
  }

  const conversation = query.data;
  if (conversation.status === "signed-out") {
    return (
      <div className="content-wrap narrow-content">
        {back}
        <div className="page-state">
          <h1>Nisi prijavljen</h1>
          <p>Za ogled klepeta se moraš prijaviti.</p>
          <Link className="button" href="/login">
            Prijava
          </Link>
        </div>
      </div>
    );
  }
  if (conversation.status === "not-found") {
    return (
      <div className="content-wrap narrow-content">
        {back}
        <div className="page-state">
          <h1>Klepet ni na voljo</h1>
          <p>Ta pogovor ne obstaja ali vanj nisi vključen.</p>
          <Link className="button" href="/chats">
            Na klepete
          </Link>
        </div>
      </div>
    );
  }

  const notice = conversationNotice(conversation);
  const { peer } = conversation;

  return (
    <div className="content-wrap narrow-content conversation">
      {back}
      <header className="conversation-header">
        <span className="avatar" aria-hidden="true">
          {initials(peer.name)}
        </span>
        <div>
          <h1>
            {peer.name}
            {peer.verified && (
              <span className="verified" aria-label="Preverjen študent">
                {" "}
                ✓
              </span>
            )}
          </h1>
          {peer.faculty && <p className="muted">{peer.faculty}</p>}
        </div>
      </header>

      {conversation.peerListings.length > 0 && (
        <section className="conversation-context" aria-label="Oglasi te osebe">
          {conversation.peerListings.map((listing) => (
            <Link
              key={listing.id}
              className="context-card"
              href={`/listings/${encodeURIComponent(listing.id)}`}
            >
              <b>{listing.title}</b>
              <small>
                {listing.district} · {listing.price} € / mesec
              </small>
            </Link>
          ))}
        </section>
      )}

      {notice ? (
        <p className="conversation-notice" role="status">
          {notice}{" "}
          {conversation.status === "pending" && (
            <Link href="/chats">Odpri zahteve →</Link>
          )}
        </p>
      ) : (
        <>
          <section
            className="conversation-body"
            aria-label={`Pogovor z osebo ${peer.name}`}
            data-match-id={conversation.matchId}
          >
            <MessageHistory
              matchId={conversation.matchId}
              peerName={peer.name}
            />
          </section>
          <MessageComposer matchId={conversation.matchId} />
        </>
      )}
    </div>
  );
}
