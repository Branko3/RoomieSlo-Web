"use client";

import { useI18n } from "../lib/i18n/provider";
import type { Listing } from "../lib/supabase/mappers";

/** Facts the owner entered; anything unknown is left out rather than guessed. */
function ListingFacts({ listing }: { listing: Listing }) {
  const { m, format, formatters } = useI18n();
  const text = m.listings.about;
  const yesNo = (value: boolean) => (value ? text.yes : text.no);
  const facts: Array<[string, string]> = [];
  if (listing.sizeSqm != null)
    facts.push([text.size, format(text.sizeValue, { size: listing.sizeSqm })]);
  if (listing.deposit != null)
    facts.push([text.deposit, formatters.currency(listing.deposit)]);
  if (listing.flatmates != null)
    facts.push([text.flatmates, String(listing.flatmates)]);
  if (listing.furnished != null)
    facts.push([text.furnished, yesNo(listing.furnished)]);
  if (listing.billsIncluded != null)
    facts.push([text.billsIncluded, yesNo(listing.billsIncluded)]);
  if (facts.length === 0) return null;
  return (
    <dl className="fact-list">
      {facts.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "O prostoru" on the listing detail page: the owner's own words and facts only. */
export function ListingAbout({ listing }: { listing: Listing }) {
  const { m } = useI18n();
  return (
    <section className="detail-section" aria-labelledby="about-title">
      <h2 id="about-title">{m.listings.about.title}</h2>
      <p className="detail-description">
        {listing.description?.trim() || m.listings.about.noDescription}
      </p>
      <ListingFacts listing={listing} />
    </section>
  );
}
