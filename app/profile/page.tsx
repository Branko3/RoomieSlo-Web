"use client";

import { useState } from "react";
import { useAuth } from "../../components/auth-provider";

export default function ProfilePage() {
  const [available, setAvailable] = useState(true);
  const { signOut } = useAuth();
  return (
    <div className="content-wrap narrow-content">
      <header className="topbar">
        <div>
          <p className="eyebrow">TVOJ PROSTOR</p>
          <h1>Profil</h1>
        </div>
        <button className="icon-button">⚙</button>
      </header>
      <section className="profile-header">
        <span className="avatar avatar-large">AH</span>
        <div>
          <h2>Amar H.</h2>
          <p>FRI, Univerza v Ljubljani · 22 let</p>
          <span className="verified-badge">✓ Preverjen študent</span>
        </div>
        <button className="text-link">Uredi</button>
      </section>
      <section className="profile-card">
        <div>
          <b>Iščem sostanovalca / sobo</b>
          <p>Ko je vklopljeno, se tvoj profil prikazuje med priporočenimi.</p>
        </div>
        <button
          className={`toggle ${available ? "on" : ""}`}
          onClick={() => setAvailable(!available)}
          aria-label="Preklopi razpoložljivost"
        >
          <span />
        </button>
      </section>
      <section className="profile-card questionnaire">
        <div className="progress-ring">68%</div>
        <div>
          <b>Vprašalnik o življenjskem slogu</b>
          <p>17 od 25 trditev izpolnjenih</p>
          <div className="progress">
            <span />
          </div>
        </div>
        <a href="#">Nadaljuj →</a>
      </section>
      <button
        className="button button-outline full-button"
        onClick={() => void signOut()}
      >
        Odjava
      </button>
    </div>
  );
}
