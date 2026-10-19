"use client";

import Link from "next/link";
import { ChevronRightIcon, HomeIcon } from "./icons";
import { myListingsSummary } from "../lib/listings/my-listings";
import { useMyListings } from "../lib/listings/use-my-listings";

/**
 * Dashboard shortcut to "Moji oglasi". Shown only once the user has posted
 * something; before that, "Objavi oglas" on the same page is the entry point.
 */
export function MyListingsShortcut() {
  const { data } = useMyListings();
  if (!data || data.length === 0) return null;
  return (
    <ul className="row-list my-listings-shortcut">
      <li>
        <Link href="/listings/mine" className="row-link">
          <span className="row-icon">
            <HomeIcon />
          </span>
          <span className="row-text">
            <b>Moji oglasi</b>
            <small>{myListingsSummary(data)}</small>
          </span>
          <ChevronRightIcon className="row-chevron" />
        </Link>
      </li>
    </ul>
  );
}

/** "Moji oglasi" row in the profile's settings panel; always present. */
export function MyListingsSettingsRow() {
  const { data, isError } = useMyListings();
  const hint = isError
    ? "Seznama trenutno ni mogoče naložiti."
    : !data
      ? "Nalaganje …"
      : data.length === 0
        ? "Še nimaš objavljenih oglasov."
        : myListingsSummary(data);
  return (
    <Link href="/listings/mine" className="profile-card settings-link">
      <div>
        <b>Moji oglasi</b>
        <p>{hint}</p>
      </div>
      <ChevronRightIcon className="row-chevron" />
    </Link>
  );
}
