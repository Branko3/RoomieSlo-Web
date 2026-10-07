import Link from "next/link";

const chats = [
  {
    name: "Iva K.",
    message: "Se vidiva jutri ob 17h za ogled?",
    time: "10:42",
    initials: "IK",
    unread: 2,
  },
  {
    name: "Marko P.",
    message: "Super, hvala za informacije!",
    time: "Včeraj",
    initials: "MP",
    unread: 0,
  },
  {
    name: "Sara D.",
    message: "Zahteva za ujemanje poslana.",
    time: "Pon",
    initials: "SD",
    unread: 0,
  },
];

export default function ChatsPage() {
  return (
    <div className="content-wrap narrow-content">
      <header className="topbar">
        <div>
          <p className="eyebrow">POVEŽI SE</p>
          <h1>Ujemanja in klepeti</h1>
        </div>
        <button className="icon-button">⋯</button>
      </header>
      <div className="match-banner">
        <span className="match-icon">✦</span>
        <div>
          <b>3 dobra ujemanja</b>
          <p>Na podlagi tvojih odgovorov</p>
        </div>
        <a href="/search">Poglej →</a>
      </div>
      <div className="chat-list">
        {chats.map((chat) => (
          <Link href="/chats/iva" className="chat-row" key={chat.name}>
            <span className="avatar">{chat.initials}</span>
            <span className="chat-copy">
              <b>
                {chat.name}
                <span className="verified">✓</span>
              </b>
              <small>{chat.message}</small>
            </span>
            <span className="chat-time">
              {chat.time}
              {chat.unread > 0 && <i>{chat.unread}</i>}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
