# Listing version bump and feed keyset index

- Status: Blocked
- Date: 2026-10-13
- Web surfaces: Postgres `listings` (trigger and index); used by `/listings/[id]/edit` (version check) and the `/search` and `/listings` feeds (keyset pages)
- Android behavior preserved: Android edits listings and toggles `is_filled` without sending `version`. It keeps doing that; the database now bumps the version for it. Android's `created_at desc` ordering over available listings uses the same index prefix.

## Behavior

- **Version:** every update that changes any listing column other than `version` sets `version = old.version + 1`. A no-op update keeps it. A client can't set an arbitrary version. The web edit form's optimistic check (`… where version = expected`, sending `expected + 1`) now also detects Android edits and filled/available toggles. Before, an Android edit made in between was silently overwritten.
- **Index:** `listings_available_created_id_idx (created_at desc, id desc) where is_filled = false` matches the feed's order, filter and keyset condition. It replaces `listings_available_created_idx`, which has the same prefix and predicate.

## Acceptance criteria

- [x] Any change bumps `listings.version`, whoever makes it (static check).
- [x] The feed order and cursor condition have a matching index (static check).
- [ ] Verified on staging (blocked: no staging project).

## Implementation

- `supabase/migrations/20261013000100_listing_version_and_keyset_index.sql`: the `bump_listing_version()` `before update` trigger compares `to_jsonb(new) - 'version'` with `to_jsonb(old) - 'version'`, so columns added later are covered automatically. It runs for every role.
- No web code change: `lib/listings/listing-edit.ts` already sends `version: expected + 1`, which equals the trigger's result.

## Testing contract

- Unit: `tests/listing-version-and-keyset-index.test.ts` (static SQL plus the cursor condition).
- Integration (staging): an `is_filled` toggle bumps the version, after which a web edit with the old version gets the conflict message; a no-op update keeps it.
- Performance (staging): `explain` of the second feed page uses `listings_available_created_id_idx`.

## Handoff to testing

- Staging: open the edit form on the web, change the price on Android, then save on the web. The conflict message appears.
- Staging: `explain analyze` the keyset query with a cursor.

## Blocker

No staging Supabase project, so the migration has not been applied.

## Test status

- Automated status: Partially covered
- Test files: `tests/listing-version-and-keyset-index.test.ts`
- Scenarios covered: trigger logic and wiring, index definition, cursor condition shape
- Remaining gaps: staging execution and query plan
- Manual testing: Not run unless explicitly requested
