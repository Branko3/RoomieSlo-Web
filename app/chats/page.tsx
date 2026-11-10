import Link from "next/link";
import { MatchRequestsPanel } from "../../components/match-requests-panel";
import { ChevronRightIcon, SparkleIcon } from "../../components/icons";
import { getI18n } from "../../lib/i18n/server";

/**
 * Matches and chats (Android chat list, F15): every request and accepted
 * match, with a link into each accepted conversation.
 */
export default async function ChatsPage() {
  const { m } = await getI18n();
  const copy = m.chat.list;
  return (
    <div className="content-wrap narrow-content">
      <header className="topbar">
        <div>
          <h1>{copy.title}</h1>
        </div>
      </header>
      <div className="match-banner">
        <SparkleIcon className="match-icon" />
        <div>
          <b>{copy.recommendedTitle}</b>
          <p>{copy.recommendedBody}</p>
        </div>
        <Link className="link-chevron" href="/recommendations">
          {copy.recommendedLink}
          <ChevronRightIcon size={16} />
        </Link>
      </div>
      <MatchRequestsPanel />
    </div>
  );
}
