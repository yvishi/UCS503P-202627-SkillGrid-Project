# Stream A: evidence-weighted skill scoring

## A.1: Pure scoring core  (2026-10-28, Claude)
- **What was built:** `skillScore = round(45*github/4 + 25*peers/4 + 20*resume + 10*self/4)` and a profile score equal to the rounded mean of the top 5 skill scores, zero-padded. Weakest GitHub (22.5, rounds to 23) beats a resume mention (20), which beats the strongest self-rating (10). Pure functions, no DB.
- **Files:** `lib/skill-score-core.ts`, `tests/skill-score-core.test.ts`.
- **Tests:** 4 tests. PR #19.
- **Manual checks pending:** none.

## A.2: Store scores and recompute on every evidence change  (2026-10-28, Claude)
- **What was built:** Scores are stored in `skill_scores` (one row per user and skill, only scores above 0) and `profiles.evidenceScore`, so discovery sorts with a plain indexed query. `recomputeUserScores(userId)` loads evidence the way the skill grid does (active resume, GitHub, peers, self), skips slugs the catalog does not know, and replaces the user's rows in one transaction. It is called after every evidence write: GitHub connect, resume upload and switch, onboarding submit, skill add, level change and remove, and admin approve or merge of a reported skill (for every affected reporter). A backfill script fills existing users; `--check` compares stored against fresh values and exits 1 on a mismatch.
- **Weights:**

| Source | Weight | Strength | Max points |
|---|---|---|---|
| GitHub | 45 | grid level / 4 | 45 |
| Peers | 25 | grid level / 4 | 25 |
| Resume | 20 | 1 if named, else 0 | 20 |
| Self | 10 | grid level / 4 (BEGINNER 2, INTERMEDIATE 3, ADVANCED 4) | 10 |

- **Worked example** (test user, resume names python and sql, GitHub python level 4 and react level 2, self-rated python ADVANCED):

| Skill | Self (10) | Resume (20) | GitHub (45) | Peers (25) | Score |
|---|---|---|---|---|---|
| python | 4 -> 10 | yes -> 20 | 4 -> 45 | 0 | 75 |
| react | 0 | no | 2 -> 22.5 | 0 | 23 |
| sql | 0 | yes -> 20 | 0 | 0 | 20 |

  Profile evidence score = round((75 + 23 + 20 + 0 + 0) / 5) = 24. After removing the python self-rating and adding sql as INTERMEDIATE: python 65, react 23, sql 28 (20 + 7.5), evidence score 23.
- **Design decisions:**
  - A failed recompute is caught and logged, never failing the user's action, because the evidence write has already committed. The alternative (one transaction around both) was rejected because the GitHub and resume writes live in different layers.
  - A user without a Profile row gets `SkillScore` rows but no profile update (`updateMany`).
  - `approveGroup` and `mergeGroup` return the affected user ids (`userIds` on the ok result) instead of the admin action re-querying them before resolving, which would race with the resolve transaction.
  - Delete-then-insert of a user's rows rather than diffing: simpler, and the set per user is at most a few dozen rows.
- **Files:** created `lib/skill-score.ts`, `prisma/scripts/backfill-scores.ts`; modified `lib/skill-review.ts`, `app/api/github/callback/route.ts`, `app/(protected)/profile/resume/actions.ts`, `app/onboarding/actions.ts`, `app/skills/actions.ts`, `app/admin/skill-requests/actions.ts`.
- **Schema:** none (uses `SkillScore`, `Profile.evidenceScore`, `Profile.scoreUpdatedAt` from Wave 0).
- **Tests:** existing suite unchanged (122 pass). Behaviour verified by a throwaway script against a local DB: the two recomputes above, a no-profile user, then backfill (`users=1 skillRows=3`), `--check` (exit 0), a deliberately corrupted `evidenceScore` (check reported the mismatch and exited 1), and a re-backfill that fixed it.
- **Problems hit:** the three previously unhooked write sites (picker removal, resume switch, admin approval) are exactly the stale-discovery risk in the review list; each is now hooked.
- **Screenshots to take:** none needed.
- **UML impact:** sequence diagram for "evidence write -> recompute -> skill_scores".
- **Manual checks pending:** browser sign-in flows (GitHub OAuth connect, resume switch in the UI, skill removal on `/profile/skills`, admin approval) were not run in a browser; they are replaced by the script above. To do by hand: connect GitHub and see `profiles.evidenceScore` change, remove a skill and see its `skill_scores` row go, then run `--check`.
