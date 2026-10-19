import Link from "next/link";
import { MatchRequestsPanel } from "../../components/match-requests-panel";
import { ChevronRightIcon, SparkleIcon } from "../../components/icons";

/**
 * Matches and chats (Android chat list, F15): every request and accepted
 * match, with a link into each accepted conversation.
 */
export default function ChatsPage() {
  return (
    <div className="content-wrap narrow-content">
      <header className="topbar">
        <div>
          <h1>Ujemanja in klepeti</h1>
        </div>
      </header>
      <div className="match-banner">
        <SparkleIcon className="match-icon" />
        <div>
          <b>Priporočeni profili</b>
          <p>Na podlagi tvojih odgovorov</p>
        </div>
        <Link className="link-chevron" href="/recommendations">
          Poglej
          <ChevronRightIcon size={16} />
        </Link>
      </div>
      <MatchRequestsPanel />
    </div>
  );
}
