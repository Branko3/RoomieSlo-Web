# Cohabitation declarations and roommate ratings: plan

- Status: Approved 2026-10-16 (Branko). Implemented: Part A (`docs/features/cohabitation-declarations.md`) and Part B (`docs/features/roommate-ratings.md`); the LIA (`roommate-ratings-lia.md`) awaits sign-off
- Date: 2026-10-16
- Owner decisions so far (2026-10-16):
  - the public view is an aggregate plus tags,
  - tags only, no free-text comments,
  - cohabitation is built first, and ratings are built on top of it,
  - the thresholds in §4 are accepted (3 ratings, 2-month window, 14-day blind period, 36-month retention),
  - users can hide their ratings (§4.5); changed later on 2026-10-16: showing ratings is **opt-in** (off by default), and ratings are still collected while it's off,
  - profiles are for university students aged 18 or older,
  - summaries appear on profiles and recommendation cards only, not on listings,
  - the data controller is Branko personally; the thesis is finished and this is no longer thesis work,
  - no in-app dispute process: unfair ratings are handled manually by the owner (§4.6).
- Related: `research-data-and-cohabitation.md` (research use of cohabitations; separate and still awaiting approval), `roommate-matching-psychology.md`, `docs/features/account-document-deletion-retention-rules.md` (needs amending), `docs/features/chat-and-match-authorization.md`, `docs/features/report-block-chat-controls.md`

## 1. Goal

Make users feel safer choosing a roommate by showing whether people who actually lived with someone would do it again. This must not create a tool for revenge, social pressure, or public shaming. Ratings are a trust signal, not a verdict.

## 2. Design principles (and why)

| Principle                                                               | Reason                                                                                                                                                                                             |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Only verified cohabitants rate**                                      | Both people must confirm "Živiva skupaj". This prevents fake, revenge or "drive-by" ratings from people who only chatted                                                                           |
| **Double-blind reveal**                                                 | Neither side sees anything until both have rated or the wait has expired (Airbnb's model). Fear of retaliation otherwise pushes every rating to the top, and the signal becomes meaningless        |
| **Nothing shown below 3 ratings**                                       | With one or two raters, the rated person would know who said what. A threshold of 3 protects raters and makes the aggregate meaningful                                                             |
| **"Would live again" + positive tags in public, negative tags private** | Strengths are shown publicly. Problems reach only the rated person, aggregated, as feedback they can act on. This avoids publicly labelling someone "neurejen(a)" (untidy) based on a few opinions |
| **No free text**                                                        | No moderation burden, little risk of defamation, and no identifying details. Serious problems go through the existing report flow                                                                  |
| **No stars or averages**                                                | Star ratings inflate (nearly everything ends up at 4.8 or above) and punish people with few ratings. A ratio ("3 od 4") is honest about how little data there is                                   |
| **Ratings expire**                                                      | People change, and GDPR requires data to be accurate and kept only as long as needed. Only ratings from the last 36 months count, and older ones are deleted                                       |

## 3. Part A: Cohabitation declaration (built first)

The research use described in `research-data-and-cohabitation.md` is **not** part of this plan. No research consent, snapshots or check-ins.

### Behaviour

1. **Declare.** In an accepted chat, the conversation menu offers "Živiva skupaj" ("We live together"). The user picks the move-in month: not in the future, and not before the month the match was created.
2. **Confirm.** The other person sees a banner in that chat: "<Ime> pravi, da živita skupaj od <okt. 2026>." ("<Name> says you've lived together since <Oct 2026>.") The options are **Potrdi** (Confirm) and **Ne drži** (That's not true). The chat list marks the conversation as needing attention. "Ne drži" closes the declaration, and the declarer sees "Ni potrjeno" (Not confirmed) without any reason.
3. **Active.** Only that chat shows "Živita skupaj od okt. 2026", with the action "Ne živiva več skupaj" ("We no longer live together"). The profile section "Moje sobivanje" (My cohabitation) lists the user's own cohabitations. When a cohabitation becomes active, the app suggests switching off "Išče sostanovalca" (Looking for a roommate), but doesn't do it automatically.
4. **End.** Either person can end it alone, giving an end month. There is no reason field here: reasons belong to the research proposal.
5. **Visibility.** Nobody except the two participants can see a cohabitation. In-app admins can't see it either; only the database owner can, through Supabase. It never appears on profiles, in recommendations or in search.
6. **Limits.** Each match can have at most one open declaration (pending or active). After "Ne drži", the same person can't declare again for 30 days, so the other person isn't pestered.

### Blocking and deletion

- **Block:** a pending declaration becomes `declined`. An active one stays as it is, because the people may still live together, and either side can still end it.
- **Account deletion:** pending declarations become `declined`, and active ones become `ended` with the current month. The row stays, so the other person's rating window (§4) still works and their history stays correct.

## 4. Part B: Ratings

### 4.1 Who can rate, and when

- Only participants of a **confirmed** cohabitation can rate, and each person rates the other once per cohabitation.
- **The window opens** two months after the move-in month, or when the cohabitation ends if that's sooner. Two months is long enough to have real experience, and short enough to catch early failures.
- **The window closes** 60 days after the cohabitation ends. If the pair is still living together, the window stays open and the rating can be updated once every 6 months. Only the latest version counts.
- **Reminders:** a banner in the chat when the window opens and 7 days before it closes. There are no push notifications in the app yet.

### 4.2 What the rater answers

1. **"Bi spet živel(a) s to osebo?"** ("Would you live with this person again?") **Da / Ne.** This answer is required. It is the core public signal and the main outcome measure.
2. **Strengths:** up to 3 tags, optional, public in aggregate. The six options:
   - Zanesljiv(a) pri stroških (reliable with costs)
   - Čist(a) in urejen(a) (clean and tidy)
   - Spoštuje mir in počitek (respects quiet and rest)
   - Dobra komunikacija (good communication)
   - Upošteva dogovore (keeps agreements)
   - Prijeten/-tna sostanovalec/-ka (pleasant to live with)
3. **Areas to improve:** up to 3 tags, optional, **only the rated person sees them**, in aggregate. Each mirrors one strength:
   - Stroški (costs)
   - Čistoča (cleanliness)
   - Hrup (noise)
   - Komunikacija (communication)
   - Dogovori (agreements)
   - Obiski (visitors)

Tags are written as behaviour, not character ("Hrup", not "Glasen/-na"), so they read as feedback, not labels. The form shows "Ocena je anonimna in vidna šele, ko oceni tudi druga oseba ali po 14 dneh." ("The rating is anonymous and becomes visible only once the other person also rates, or after 14 days.")

### 4.3 Reveal

A rating is `hidden` until one of the following happens. Then it becomes `revealed` and counts:

- the other participant also submits their rating,
- 14 days pass since this rating was submitted,
- the rating window closes.

Only revealed ratings count anywhere.

### 4.4 What people see

| Viewer                                         | Fewer than 3 revealed ratings                                                                      | 3 or more revealed ratings                                                                                                                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Other users** (profile, recommendation card) | "Še ni dovolj ocen" ("Not enough ratings yet"), worded neutrally so it doesn't read as negative    | "**3 od 4** sostanovalcev bi spet živeli s to osebo" ("3 of 4 roommates would live with this person again"), plus up to 3 of the most common strengths with counts ("Čist(a) in urejen(a) · 3") |
| **The rated person**                           | Their own count ("2 oceni, prikazane bodo od 3 dalje": 2 ratings, shown from 3 onward). No content | The same as the public view, plus "Področja za izboljšanje", the improvement tags with counts. Never which rater gave which                                                                     |
| **The rater**                                  | Their own submitted rating (editable while still hidden)                                           | The same                                                                                                                                                                                        |

Counting rules:

- Only ratings from the last 36 months count.
- The ratio is "Da" answers out of all revealed ratings.
- Tag counts are listed by frequency, with ties broken by tag order.

### 4.5 Opting out (GDPR right to object)

**Changed by the owner on 2026-10-16: opt-in.** The profile setting **"Prikaži ocene sostanovalcev"** ("Show roommate ratings") is **off by default**. While it's off, ratings are still collected, but only the rated person sees them (their own aggregate on `/profile`), and other users see nothing about ratings for that person: no line, no "hidden" label, so an unset preference never looks like hiding something. When the person turns it on, others see the summary (from 3 ratings). The person can turn it off again at any time.

A formal objection (by e-mail to the controller) goes further than the toggle: that person's received ratings are deleted (`docs/operations/privacy-procedures.md`).

_Original design (superseded): on by default, with "Ocene so skrite" shown when off._

### 4.6 Unfair ratings (manual, no in-app process)

- There is no dispute form and no admin screen. The safeguards above already limit the damage of a single unfair rating: verified cohabitants only, double-blind, nothing below 3, aggregate only, 36-month expiry, and the option to hide ratings.
- A user who thinks a rating is unfair, or fake (e.g. "we never lived together"), writes to the contact e-mail on `/privacy`. The owner checks the cohabitation and ratings directly in Supabase and, if the rating is unfair, deletes it. This also covers the GDPR right to rectification.
- The owner never tells the rated person who gave a rating.
- Pressure to rate well ("give me a good rating or else") goes through the existing report and block flow. A block doesn't stop the blocking person from rating.

## 5. Data model (planned)

```
public.cohabitations (
    id uuid pk,
    match_id uuid not null references matches on delete cascade,
    user_id_a uuid not null, user_id_b uuid not null,      -- copied from the match
    initiated_by uuid not null,
    status text check (status in ('pending','active','declined','ended')),
    started_month date not null,                            -- first day of the month
    ended_month date,
    declined_at timestamptz, confirmed_at timestamptz, ended_at timestamptz,
    version integer not null default 1,
    created_at timestamptz not null default now()
)
unique index: one open (pending|active) row per match_id

public.roommate_ratings (
    id uuid pk,
    cohabitation_id uuid not null references cohabitations on delete cascade,
    rater_id uuid not null, rated_id uuid not null,
    would_live_again boolean not null,
    strengths text[] not null default '{}',                -- validated against the fixed set, max 3
    improvements text[] not null default '{}',             -- validated, max 3, private
    status text check (status in ('hidden','revealed')),
    submitted_at timestamptz, revealed_at timestamptz, updated_at timestamptz,
    unique (cohabitation_id, rater_id)
)

public.profiles + show_roommate_ratings boolean not null default true
```

### Authorization

The `chat-and-match-authorization` approach: RLS plus security-definer RPCs, with no direct writes.

- `cohabitations`:
  - **select:** participants only.
  - **No insert or update policies.** All changes go through `declare_cohabitation(match_id, started_month)`, `respond_cohabitation(id, confirm boolean)` and `end_cohabitation(id, ended_month)`.
  - **The RPCs check:** the caller is a participant, the match is accepted, no block exists for declare and confirm, neither profile is deleted, the month rules and the 30-day cooldown hold, and only the _other_ person can confirm.
- `roommate_ratings`:
  - **select:** the rater's own rows only.
  - **Writes:** only through `submit_roommate_rating(cohabitation_id, would_live_again, strengths, improvements)`, which checks the window and validates the tags.
  - **The rated person never reads rows.** They get counts only, from `my_rating_summary()`.
- `rating_summary(profile_id)`: security definer. It returns aggregates only, and only when there are at least 3 revealed ratings within 36 months, the profile's opt-out is off, and the profile isn't deleted. Otherwise it returns `{ state: 'insufficient' | 'hidden' }`. The `recommendations` Edge Function and the profile page call it.
- **Reveal:** submitting a rating reveals the pair's two ratings once both exist. The daily `purge_expired_data()` job, or a sibling job, reveals ratings after 14 days or at window close, and deletes ratings older than 36 months.

## 6. Retention and privacy (amends the approved matrix; needs a new approval entry)

| Data                               | Behaviour                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Cohabitations                      | Kept while either participant's account exists. Deleted once both are tombstones, together with their ratings    |
| Ratings received by a deleted user | Deleted when that user deletes their account                                                                     |
| Ratings given by a deleted user    | Kept in the rated person's aggregate, linked only to the tombstone, until 36 months after the cohabitation ended |
| All ratings                        | Deleted 36 months after the cohabitation ended, or at the latest submission if it's still active                 |

- **Legal basis:** legitimate interest (GDPR Art. 6(1)(f)), meaning other users' interest in safely choosing a roommate. Before launch, document a **balancing test** (LIA) in the same folder. The safeguards in §2 and §4 are the balancing measures.
- **Transparency:** `/privacy` gets a "Ocene sostanovalcev" (Roommate ratings) section. The "Živiva skupaj" dialog says "Ko živita skupaj, se lahko po dveh mesecih anonimno ocenita." ("Once you live together, you can rate each other anonymously after two months.")
- **Data export (access right):** it includes ratings the user gave, the user's own cohabitations, and the aggregates the user has received. It never includes who rated them, because the rights of others take precedence (Art. 15(4)).
- **Research:** ratings are **not** research data and never feed the private check-ins. If the research proposal is approved, using ratings there would need its own consent clause.

## 7. Delivery steps (each a separate PR, in this order)

1. **Cohabitation migration:**
   - the table, RLS, the three RPCs and the cooldown;
   - the block hook, and the deletion trigger extension in `handle_deleted_user`;
   - retention in `purge_expired_data`;
   - static migration tests, like `tests/chat-match-authorization.test.ts`.
2. **Cohabitation UI:**
   - `lib/cohabitation/` with the client calls, error mapping and month rules;
   - the chat menu entry and confirm banner, alongside `components/chat-safety-controls.tsx`;
   - the chat list attention mark and the "Moje sobivanje" section on `/profile`;
   - unit and component tests.
3. **Ratings migration:**
   - the table, `show_roommate_ratings`, `submit_roommate_rating`, `rating_summary` and `my_rating_summary`;
   - the reveal and expiry rules in the daily job;
   - migration tests, including the threshold of 3, the 36-month window and opt-out.
4. **Ratings UI:**
   - the window banner and rating form in the chat;
   - the summary on the profile and recommendation cards (the `recommendations` function adds the summary); not on listings;
   - the opt-out toggle and the "Področja za izboljšanje" view on `/profile`;
   - Slovenian plural forms ("1 ocena, 2 oceni, 3 ocene, 5 ocen"), following the existing pluralization feature.
5. **Policy and documentation:**
   - the retention matrix amendment with an owner approval entry;
   - the LIA, the `/privacy` text, the delete-account page copy and the data export;
   - feature records in `docs/features/`;
   - an update to `docs/web-feature-status.md`.

Integration tests (RLS: a participant can't read the other person's rating, a third party sees nothing, the rated person gets aggregates only) are written with each migration. Like the existing ones, they run only once a staging project exists.

## 8. Open decisions for the owner

1. **Controller details in `/privacy`.** Replace the thesis wording with the owner's name and a contact e-mail (and an address, if one is to be published) before ratings go live. That e-mail is also how users report an unfair rating (§4.6).
