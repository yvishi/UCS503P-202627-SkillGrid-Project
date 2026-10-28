# Baseline: work finished after the mid-term report

The mid-term report was submitted on 17 Sep 2026. This file records what was finished after it. The first part covers the open skill catalog (branch `feature/open-skill-catalog`, merged into `Dev` through PR #14, merge commit `7d95a57`). The second part lists the Wave 0 foundation tasks of the second-half plan.

All commits are dated 15 Oct 2026 (author date), author yvishi. Line counts come from `git show --stat` for each commit. Counts of test cases are the values at the merge, not per commit. Paths are relative to `code/frontend/` unless they start with `docs/`.

## Numbers at the baseline (Dev at `7d95a57`)

- Test files in `tests/`: 10 (`*.test.ts`).
- Test cases: 95, all passing (`npx vitest run`, Vitest 3.2.4).
- Cases per file: `skill-normalize` 37, `skill-catalog-core` 10, `resume-matcher` 10, `github-skills` 8, `skill-grid` 7, `skill-report-input` 7, `seed-catalog` 6, `skill-review-core` 6, `admin` 2, `skill-suggestions` 2.
- Prisma migration folders in `prisma/migrations/`: 5 (`init`, `add_onboarding_fields`, `add_skill_ratings`, `add_active_resume_id`, `open_skill_catalog`).
- PR #14 changed 73 files (15,818 insertions, 4,288 deletions). That figure includes the spec, the plan and `package-lock.json`, so it overstates the code size.

## Spec and plan  (15 Oct 2026, yvishi)
- **What was built:** A design spec and an implementation plan for replacing the fixed list of 20 skills with a database catalog. No user-visible change.
- **Design decisions:** Users cannot create catalog skills. They report a missing skill and an admin approves, merges or rejects it, because free typing would let typos such as "Raect" into the catalog. Auto-detected skills from GitHub and resumes appear as evidence and as suggestions, and are not written into self-ratings. The old `Profile.skillRatings` column is kept until the data copy is verified on production, because `prisma migrate deploy` applies every pending migration at once and a drop in the same release would leave no point to verify.
- **Files:** `docs/superpowers/specs/2026-10-15-open-skill-catalog-design.md` (402 lines at commit `f08cfc0`), `docs/superpowers/plans/2026-10-15-open-skill-catalog.md` (5,617 lines, commit `b12eaea`).
- **Schema:** none in these commits.
- **Tests:** none.
- **Numbers for the report:** the spec plans a seed catalog of roughly 300 to 500 entries.
- **Problems hit:** the plan commit also edited the spec (96 lines changed) where mapping the design onto the code changed details: onboarding saves skills as they are picked, search runs over a cached catalog, and GitHub-created skills match resumes case-sensitively.
- **Screenshots to take:** none.
- **UML impact:** none directly; the spec is the source for the class diagram change below.

## Vitest and skill-name normalisation  (commit `84f4d80`)
- **What was built:** The first automated tests in the project, and the pure helpers that decide when two spellings are the same skill: "React.js", "react js" and "ReactJS" reduce to one key; "C++" and "C#" keep their symbols.
- **Design decisions:** Pure functions in `lib/skill-normalize.ts` with no database access, so they can be tested with Vitest alone. The helpers are `skillKey`, `toSlug`, `validateSkillName` and `editDistance`, plus a `LEGACY_SLUGS` map for the two retired combined slugs (`pytorch-tensorflow`, `pandas-numpy`). The commit and spec do not record an alternative test runner.
- **Files:** created `lib/skill-normalize.ts` (94 lines), `tests/skill-normalize.test.ts` (102 lines), `vitest.config.mts`; modified `package.json`, `package-lock.json`.
- **Schema:** none.
- **Tests:** `tests/skill-normalize.test.ts`, 37 cases. The spec lists the spellings above, whitespace-only and URL input as covered.
- **Numbers for the report:** 5 files changed, 1,815 insertions (most of it the lockfile).
- **Problems hit:** none recorded in the commit.
- **Screenshots to take:** none.
- **UML impact:** none.

## Skill catalog tables, legacy migration and seed  (commit `6532e4b`; search in `d2f3d5b`)
- **What was built:** Skills now live in a database table with aliases, a category and a list of search keys, instead of a fixed array in code. Existing self-ratings were copied into a new per-user table. A seed script fills the catalog. Search ranking and a cached server-side catalog were added in the next commit.
- **Design decisions:** New models `Skill`, `UserSkill` and `SkillRequest` replace the `Profile.skillRatings` JSON, so "who knows X" becomes an indexed query (GIN index on `skills.keys`). The ratings are copied by SQL inside the migration, with the two combined legacy slugs split into two rows each. The old JSON column is kept for now (see spec). Search is pure functions over an in-memory list with a 5-minute cache, instead of a query per keystroke; the cost is that other server instances can lag by up to 5 minutes after an admin change. Search ranks exact key match, then prefix, then substring; "did you mean" uses edit distance where a transposition counts as one edit.
- **Files:** created `prisma/migrations/20261015145835_open_skill_catalog/migration.sql` (124 lines), `prisma/seed-data/skills.ts` (381 lines), `prisma/seed.ts`, `prisma/scripts/verify-skill-migration.ts`, `lib/skill-catalog-core.ts`, `lib/skill-catalog.ts`, `tests/seed-catalog.test.ts`, `tests/skill-catalog-core.test.ts`; modified `prisma/schema.prisma` (91 lines added), `package.json`.
- **Schema:** added `Skill`, `UserSkill`, `SkillRequest` and enums `SkillCategory`, `SkillOrigin`, `SkillRequestStatus`. `Profile.skillRatings` is deprecated but not yet dropped.
- **Tests:** `seed-catalog.test.ts` 6 cases, `skill-catalog-core.test.ts` 10 cases (search ranking and suggestions).
- **Numbers for the report:** `6532e4b` 1,304 lines added in 9 files; `d2f3d5b` 264 lines added in 3 files.
- **Problems hit:** none recorded in the commits.
- **Screenshots to take:** none (no UI yet).
- **UML impact:** class diagram: add `Skill`, `UserSkill`, `SkillRequest` and the three enums; mark the skill ratings JSON on `Profile` as deprecated.

## Skill grid from UserSkill rows  (commit `c03a8e7`)
- **What was built:** The evidence grid on the dashboard and profile now reads the user's `UserSkill` rows and evidence for any catalog skill, not only the fixed 20. The grid shows the top 15 rows with a "Show all" toggle.
- **Design decisions:** `buildSkillGrid` takes already-parsed evidence so the server pages and the onboarding preview use the same code. A suggestions module ranks skills found in GitHub or resume evidence that the user has not added yet.
- **Files:** created `lib/skill-suggestions.ts`, `app/ui/ExpandableEvidenceGrid.tsx`, `tests/skill-suggestions.test.ts`; modified `lib/skill-grid.ts`, `lib/evidence.ts`, `lib/skills.ts`, `lib/user-skills.ts`, `app/page.tsx`, `app/(protected)/dashboard/page.tsx`, `app/(protected)/dashboard/grid-data.ts`, `app/(protected)/profile/page.tsx`.
- **Schema:** none.
- **Tests:** `skill-grid.test.ts` 7 cases, `skill-suggestions.test.ts` 2 cases.
- **Numbers for the report:** 12 files, 385 insertions, 109 deletions.
- **Problems hit:** none recorded.
- **Screenshots to take:** dashboard grid collapsed and expanded ("Show all N").
- **UML impact:** none beyond the class diagram; the Self column's source changes from JSON to `UserSkill`.

## SkillPicker and /profile/skills  (commits `bf1a304`, `6606979`; fix `b5b8837`)
- **What was built:** A page at `/profile/skills` where a user searches the catalog, browses by category, adds or removes skills, and sets a comfort level. Skills found in GitHub or resume evidence appear as one-click suggestions. If a skill is missing, the user can report it with a level and an optional note; reports show as pending rows.
- **Design decisions:** Every change saves immediately through server actions and updates the screen optimistically, reverting on failure, instead of using a save button. Per the spec, a user may have at most 10 pending reports, and a report for a skill that already exists adds it directly. Search and category browsing are two authenticated API routes (`/api/skills/search`, `/api/skills/popular`).
- **Files:** created `app/skills/actions.ts`, `app/api/skills/search/route.ts`, `app/api/skills/popular/route.ts`, `lib/skill-report-input.ts`, `lib/skill-requests.ts`, `tests/skill-report-input.test.ts`, `app/(protected)/profile/skills/page.tsx`, and under `app/ui/skill-picker/`: `SkillPicker.tsx`, `SkillSearch.tsx`, `CategoryBrowser.tsx`, `ReportSkillForm.tsx`, `SkillRatingRow.tsx`, `SuggestionStrip.tsx`, `use-skill-editor.ts`; modified `lib/user-skills.ts`, `app/(protected)/profile/page.tsx`.
- **Schema:** none (uses the earlier tables).
- **Tests:** `skill-report-input.test.ts` 7 cases (report input validation). The UI has no automated tests.
- **Numbers for the report:** `bf1a304` 310 lines added in 7 files; `6606979` 904 lines added in 9 files; `b5b8837` 15 insertions, 6 deletions.
- **Problems hit:** optimistic updates raced when a user changed a skill quickly. Fixed in `b5b8837` (`use-skill-editor.ts`, `SkillRatingRow.tsx`).
- **Screenshots to take:** `/profile/skills` with the suggestions strip, search results with a matched alias, the report form, a pending report row.
- **UML impact:** use case diagram: "Manage skills" and "Report a missing skill". Sequence diagram for the report flow (user, server action, `SkillRequest`).

## Onboarding on UserSkill  (commit `0586254`)
- **What was built:** The skills step of onboarding uses the same picker as `/profile/skills`. Skills are saved as they are picked, so an abandoned onboarding keeps them. Per the spec, Continue needs at least one skill or one pending report.
- **Design decisions:** Skills are no longer part of the wizard's own state or its final submit; per the spec the submit action checks on the server that the user has at least one skill or pending report. The session-storage draft key was versioned (`_v2`) so old drafts are discarded.
- **Files:** modified `app/onboarding/OnboardingWizard.tsx`, `app/onboarding/actions.ts`, `app/onboarding/page.tsx`, `app/onboarding/steps/ResumeStep.tsx`, `ReviewStep.tsx`, `SkillsStep.tsx`.
- **Schema:** none.
- **Tests:** none added.
- **Numbers for the report:** 6 files, 118 insertions, 308 deletions (net code removed).
- **Problems hit:** none recorded.
- **Screenshots to take:** onboarding skills step, review step grid preview.
- **UML impact:** activity diagram for onboarding: the skills step saves immediately instead of at submit.

## Whole-catalog resume matching  (commit `a8eac72`)
- **What was built:** Uploading a resume now detects any skill in the catalog, by name or alias, not only the old 20 keywords. Resume upload no longer writes self-ratings.
- **Design decisions:** Per the spec, matching uses a boundary rule so "C" does not match inside "C++" and "JS" does not match the end of "Node.js". Skills flagged `strictMatch` (ordinary words such as Go) match case-sensitively. Single-letter names count only inside a detected Skills section.
- **Files:** created `lib/resume-matcher.ts`, `tests/resume-matcher.test.ts`; modified `lib/resume-parser.ts`, `lib/resume-upload.ts`, `app/(protected)/profile/resume/actions.ts`, `app/page.tsx`.
- **Schema:** none.
- **Tests:** `resume-matcher.test.ts`, 10 cases. The spec names these regressions: "projects" must not match TS, "digital" must not match Git, "javascript" must not match Java.
- **Numbers for the report:** 6 files, 174 insertions, 53 deletions.
- **Problems hit:** none recorded.
- **Screenshots to take:** resume page with detected skills.
- **UML impact:** sequence diagram for resume upload: parser asks the catalog matcher.

## GitHub languages and topics  (commit `0d02113`)
- **What was built:** Connecting GitHub now scans every repository language and the repository topics, not just 8 languages. Each detected skill gets an evidence level of 2, 3 or 4. The GitHub callback no longer writes self-ratings.
- **Design decisions:** Only GitHub language names may create catalog skills automatically; topics only match existing skills. Per the spec, a language qualifies if it is at least 1% of some repo's bytes or appears in two or more repos. The level rules are in a pure function, `githubSkillLevels` (spec section 4.1). The evidence payload moved to version 2, and readers still accept version 1.
- **Files:** created `lib/github-skills.ts`, `tests/github-skills.test.ts`; modified `lib/github.ts`, `app/api/github/callback/route.ts`, `app/onboarding/steps/GithubStep.tsx`, `app/(protected)/dashboard/page.tsx`, `app/(protected)/profile/page.tsx`.
- **Schema:** none (the payload is JSON in `EvidenceRecord`).
- **Tests:** `github-skills.test.ts`, 8 cases.
- **Numbers for the report:** 7 files, 296 insertions, 54 deletions. The spec says the scan reads the 30 most recently pushed non-fork repos, 5 requests at a time.
- **Problems hit:** none recorded.
- **Screenshots to take:** profile grid with a wider GitHub column.
- **UML impact:** sequence diagram for the GitHub connect flow; payload v2 fields.

## Admin review queue  (commit `48810a4`)
- **What was built:** Admins listed in the `ADMIN_EMAILS` environment variable can open `/admin/skill-requests`, which groups pending reports by normalised key and lets them approve, merge into an existing skill, or reject. Per the spec, approving or merging adds the skill to every reporter at the level they asked for.
- **Design decisions:** Admin access is a comma-separated env var, not a database role, so no new table is needed. Per the spec, each decision is one database transaction, and acting on requests that are no longer pending is a no-op with a notice. Non-admins get a 404.
- **Files:** created `app/admin/layout.tsx`, `app/admin/skill-requests/page.tsx`, `ReviewGroupCard.tsx`, `actions.ts`, `lib/admin.ts`, `lib/admin-emails.ts`, `lib/skill-review.ts`, `lib/skill-review-core.ts`, `tests/admin.test.ts`, `tests/skill-review-core.test.ts`; modified `.env.example`.
- **Schema:** none.
- **Tests:** `admin.test.ts` 2 cases, `skill-review-core.test.ts` 6 cases.
- **Numbers for the report:** 11 files, 550 lines added.
- **Problems hit:** none recorded here; the page guard was changed in the final fix commit (below).
- **Screenshots to take:** the admin queue with a group of two spellings.
- **UML impact:** use case diagram: actor "Admin" with "Review reported skills". Activity diagram for approve, merge and reject.

## Removal of the fixed skill list  (commit `2a01800`)
- **What was built:** The hard-coded skill list in `lib/skills.ts` was cut down (125 lines changed, mostly deleted), and the resume pages and `lib/onboarding-options.ts` were adjusted to match.
- **Design decisions:** Done after the readers had moved to the catalog in earlier commits. The commit message does not give a rejected alternative.
- **Files:** modified `lib/skills.ts`, `lib/onboarding-options.ts`, `prisma/schema.prisma`, `app/(protected)/profile/resume/ResumeManager.tsx`, `app/(protected)/profile/resume/page.tsx`.
- **Schema:** comment only. The `Profile.skillRatings` comment now says it is deprecated, was copied into `user_skills` by the migration, and should be dropped once `prisma/scripts/verify-skill-migration.ts` passes on production.
- **Tests:** none added.
- **Numbers for the report:** 5 files, 21 insertions, 130 deletions.
- **Problems hit:** none recorded.
- **Screenshots to take:** none.
- **UML impact:** none.

## Final review fixes  (commit `1614bfc`)
- **What was built:** Fixes from the final review of the branch, as listed in the commit title: busy rating radios stay focusable, the admin page has its own guard, the seed merges aliases (alias union), resumes are capped, the migration check works per entry, and deployment steps were added to `README.md`.
- **Design decisions:** The spec's deployment order is `npx prisma migrate deploy`, then `npx prisma db seed`, then `npx tsx prisma/scripts/verify-skill-migration.ts`.
- **Files:** `README.md`, `app/admin/skill-requests/page.tsx`, `app/ui/skill-picker/SkillRatingRow.tsx`, `app/(protected)/profile/resume/ResumeManager.tsx`, `lib/github.ts`, `lib/resume-matcher.ts`, `prisma/seed.ts`, `prisma/scripts/verify-skill-migration.ts`, `tests/resume-matcher.test.ts`.
- **Schema:** none.
- **Tests:** 5 lines added in `tests/resume-matcher.test.ts`.
- **Numbers for the report:** 9 files, 93 insertions, 39 deletions.
- **Problems hit:** found in the final review: an accessibility gap (busy radios not focusable) and an admin page that depended on the layout guard alone.
- **Screenshots to take:** none.
- **UML impact:** none.

## Wave 0 (foundation)

Planned entries taken from the second-half plan (`docs/superpowers/plans/2026-10-28-second-half-features.md`). Numbers and problems are filled in when each PR merges. Task 0.4 is this file.

## Task 0.1: Schema and migration for scores, hackathons, teams, invites, participation, feedback  (in progress, PR pending)
- **What was built:** One Prisma migration, `teams_scores_feedback`, that adds every table the five feature streams need, so no stream has to create its own migration. Nothing reads the new tables yet, so there is no user-visible change.
- **Design decisions:** All schema changes are made once, up front, because parallel migrations from different streams would conflict. Per the plan, a later stream that needs another schema change must stop and raise it.
- **Files:** `prisma/schema.prisma`, and a generated `prisma/migrations/<timestamp>_teams_scores_feedback/migration.sql`.
- **Schema:** models `SkillScore`, `Hackathon`, `Team`, `TeamMember`, `TeamInvite`, `Participation`, `PeerFeedback`; enums `TeamRole` (LEAD, MEMBER), `InviteKind` (INVITE, REQUEST), `InviteStatus` (PENDING, ACCEPTED, DECLINED, CANCELLED); `Profile` gains `evidenceScore` and `scoreUpdatedAt`; back-relations on `User` and `Skill`.
- **Tests:** none; verified by `npx tsc --noEmit`, `npm test` and `npm run lint`.
- **Numbers for the report:** to fill in at merge.
- **Problems hit:** to fill in at merge.
- **Screenshots to take:** none.
- **UML impact:** class diagram: seven new classes and three enums; ER diagram.

## Task 0.2: Peers column in the evidence grid  (in progress, PR pending)
- **What was built:** The fourth column of the evidence grid, Peers, was a placeholder of zeros. It now shows levels from verified peer evidence.
- **Design decisions:** Reuses the existing GitHub skill validation for the peer payload. A payload that is unverified or malformed is ignored.
- **Files:** `lib/skill-grid.ts`, `lib/evidence.ts`, `tests/skill-grid.test.ts`.
- **Schema:** none.
- **Tests:** two new cases in `tests/skill-grid.test.ts`: the Peers column fills from peer evidence, and unverified or malformed payloads are ignored.
- **Numbers for the report:** to fill in at merge.
- **Problems hit:** to fill in at merge.
- **Screenshots to take:** none until peer feedback exists (Stream D).
- **UML impact:** none.

## Task 0.3: CI runs tests, types and lint  (in progress, PR pending)
- **What was built:** A GitHub Actions workflow, `.github/workflows/test.yml`, that runs a type check, lint and the unit tests on pushes to `Dev` and `main` and on pull requests that touch `code/frontend/**`.
- **Design decisions:** One job named `unit` on Node 20. No database is used; a placeholder `DATABASE_URL` is set only so the Prisma client can be generated during `npm ci`.
- **Files:** `.github/workflows/test.yml` (at the repo root).
- **Schema:** none.
- **Tests:** none added; the workflow runs the existing ones.
- **Numbers for the report:** to fill in at merge.
- **Problems hit:** to fill in at merge.
- **Screenshots to take:** the green `unit` check on a pull request.
- **UML impact:** none.
