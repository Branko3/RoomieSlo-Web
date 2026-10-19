"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { useAuth } from "../../../components/auth-provider";
import {
  DELETION_PHRASE,
  deleteOwnAccount,
  type DeleteAccountClient,
} from "../../../lib/account/deletion";
import { privacyContact } from "../../../lib/privacy/controller";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { ChevronLeftIcon } from "../../../components/icons";

const contact = privacyContact();

/** Self-service account deletion (approved retention matrix, 2026-10-12). */
export default function DeleteAccountPage() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await deleteOwnAccount(
      createSupabaseBrowserClient() as unknown as DeleteAccountClient,
      { password, confirm },
    );
    if (result.ok) {
      // The account is gone; clear the session and every cached user datum.
      await signOut();
      router.replace("/login?deleted=1");
      return;
    }
    setError(result.message);
    setPending(false);
    requestAnimationFrame(() => errorRef.current?.focus());
  }

  return (
    <div className="content-wrap narrow-content delete-account">
      <Link className="back-link" href="/profile">
        <ChevronLeftIcon size={18} />
        Nazaj na profil
      </Link>
      <h1>Izbriši račun</h1>
      <p>
        Izbris je <b>dokončen</b> in ga ni mogoče razveljaviti.
      </p>

      <section className="profile-card privacy-section">
        <div>
          <b>Takoj izbrišemo</b>
          <ul>
            <li>prijavo v račun (e-naslov in geslo),</li>
            <li>
              profil: ime, starost, fakulteto, opis, fotografijo in status
              preverjanja,
            </li>
            <li>odgovore vprašalnika, priljubljene in tvoje oglase,</li>
            <li>dokazilo o vpisu iz zasebne shrambe,</li>
            <li>zahteve za ujemanje, na katere še ni odgovora,</li>
            <li>ocene, ki so jih o tebi oddali sostanovalci.</li>
          </ul>
        </div>
      </section>

      <section className="profile-card privacy-section">
        <div>
          <b>Ostane, brez tvojega imena</b>
          <ul>
            <li>
              sporočila v pogovorih ostanejo drugi osebi, podpisana kot
              »Izbrisan uporabnik«; izbrišemo jih, ko svoj račun izbriše tudi
              ona,
            </li>
            <li>
              prijave zlorab, ki si jih oddal(a) ali so bile oddane zoper tebe,
              do 12 mesecev po zaključku,
            </li>
            <li>
              sobivanja ostanejo drugi osebi v njeni zgodovini: trenutno
              sobivanje se zaključi s tem mesecem, nepotrjena izjava »Živiva
              skupaj« pa se zapre kot nepotrjena. Izbrišemo jih, ko svoj račun
              izbriše tudi druga oseba,
            </li>
            <li>
              ocene, ki si jih dal(a), ostanejo v povzetku druge osebe brez
              tvojega imena, največ 36 mesecev po koncu sobivanja,
            </li>
            <li>
              tvoj e-naslov in ime v zaščitenem zapisu za varnostne primere: 30
              dni oziroma do 12 mesecev po zaključku prijave zoper tebe; dostop
              ima le upravljavec baze.
            </li>
          </ul>
          <p className="muted">
            Varnostne kopije potečejo v 30 dneh; do takrat so izbrisani podatki
            lahko še v njih.
          </p>
        </div>
      </section>

      <form className="profile-form" onSubmit={submit} noValidate>
        <label htmlFor="delete-password">Geslo</label>
        <input
          id="delete-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={pending}
        />
        <label htmlFor="delete-confirm">
          Za potrditev vpiši <b>{DELETION_PHRASE}</b>
        </label>
        <input
          id="delete-confirm"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          disabled={pending}
        />
        {error && (
          <p
            ref={errorRef}
            className="error-message"
            role="alert"
            tabIndex={-1}
          >
            {error}
            {contact && (
              <>
                {" "}
                <a href={`mailto:${contact}`}>{contact}</a>
              </>
            )}
          </p>
        )}
        <div className="profile-form-actions">
          <Link className="button button-outline" href="/profile">
            Prekliči
          </Link>
          <button
            className="button button-danger"
            type="submit"
            disabled={pending}
            aria-busy={pending || undefined}
          >
            {pending ? "Brisanje …" : "Trajno izbriši račun"}
          </button>
        </div>
      </form>
    </div>
  );
}
