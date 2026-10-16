/**
 * The data controller named on `/privacy` and the delete-account page.
 * Branko is the controller personally (this is not thesis work).
 */
export const DATA_CONTROLLER = "Branko";

/**
 * The controller's contact e-mail, also used to report unfair ratings.
 * Placeholder until the owner sets `NEXT_PUBLIC_PRIVACY_CONTACT` for each
 * environment (.env.example): while it is empty, the pages say the contact
 * is not set yet instead of showing an address.
 */
export function privacyContact(): string {
  return (process.env.NEXT_PUBLIC_PRIVACY_CONTACT ?? "").trim();
}
