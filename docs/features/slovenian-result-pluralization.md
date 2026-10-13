# Slovenian result pluralization

- Status: Implemented
- Date: 2026-10-13
- Web surfaces: `/search` result count, `lib/listings/result-label.ts`
- Android behavior preserved: not applicable (Android shows no result count)

## Behavior

The `/search` heading ("N … zate") now uses the correct Slovenian form for every count: singular, dual and plural, decided by the last two digits:

| Count ends in (mod 100)  | Form    | Example                           |
| ------------------------ | ------- | --------------------------------- |
| 1                        | oglas   | 1 oglas, 101 oglas                |
| 2                        | oglasa  | 2 oglasa, 102 oglasa              |
| 3, 4                     | oglasi  | 3 oglasi, 104 oglasi              |
| anything else (0, 5–100) | oglasov | 0 oglasov, 11 oglasov, 21 oglasov |

Before, 2 showed "2 oglasi" (missing dual), and counts above 100 used the plural ("101 oglasov").

## Acceptance criteria

- [x] Dual form for 2 (and 102, 202, …).
- [x] The mod-100 rule for counts above 100, which "Naloži več" can reach.

## Implementation

`listingCountLabel(count)` in `lib/listings/result-label.ts`; `app/search/page.tsx` uses it.

## Testing contract

- Unit: `tests/result-label.test.ts` (15 cases, including 0, 11–12, 21 and 101–111).

## Handoff to testing

None beyond the unit table.

## Test status

- Automated status: Covered
- Test files: `tests/result-label.test.ts`
- Scenarios covered: all four forms and the mod-100 rule
- Remaining gaps: None
- Manual testing: Not run unless explicitly requested
