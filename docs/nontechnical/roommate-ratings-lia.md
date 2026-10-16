# Roommate ratings: legitimate-interest assessment (LIA)

- Status: Prepared 2026-10-16 for the data controller's sign-off (Branko)
- Processing: roommate ratings as specified in [cohabitation-and-ratings.md](cohabitation-and-ratings.md), Part B; implemented in `docs/features/roommate-ratings.md`
- Legal basis assessed: GDPR art. 6(1)(f) (legitimate interests)

A legitimate-interest assessment has three parts: the purpose, the necessity and the balancing
test. If any part fails, art. 6(1)(f) can't be used.

## 1. Purpose

**The interest.** Users want to choose a roommate safely. A shared flat means shared money, a
shared space and a shared daily routine. A bad match costs money, wellbeing and sometimes safety.
Whether people who actually lived with someone would do it again is the most direct evidence a
future roommate can get.

**Whose interest.** The other users' (third parties'), and the service's interest in being a
trustworthy place to find a roommate.

**Is it legitimate?** Yes. It is lawful, clearly stated, and a real, present interest rather than
a speculative one.

## 2. Necessity

Could the purpose be reached with less data, or with less intrusion?

- **Profiles and the questionnaire** describe what people say about themselves, not how they
  actually behave as roommates. They don't serve the purpose.
- **Free-text reviews** would say more, but carry a much higher risk of defamation, of identifying
  details, and of moderation work. They were rejected.
- **Star ratings or averages** inflate, and punish people with few ratings. They were rejected.

The chosen design processes the minimum:

- one yes/no answer;
- up to 3 strengths, from 6 fixed behaviour tags;
- up to 3 private improvement tags, also from 6 fixed tags;
- only between confirmed cohabitants;
- only as aggregates.

The processing is therefore necessary and proportionate to the purpose.

## 3. Balancing test

### The rated person's interests and expectations

- **Reputation.** A negative signal can make it harder to find a roommate.
- **Expectations.** People who live together expect to be talked about in some way, but they don't
  expect a public verdict from a single person, or retaliation.
- **Accuracy.** People change over time, and a single rating can be unfair.
- **Vulnerable people.** Most users are students, and some are young adults.

### Safeguards (plan §2 and §4), which are the balancing measures

| Risk                                                                              | Safeguard                                                                                                                                                                |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fake or revenge ratings from people who only chatted                              | Only participants of a cohabitation that **both** confirmed ("Živiva skupaj") can rate, and only once per cohabitation                                                   |
| Fear of retaliation pushes ratings to the top, or ratings are used as retaliation | **Double-blind**: a rating stays hidden until both have rated, 14 days pass, or the window closes                                                                        |
| The rated person could tell who said what                                         | **Nothing is shown below 3** ratings. Only aggregates are shown, never who gave which rating, anywhere (not even in the data export, art. 15(4))                         |
| A public label from a few opinions                                                | Only "would live again" and **strengths** are public. **Improvement tags are private** to the rated person. Tags describe behaviour, not character                       |
| Defamation, identifying details, moderation burden                                | **No free text**                                                                                                                                                         |
| Outdated or inflated signals                                                      | No stars or averages; a ratio ("3 od 4") is honest about how little data there is. Only ratings from the **last 36 months** count, and older ones are deleted            |
| Objection (art. 21)                                                               | "Prikaži ocene sostanovalcev" lets the person hide their ratings at any time. Others then see "Ocene so skrite", so the objection is respected without misleading others |
| Unfair ratings                                                                    | They can be reported to the controller's e-mail. The owner checks them and deletes unfair ones (also covering rectification, art. 16). The rater is never revealed       |
| Pressure to rate well                                                             | It goes through the existing report and block flow                                                                                                                       |
| Ratings shown out of context                                                      | Summaries appear only on profiles and recommendation cards, never on listings                                                                                            |
| Access by staff                                                                   | In-app admins have no access. Only the database owner can see ratings, through Supabase                                                                                  |

### Transparency

- `/privacy` has an "Ocene sostanovalcev" section covering the legal basis, what is shown, the
  threshold, the 36 months, hiding, and the contact for unfair ratings.
- The "Živiva skupaj" dialog tells both people that they can rate each other after two months.
- The rating form says the rating is anonymous and when it becomes visible.

### Assessment

With these safeguards, the impact on the rated person is limited and foreseeable:

- it is aggregated;
- it needs at least 3 independent cohabitants;
- it expires;
- the rated person can hide it.

The other users' interest in a real, verified trust signal is significant. On this basis, the
balance favours the processing.

**This conclusion is the data controller's to confirm.** The owner should record the sign-off
here.

## 4. Review

Review this assessment:

- before ratings go live in production (and set the contact e-mail on `/privacy`);
- if the threshold, tags, visibility or retention change;
- after the first complaint about an unfair rating, or every 12 months.

## Sign-off

- [ ] Branko (data controller), date: ________
