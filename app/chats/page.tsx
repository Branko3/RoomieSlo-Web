import Link from "next/link";
import { MatchRequestsPanel } from "../../components/match-requests-panel";

/**
 * Matches and chats (Android chat list, F15): every request and accepted
 * match, with a link into each accepted conversation.
 */
export default function ChatsPage() {
  return (
    <div className="content-wrap narrow-content">
      <header className="topbar">
        <div>
          <p className="eyebrow">POVEŽI SE</p>
          <h1>Ujemanja in klepeti</h1>
        </div>
      </header>
      <div className="match-banner">
        <span className="match-icon" aria-hidden="true">
          ✦
        </span>
        <div>
          <b>Priporočeni profili</b>
          <p>Na podlagi tvojih odgovorov</p>
        </div>
        <Link href="/recommendations">Poglej →</Link>
      </div>
      <MatchRequestsPanel />
    </div>
  );
}
