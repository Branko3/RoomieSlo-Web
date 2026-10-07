"use client";

import Link from "next/link";
import { useState } from "react";
import { useFavorites } from "../../../components/providers";
import { useListing } from "../../../lib/supabase/hooks";

export default function ListingDetail({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: listing, isLoading, error } = useListing(id);
  const { isFavorite, toggleFavorite } = useFavorites();
  const [requestState, setRequestState] = useState<"idle" | "success">("idle");
  const [message, setMessage] = useState("");

  if (isLoading) return <div className="page-state"><p>Nalaganje oglasa ...</p></div>;
  if (error) return <div className="page-state" role="alert"><h1>Oglasa ni mogoče naložiti</h1><p>Preveri povezavo in prijavo v Supabase.</p><Link className="button" href="/listings">Na oglase</Link></div>;
  if (!listing) {
    return (
      <div className="page-state">
        <h1>Oglas ni več na voljo</h1>
        <p>Ta oglas ne obstaja ali je bil odstranjen.</p>
        <Link className="button" href="/listings">Na oglase</Link>
      </div>
    );
  }

  const favorite = isFavorite(listing.id);
  return (
    <div className="content-wrap">
      <Link className="back-link" href="/listings">
        ← Nazaj na oglase
      </Link>
      <div className="detail-layout">
        <div className="detail-image">{listing.image}</div>
        <div className="detail-copy">
          <div className="chips">
            <span className="chip">{listing.roomType}</span>
            <span className="chip chip-green">Preverjen oglas</span>
          </div>
          <h1>{listing.title}</h1>
          <p className="muted">⌖ {listing.district}</p>
          <div className="price-large">
            {listing.price} € <small>/ mesec</small>
          </div>
          <p className="detail-description">
            Svetla in prijetna nastanitev za študenta. Stanovanje je urejeno,
            skupni prostori pa so dobro vzdrževani. Piši lastniku za več
            informacij in ogled.
          </p>
          <div className="detail-stats">
            <span>
              <b>{listing.details.split(" · ")[0]}</b>
              <small>velikost</small>
            </span>
            <span>
              <b>{listing.available}</b>
              <small>vselitev</small>
            </span>
            <span>
              <b>320 €</b>
              <small>varščina</small>
            </span>
          </div>
          {requestState === "success" ? (
            <div className="success-message full-button" aria-live="polite">
              Zahteva je poslana. <Link href="/chats">Odpri klepete →</Link>
            </div>
          ) : (
            <>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setRequestState("success");
                }}
              >
                <label className="sr-only" htmlFor="request-message">
                  Sporočilo lastniku (neobvezno)
                </label>
                <textarea
                  id="request-message"
                  className="request-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Dodaj kratko sporočilo (neobvezno)"
                  rows={3}
                />
                <button className="button full-button" type="submit">
                  Pošlji zahtevo za ujemanje
                </button>
              </form>
            </>
          )}
          <button
            className="button button-outline full-button"
            onClick={() => toggleFavorite(listing.id)}
            aria-pressed={favorite}
          >
            {favorite ? "♥ Odstrani iz priljubljenih" : "♡ Shrani oglas"}
          </button>
        </div>
      </div>
    </div>
  );
}
