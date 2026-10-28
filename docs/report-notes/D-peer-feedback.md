# Stream D: post-hackathon peer feedback

## D.1: Pure feedback rules and aggregation  (2026-10-28, Claude)
- **What was built:** The rules behind peer feedback, with no database access. A 14-day window opens when a hackathon ends, only teammates can rate each other (never yourself), up to 5 skills per teammate, and several raters' levels combine into one peer level per skill.
- **Design decisions:** Lower median of the ratings (BEGINNER 2, INTERMEDIATE 3, ADVANCED 4) rather than the mean, so one outlier cannot move the result and the level stays on the existing 2-4 grid scale. Rater count is distinct raters per slug, not rows. Output is sorted by slug so the stored payload is deterministic. Reused `SkillRatingLevel` from lib/skills.ts instead of a new type. `RuleResult` is declared locally (same shape as lib/team-rules.ts) to avoid depending on an unmerged branch.
- **Files:** created `lib/peer-feedback-core.ts`, `tests/peer-feedback-core.test.ts`; modified `docs/report-notes/D-peer-feedback.md`.
- **Schema:** none.
- **Tests:** `tests/peer-feedback-core.test.ts`, 20 tests: window boundaries, refusal rules and messages, input validation, median/rater aggregation, round-trip through `peerSkillsFromPayload`.
- **Numbers for the report:** about 85 lines of code, 20 tests.
- **Problems hit:** none.
- **Screenshots to take:** none.
- **UML impact:** none directly; the feedback activity diagram gains the window and teammate checks.
