# RoomieSlo UI changes

> UI/UX audit and improvement backlog for the RoomieSlo web prototype.  
> Reviewed: 2026-10-06  
> Scope: running app at `http://localhost:3000`, source in `app/`, `components/`, and `lib/`.

## 1. Current product and UI context

RoomieSlo is a Slovenian student roommate and room-finding service. The current experience is a desktop-first dashboard with a fixed sidebar and a responsive mobile bottom navigation. Its visual language is:

- deep green as the primary/action colour;
- amber as a supporting accent for tips, chips, and status;
- rounded white cards on a very light background;
- short Slovenian labels and compact metadata;
- a friendly, calm tone: “Tvoj dom. Tvoja ekipa.”

The prototype currently uses preview data from [`lib/data.ts`](./lib/data.ts), emoji illustrations instead of listing photos, and a prepared Supabase client for future data integration.

## 2. Functionality reviewed

| Route | Current functionality | Current limitation |
|---|---|---|
| `/listings` | Dashboard, recommended listing cards, quick actions, navigation | Notification button has no action; recommended data is static |
| `/search` | Location text filter, budget slider, live result count, empty state | “Poišči oglase” does not do anything; sort button is not wired; filter state is not reflected in the URL; result copy has a grammar issue for `1` |
| `/listings/[id]` | Listing detail, price, location, metadata, match CTA, save CTA | Match and save buttons have no handlers; unknown IDs silently show the first listing; detail content is mostly generic |
| `/favorites` | Displays two favorite-looking rows | It is hard-coded to the first two listings and is not connected to the favorite buttons |
| `/chats` | Chat list, unread count, match banner | Every row links to `/chats/iva`; no chat detail page exists; overflow button has no action |
| `/profile` | Profile summary, availability toggle, questionnaire progress, logout-looking CTA | Edit, settings, questionnaire, and logout controls are not wired; progress is static |
| `/login` | Form-like UI and demo success message | No input validation, authentication, loading/error state, or real submit |
| `/register` | Form-like UI | Continue button has no action or validation |

### Confirmed interaction observations

- Typing `Center` in the location field immediately reduces four results to one.
- The card heart changes its label and icon from “Dodaj med priljubljene” to “Odstrani iz priljubljenih”.
- That heart state belongs to the individual card component, so it is lost when navigating away and is not reflected on `/favorites`.
- `/listings/l1` renders correctly and has a usable back link.
- The profile availability toggle changes visual state locally.
- The app includes a skip link and semantic landmark/navigation structure, but most custom controls do not have visible keyboard focus styling.

## 3. Strengths to preserve

1. **Clear information hierarchy.** Eyebrow, heading, supporting text, primary action, and metadata are consistently ordered.
2. **Strong visual identity.** Green/amber tokens and rounded cards make the prototype recognisable without being visually noisy.
3. **Good discovery entry points.** The dashboard hero, recommended listings, and quick actions all point toward the core task.
4. **Useful listing scan pattern.** Room type, new status, location, rent, availability, and key facts are visible without opening a detail page.
5. **Responsive structure already exists.** Desktop sidebar and mobile navigation give the product a sensible base for mobile work.
6. **Some accessibility foundations are present.** `lang="sl"`, labelled navigation, a skip link, heading structure, and accessible labels on favorite buttons are good starting points.

## 4. Recommended UI changes

### P0 — make the core journey trustworthy

#### A. Connect favorites to one source of truth

**Problem:** The favorite heart is local component state; `/favorites` renders `listings.slice(0, 2)`, so the visible favorite collection does not represent the user’s actions.

**Recommended solution:**

- Add a shared favorite store/context backed by Supabase once authentication is enabled.
- For the prototype, use `localStorage` as a clearly temporary persistence layer.
- Make the detail-page save button use the same action and label as the card heart.
- Render a genuine empty state on `/favorites` with a link back to search.
- Show a short toast such as “Oglas shranjen” with an Undo action after saving.

**Acceptance checks:** save on search → navigate to favorites → same listing appears; remove it → it disappears; reload → state remains in the prototype.

#### B. Make search controls honest and useful

**Problem:** Search filters live in component state, the submit button has no behavior, and sorting is visually presented as a control but cannot change results.

**Recommended solution:**

- Either remove the submit button and label filtering as live, or make the button apply a draft filter state.
- Add filters for room type, furnished, move-in date, bills included, and number of roommates.
- Replace the inert sort button with a real select/menu: relevance, newest, price low-to-high, price high-to-low.
- Persist filters in URL query parameters so links can be shared and browser Back works.
- Add a “Počisti filtre” action and display active filters as removable chips.
- Use Slovenian pluralisation: `1 oglas`, `2 oglasa`, `4 oglasi`, `5 oglasov`.

**Suggested result header:**

```text
24 oglasi
[Center ×] [do 450 € ×]                         Razvrsti: Najbolj ustrezni
```

#### C. Finish the listing-to-contact flow

**Problem:** The primary detail CTA, “Pošlji zahtevo za ujemanje”, has no feedback or next step.

**Recommended solution:**

- Open a confirmation dialog containing the listing title and a short optional message.
- Show sending, success, and failure states.
- After success, offer “Odpri klepet” and “Nazaj na oglase”.
- Disable duplicate submissions and make the request status visible on the listing.
- Add a report/safety action near the contact CTA.

### P1 — improve decision quality and confidence

#### D. Upgrade listing cards from decorative placeholders to decision cards

Use real listing photos with a consistent aspect ratio, a photo count indicator, and a fallback illustration. Keep the current compact metadata, but add:

- total monthly estimate (rent + expected bills);
- “stroški vključeni” as a filterable badge;
- verified landlord/listing indicator with a tooltip or details link;
- compatibility score only when it is explainable, for example “92% — podobne navade spanja”.

Avoid showing a score without explaining the signals behind it.

#### E. Improve the detail page

Recommended layout:

1. photo gallery with thumbnails and keyboard-accessible lightbox;
2. sticky summary on desktop with price, availability, and primary CTA;
3. clearly separated sections for “O prostoru”, “O sostanovalcih”, “Stroški”, “Pravila doma”, and “Lokacija”;
4. landlord/student verification and response-time information;
5. safety guidance before contacting someone.

Do not silently substitute the first listing for an invalid ID. Render a not-found state and preserve the normal recovery path.

#### F. Finish chat navigation

Create `/chats/[id]` with:

- conversation header and verification indicator;
- message history, timestamps, and delivery state;
- composer with disabled/loading/send states;
- listing context card at the top;
- report/block controls in an overflow menu.

Until this exists, chat rows should not link to a route that renders the not-found page.

### P2 — polish and accessibility

#### G. Make all controls keyboard and screen-reader complete

- Add a global `:focus-visible` style with at least 2px contrast against the background.
- Give icon-only buttons descriptive labels and visible pressed/active states.
- Use real icons (or an icon library) instead of ambiguous text glyphs such as `♧`, `⌂`, and `◉`.
- Ensure custom toggle state exposes `aria-pressed` or a native checkbox/switch pattern.
- Add `aria-live="polite"` for result-count and save/send feedback.
- Confirm colour contrast for muted text, amber chips, and focus indicators.
- Test at 200% zoom and with keyboard-only navigation.

#### H. Improve mobile task flow

- Keep the mobile navigation, but add an elevated primary “Iskanje” action when users are on the dashboard.
- Make the filter panel a bottom sheet or full-screen filter view on small screens.
- Keep a sticky “Filtri” / result count bar while browsing results.
- Make listing cards one-column and photo-led on phones.
- Ensure the bottom navigation does not cover the last card or CTA by adding safe-area/padding space.

#### I. Add real feedback states

Every async or future data-backed screen should have:

- skeleton loading state matching the final card geometry;
- empty state with a direct next action;
- recoverable error message with retry;
- success toast/dialog for save, match request, and profile changes.

The current shared loading/error/not-found files are a good foundation; wire them into actual data states instead of only route-level failures.

## 5. Suggested visual direction

Keep the existing green/amber palette and card language, but move from “dashboard prototype” toward “trustworthy marketplace”:

- use photography and people/room context as the dominant visual;
- reserve amber for attention and recommendations, not primary controls;
- use one strong primary CTA per view;
- reduce decorative emoji where it competes with listing information;
- introduce a small spacing/type scale so cards, dialogs, and forms feel related;
- add a subtle but explicit status system: verified, new, pending, saved, request sent, unavailable.

### Component patterns to build

1. `ListingCard` with shared favorite action and optional compatibility/rent breakdown.
2. `FilterBar` + `FilterSheet` with URL state and removable chips.
3. `SaveToast` with undo.
4. `MatchRequestDialog`.
5. `ListingGallery`.
6. `StatusBadge` with accessible text.
7. `EmptyState`, `ErrorState`, and `SkeletonListingCard`.
8. `ChatThread` and `MessageComposer`.

## 6. Research notes and sources

These are implementation references and design patterns, not assets or screens to copy verbatim. Reuse the principles and adapt them to RoomieSlo’s Slovenian student audience and brand.

### Material Design 3

- [Cards](https://m3.material.io/components/cards/overview) — use cards to group related content, preserve clear hierarchy, and avoid overloading one card with unrelated actions.
- [Text fields](https://m3.material.io/components/text-fields/overview) — use persistent labels, clear field states, and supporting/error text rather than relying on placeholders alone.
- [Navigation bar](https://m3.material.io/components/navigation-bar/overview) — a mobile navigation bar is appropriate for a small number of top-level destinations; keep labels visible and preserve the active state.

**RoomieSlo application:** keep the existing card grid, but make the heart action and card destination unambiguous; use a mobile filter sheet and keep the current five-item mobile navigation.

### Nielsen Norman Group

- [10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) — especially visibility of system status, user control and freedom, error prevention, recognition rather than recall, and aesthetic/minimalist design.

**RoomieSlo application:** show save/request progress and outcomes, provide Undo, expose active filters, and do not present inert controls as if they work.

### W3C WCAG 2.2

- [Focus Visible (SC 2.4.7)](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) — every keyboard-operable control needs a persistent visible focus indicator.

**RoomieSlo application:** add `:focus-visible` to links, buttons, inputs, toggles, and navigation items; test the full search-to-contact journey without a mouse.

### GOV.UK Service Manual

- [Design and prototyping](https://www.gov.uk/service-manual/design) — start from user tasks, use established design patterns, prototype risky interactions, and test with real users.

**RoomieSlo application:** prototype the match-request dialog, filter sheet, and safety/report flow before adding more decorative dashboard content.

## 7. Recommended implementation order

1. Shared favorite state + real favorites empty/saved states.
2. Search URL state, active filter chips, clear filters, and working sort.
3. Match-request dialog with success/error feedback.
4. Real detail-page sections and invalid-ID not-found behavior.
5. Chat detail route and safe messaging controls.
6. Loading/error/success feedback components.
7. Focus-visible, semantic toggles, live regions, contrast, and keyboard pass.
8. Photo-based listing cards, gallery, and responsive filter sheet.
9. Real authentication/profile persistence.

## 8. Definition of done for the next UI milestone

- A user can search, filter, sort, open a listing, save it, find it under favorites after reload, and remove it.
- A user can send a match request and see an explicit success or error outcome.
- All visible buttons either work or are removed until their behavior exists.
- Chat rows lead to a real conversation view or are clearly marked unavailable.
- Keyboard users can see focus and complete the primary journey.
- Empty, loading, error, and success states are designed in the same visual system.
- Mobile users can filter results without losing context or having content covered by navigation.
