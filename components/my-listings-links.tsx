"use client";

import Link from "next/link";
import { ChevronRightIcon, HomeIcon } from "./icons";
import { useI18n } from "../lib/i18n/provider";
import { myListingsSummary } from "../lib/listings/my-listings";
import { useMyListings } from "../lib/listings/use-my-listings";

/**
 * Dashboard shortcut to "Moji oglasi". Shown only once the user has posted
 * something; before that, "Objavi oglas" on the same page is the entry point.
 */
export function MyListingsShortcut() {
  const i18n = useI18n();
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
            <b>{i18n.m.listings.mine.title}</b>
            <small>{myListingsSummary(data, i18n)}</small>
          </span>
          <ChevronRightIcon className="row-chevron" />
        </Link>
      </li>
    </ul>
  );
}

/** "Moji oglasi" row in the profile's settings panel; always present. */
export function MyListingsSettingsRow() {
  const i18n = useI18n();
  const text = i18n.m.listings.mine;
  const { data, isError } = useMyListings();
  const hint = isError
    ? text.settingsError
    : !data
      ? text.settingsLoading
      : data.length === 0
        ? text.settingsEmpty
        : myListingsSummary(data, i18n);
  return (
    <Link href="/listings/mine" className="profile-card settings-link">
      <div>
        <b>{text.title}</b>
        <p>{hint}</p>
      </div>
      <ChevronRightIcon className="row-chevron" />
    </Link>
  );
}
