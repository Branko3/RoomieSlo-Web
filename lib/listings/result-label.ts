/**
 * Slovenian noun form for a listing count ("1 oglas", "2 oglasa", "3 oglasi",
 * "5 oglasov"). The form follows the last two digits: 101 is "oglas", 102 "oglasa".
 */
export function listingCountLabel(count: number): string {
  const lastTwo = Math.abs(Math.trunc(count)) % 100;
  if (lastTwo === 1) return "oglas";
  if (lastTwo === 2) return "oglasa";
  if (lastTwo === 3 || lastTwo === 4) return "oglasi";
  return "oglasov";
}
