"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import dynamic from "next/dynamic";

// The cohabitation and rating strips are secondary (accepted matches only, and
// they load their own data), so they arrive after the conversation instead of
// counting towards this route's first-load budget.
const ChatCohabitation = dynamic(
  () =>
    import("../../../components/chat-cohabitation").then(
      (module) => module.ChatCohabitation,
    ),
  { loading: () => null },
);
const ChatRating = dynamic(
  () =>
    import("../../../components/chat-rating").then(
      (module) => module.ChatRating,
    ),
  { loading: () => null },
);
import {
  BlockPersonControl,
  ChatSafetyMenu,
  ReportPersonLink,
  useBlockState,
} from "../../../components/chat-safety-controls";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  VerifiedIcon,
} from "../../../components/icons";
import { MessageComposer } from "../../../components/message-composer";
import { MessageHistory } from "../../../components/message-history";
import { useChatSender } from "../../../components/use-chat-sender";
import {
  liveNotice,
  useMessageRealtime,
} from "../../../components/use-message-realtime";
import { getSupabaseConfig } from "../../../lib/config";
import {
  ConversationError,
  conversationNotice,
  loadConversation,
  type ConversationClient,
} from "../../../lib/chat/conversation";
import { useI18n } from "../../../lib/i18n/provider";
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
  const { m, format } = useI18n();
  const copy = m.chat.conversation;
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
  const sender = useChatSender(params.matchId);
  const liveStatus = useMessageRealtime(
    params.matchId,
    query.data?.status === "accepted",
  );
  const peerId =
    query.data &&
    query.data.status !== "signed-out" &&
    query.data.status !== "not-found"
      ? query.data.peer.id
      : null;
  const blockState = useBlockState(peerId);

  const back = (
    <Link className="back-link" href="/chats">
      <ChevronLeftIcon size={18} />
      {copy.back}
    </Link>
  );

  if (!configured) {
    return (
      <div className="content-wrap narrow-content">
        {back}
        <p className="error-message" role="alert">
          {copy.unavailable}
        </p>
      </div>
    );
  }

  if (query.isPending) {
    return (
      <div className="content-wrap narrow-content">
        {back}
        <p role="status">{copy.opening}</p>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="content-wrap narrow-content">
        {back}
        <div className="page-state" role="alert">
          <h1>{copy.failedTitle}</h1>
          <p>
            {query.error instanceof ConversationError
              ? copy.errors[query.error.kind]
              : copy.errors.failed}
          </p>
          <button
            className="button"
            type="button"
            onClick={() => query.refetch()}
          >
            {m.common.actions.retry}
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
          <h1>{copy.signedOutTitle}</h1>
          <p>{copy.signedOutBody}</p>
          <Link className="button" href="/login">
            {copy.signIn}
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
          <h1>{copy.notFoundTitle}</h1>
          <p>{copy.notFoundBody}</p>
          <Link className="button" href="/chats">
            {copy.toChats}
          </Link>
        </div>
      </div>
    );
  }

  const notice = conversationNotice(conversation);
  const { peer } = conversation;
  const peerName = peer.name || copy.unknownUser;

  return (
    <div className="content-wrap narrow-content conversation">
      {back}
      <header className="conversation-header">
        <span className="avatar" aria-hidden="true">
          {initials(peerName)}
        </span>
        <div className="conversation-peer">
          <h1>
            {peerName}
            {peer.verified && (
              <VerifiedIcon
                className="verified-icon"
                size={20}
                label={copy.verified}
              />
            )}
          </h1>
          {peer.faculty && <p className="muted">{peer.faculty}</p>}
        </div>
        <ChatSafetyMenu>
          <ReportPersonLink peerId={peer.id} matchId={conversation.matchId} />
          {!peer.deleted && <BlockPersonControl state={blockState} />}
        </ChatSafetyMenu>
      </header>
      {conversation.status === "accepted" && (
        <ChatCohabitation
          matchId={conversation.matchId}
          matchCreatedAt={conversation.matchCreatedAt}
          peerName={peerName}
          canDeclare={!peer.deleted && !blockState.blocked}
        />
      )}
      {conversation.status === "accepted" && !peer.deleted && (
        <ChatRating matchId={conversation.matchId} peerName={peerName} />
      )}

      {conversation.peerListings.length > 0 && (
        <section
          className="conversation-context"
          aria-label={copy.peerListings}
        >
          {conversation.peerListings.map((listing) => (
            <Link
              key={listing.id}
              className="context-card"
              href={`/listings/${encodeURIComponent(listing.id)}`}
            >
              <b>{listing.title}</b>
              <small>
                {listing.district} ·{" "}
                {format(copy.listingPrice, { price: listing.price })}
              </small>
            </Link>
          ))}
        </section>
      )}

      {notice ? (
        <p className="conversation-notice" role="status">
          {copy.notices[notice]}{" "}
          {conversation.status === "pending" && (
            <Link className="link-chevron" href="/chats">
              {copy.openRequests}
              <ChevronRightIcon size={16} />
            </Link>
          )}
        </p>
      ) : (
        <>
          <section
            className="conversation-body"
            aria-label={format(copy.region, { name: peerName })}
            data-match-id={conversation.matchId}
          >
            <MessageHistory
              matchId={conversation.matchId}
              peerName={peerName}
              onRetry={sender.retry}
              onDiscard={sender.discard}
            />
          </section>
          {liveNotice(liveStatus, m.chat.live) && (
            <p className="live-status" role="status">
              {liveNotice(liveStatus, m.chat.live)}
            </p>
          )}
          {peer.deleted ? (
            <p className="conversation-notice" role="status">
              {copy.deletedPeer}
            </p>
          ) : blockState.blocked ? (
            <p className="conversation-notice" role="status">
              {m.chat.safety.blocked}
            </p>
          ) : (
            <MessageComposer onSend={sender.send} error={sender.error} />
          )}
        </>
      )}
    </div>
  );
}
