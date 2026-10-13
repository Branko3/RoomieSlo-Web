"use client";

import Link from "next/link";
import { useState } from "react";
import { OwnProfileSection } from "../../components/own-profile-section";
import { getSupabaseConfig } from "../../lib/config";
import { LogoutButton } from "../../components/logout-button";

export default function ProfilePage() {
  const [available, setAvailable] = useState(true);
  return (
    <div className="content-wrap narrow-content">
      <header className="topbar">
        <div>
          <p className="eyebrow">TVOJ PROSTOR</p>
          <h1>Profil</h1>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Nastavitve profila"
        >
          ⚙
        </button>
      </header>
      <OwnProfileSection configured={getSupabaseConfig().configured} />
      <section className="profile-card">
        <div>
          <b>Iščem sostanovalca / sobo</b>
          <p>Ko je vklopljeno, se tvoj profil prikazuje med priporočenimi.</p>
        </div>
        <button
          className={`toggle ${available ? "on" : ""}`}
          type="button"
          onClick={() => setAvailable(!available)}
          aria-label="Preklopi razpoložljivost"
          aria-pressed={available}
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
        <Link href="/profile/questionnaire">Nadaljuj →</Link>
      </section>
      <LogoutButton />
      <Link
        className="text-link danger-link delete-account-link"
        href="/profile/delete-account"
      >
        Izbriši račun
      </Link>
    </div>
  );
}
