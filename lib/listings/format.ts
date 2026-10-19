/**
 * Slovenian date for a listing's move-in value: "2026-09-20" → "20. 9. 2026".
 * Parsed by hand (no Date/Intl) so the calendar day never shifts with the
 * viewer's time zone. Anything that is not an ISO date ("po dogovoru") is
 * returned unchanged.
 */
export function formatMoveIn(available: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(available);
  if (!match) return available;
  const [, year, month, day] = match;
  return `${Number(day)}. ${Number(month)}. ${year}`;
}

const WHOLE_EUROS = new Intl.NumberFormat("sl-SI", {
  maximumFractionDigits: 0,
});
const EUROS_AND_CENTS = new Intl.NumberFormat("sl-SI", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Slovenian amount with a non-breaking space so the amount and unit never
 * split: "320 €", "320,50 €", "12.000 €" (Slovenian groups from five digits).
 */
export function formatPrice(amount: number): string {
  const format = Number.isInteger(amount) ? WHOLE_EUROS : EUROS_AND_CENTS;
  return `${format.format(amount)} €`;
}
