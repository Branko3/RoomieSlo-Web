import { formatPrice } from "../lib/listings/format";
import type { Listing } from "../lib/supabase/mappers";

function yesNo(value: boolean) {
  return value ? "da" : "ne";
}

/** Facts the owner entered; anything unknown is left out rather than guessed. */
function ListingFacts({ listing }: { listing: Listing }) {
  const facts: Array<[string, string]> = [];
  if (listing.sizeSqm != null)
    facts.push(["Velikost", `${listing.sizeSqm} m²`]);
  if (listing.deposit != null)
    facts.push(["Varščina", formatPrice(listing.deposit)]);
  if (listing.flatmates != null)
    facts.push(["Sostanovalci", String(listing.flatmates)]);
  if (listing.furnished != null)
    facts.push(["Opremljeno", yesNo(listing.furnished)]);
  if (listing.billsIncluded != null)
    facts.push(["Stroški vključeni", yesNo(listing.billsIncluded)]);
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
  return (
    <section className="detail-section" aria-labelledby="about-title">
      <h2 id="about-title">O prostoru</h2>
      <p className="detail-description">
        {listing.description?.trim() || "Lastnik še ni dodal opisa."}
      </p>
      <ListingFacts listing={listing} />
    </section>
  );
}
