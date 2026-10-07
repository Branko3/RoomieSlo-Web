"use client";

import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const [submitted, setSubmitted] = useState(false);
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <span className="brand-mark">R</span>
        <b>
          Roomie<span>Slo</span>
        </b>
      </div>
      <div className="auth-card">
        <p className="eyebrow">DOBRODOŠEL NAZAJ</p>
        <h1>Prijavi se v svoj račun</h1>
        <p className="muted">Nadaljuj z iskanjem svojega idealnega doma.</p>
        <label>
          E-naslov
          <input type="email" placeholder="ime@primer.si" />
        </label>
        <label>
          Geslo
          <input type="password" placeholder="••••••••" />
        </label>
        <div className="auth-options">
          <label className="checkbox">
            <input type="checkbox" /> Zapomni si me
          </label>
          <a href="#">Pozabljeno geslo?</a>
        </div>
        {submitted && (
          <p className="success-message">Demo način: prijava je uspešna.</p>
        )}
        <button
          className="button full-button"
          onClick={() => setSubmitted(true)}
        >
          Prijava
        </button>
        <p className="auth-footer">
          Še nimaš računa? <Link href="/register">Registriraj se</Link>
        </p>
      </div>
    </div>
  );
}
