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

## D.2: Feedback page, action and write-back  (2026-10-28, Claude)
- **What was built:** `/hackathons/[slug]/feedback` lists the viewer's teammates, each with up to 5 of their self-rated skills and a three-level choice (reusing `SkillRatingRow`). Outside the window the page shows the window message instead of the form; a user with no team in the hackathon sees a plain message. `submitFeedbackAction` refuses non-teammates, self-rating, outside the window, and skills the target has not self-rated, all on the server. After each submission the target's single `PEER_FEEDBACK` record is rebuilt from all feedback they received (any hackathon) and their scores recomputed.
- **Design decisions:** Both users' `TeamMember` rows are looked up on the server from the session and `toUserId`; a team id from the client is never used. Allowed slugs are the target's self-rated skills, not the rater's. Delete-then-insert of the rater's rows runs in one transaction; the evidence rebuild is a second transaction after it commits, then `recomputeUserScoresSafely` (a failed recompute is logged, not surfaced, as in Stream A). Rebuild aggregates every `PeerFeedback` row for the user, so ratings from several hackathons combine; with no rows it only deletes the record. Page shows at most 5 skills per teammate, which also keeps the form under the 5-rating cap.
- **Write-back sequence (for the sequence diagram):**
  1. Rater submits the form; `FeedbackForm` calls `submitFeedbackAction(slug, {toUserId, ratings})`.
  2. The action reads the session user, loads the hackathon and both `TeamMember` rows.
  3. `feedbackWindow` + `canGiveFeedback` check window, self-rating and same team.
  4. `getUserSkills(target)` supplies allowed slugs; `parseFeedbackInput` validates the ratings.
  5. One transaction: delete rater's rows for (hackathon, rater, target), insert the new rows.
  6. `rebuildPeerEvidence(target)`: read all `PeerFeedback` for the target, `aggregatePeerEvidence`, then in one transaction delete and re-create the `PEER_FEEDBACK` `EvidenceRecord`.
  7. `recomputeUserScoresSafely(target)` rewrites `skill_scores` and `profiles.evidenceScore`.
  8. The action revalidates `/dashboard`; the target's grid reads the record through `peerSkillsFromPayload` and shows the Peers cell.
- **Files:** created `lib/peer-feedback.ts`, `app/(protected)/hackathons/[slug]/feedback/{page.tsx,actions.ts,FeedbackForm.tsx}`, `tests/integration/feedback.test.ts`; modified `docs/report-notes/D-peer-feedback.md`.
- **Schema:** none.
- **Tests:** `tests/integration/feedback.test.ts`, 6 tests: write-back with payload round-trip to `[{slug:"react", level:4}]` and evidence score increase, resubmit replaces, non-teammate, self, outside window (closed and not yet open), unlisted skill.
- **Problems hit:** none.
- **Screenshots to take:** the feedback page with two teammates; the target's dashboard grid with the Peers cell filled.
- **UML impact:** sequence diagram for the write-back above.
- **Manual checks pending:** browser run of the feedback page and the dashboard Peers cell (no browser available). Replaced by the integration tests, which cover the DB effects. The page route is also not linked from the hackathon page yet (Stream B owns that page).
