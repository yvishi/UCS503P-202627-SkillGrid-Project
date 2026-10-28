# Stream E: integration tests and pilot metrics

## E.2: Pilot metrics script  (2026-10-28, Claude)
- **What was built:** `npx tsx scripts/pilot-metrics.ts --since <date> [--until <date>]` loads users created in the window and prints a Markdown table: users, median TTVP, completion rate, evidence coverage (any source, and resume plus GitHub), parse precision, teams formed, invite accept rate and peer feedback rate, with the targets (TTVP <= 10 min, coverage >= 60%). The table pastes straight into the Results chapter.
- **Design decisions:** All arithmetic is in the pure `lib/pilot-metrics-core.ts` so it is unit-tested without a DB; the script only loads rows. Parse precision is pooled (sum of kept-and-extracted over sum extracted), not an average of per-user ratios, matching the report definition; kept skills that were never extracted do not raise it. Any zero denominator returns `null` (printed `n/a`) instead of `NaN` or 0, so an empty pilot cannot look like a 0% result. Coverage is over onboarded profiles; completion is over all users created. Active resume is resolved with `findActiveResumePayload` per user (one extra query per user) rather than one big raw query, to reuse the app's own logic. Rejected: counting a raw EvidenceRecord count for coverage, because the report defines it per profile.
- **Files:** `code/frontend/lib/pilot-metrics-core.ts`, `code/frontend/scripts/pilot-metrics.ts`, `code/frontend/tests/pilot-metrics-core.test.ts`.
- **Schema:** none (read-only on users, profiles, evidence_records, user_skills, teams, team_members, team_invites, peer_feedback).
- **Tests:** `tests/pilot-metrics-core.test.ts`, 12 tests: median of 4/8/30 is 8, even-count median, no-evidence users excluded from TTVP but counted in completion, coverage over onboarded only, nulls on empty input, pooled precision (a,b,c,d vs a,b = 0.5), team rates and null denominators, table formatting and targets. Suite: 98 before, 110 after.
- **Numbers for the report:** about 283 lines added (88 core, 79 script, 116 tests). Smoke run on 4 fake users: TTVP 13.0 min, completion 75.0%, coverage 66.7% / 33.3%, precision 40.0%, accept 50.0%, feedback 50.0%; each value hand-checked against the seeded rows.
- **Problems hit:** `npm ci` took about 4 minutes on Windows and backgrounded the shell; no code impact. Team metrics are windowed by createdAt of the team and invite; the report should say so.
- **Screenshots to take:** terminal output of the script after the real pilot.
- **UML impact:** none.
- **CI run links:** see the PR checks.
