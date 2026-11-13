# Second-Half Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Streams in the same wave run in parallel, each in its own worktree (superpowers:using-git-worktrees).

**Goal:** Build evidence-weighted skill scoring, real teammate/team discovery, hackathons with teams and invitations, post-hackathon peer feedback that writes back into evidence, integration tests in CI, and the pilot metrics script. Record each piece of work in a form the final report and weekly journals can be written from directly.

**Architecture:** Wave 0 makes every shared change up front: the whole schema and migration, the Peers column in the grid, CI, and the report-notes skeleton. After that the five Wave 1 streams touch disjoint files and can merge into `Dev` in any order. Each feature keeps the existing split: a pure `*-core.ts` module (unit-tested with Vitest, no DB) and a thin DB/server-action layer on top. Scores are stored in a `skill_scores` table and recomputed whenever evidence or self-ratings change, so discovery stays a plain indexed query.

**Tech Stack:** Next.js 16.3.3 (App Router, server actions), React 19.2.8, Prisma 6.19.3 on Postgres (Neon), NextAuth 5 beta, Tailwind 4, Vitest 3.2.4, tsx 4.20.3, GitHub Actions.

**Spec:** No separate spec exists. The requirements come from the mid-term report (`Mid-Term Report/main.tex`, sections *Subsequent deliverables* and *Future Work and Recommendations*, plus the *Results and Evaluation* chapter for the metric definitions). The design decisions those sections leave open are fixed in **Design Decisions** below; executors treat that section as the spec.

## Global Constraints

- Work from the `code/frontend` directory. Branch each stream off `Dev`, after `feature/open-skill-catalog` **and** Wave 0 have been merged into `Dev`.
- Do not add or upgrade any dependency except where a task names one. No new runtime dependencies.
- **Only Task 0.1 creates a Prisma migration.** If a stream finds it needs another schema change, it stops and raises it. It must not add a second migration in parallel with other streams.
- At the end of every task, `npm test`, `npx tsc --noEmit` and `npm run lint` must all pass.
- Every server action calls `auth()` itself and scopes all reads and writes to the session user. Admin pages and actions check `getAdminUser()` (`lib/admin.ts`) and return 404 / an error for anyone else.
- User-facing copy uses sentence case and plain words, and no exclamation marks, matching the existing pages.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Every stream's last task updates that stream's `docs/report-notes/<stream>.md` (template in Task 0.4). This is required, not optional: the final report (Task R.2) is assembled from those files.

## Review Focus

1. **Two people accepting the last open slot on the same team at the same moment.** The team must never exceed `teamSizeMax`. Task B.3 rechecks the size inside the transaction and has a test for it.
2. **A user who is already in a team for a hackathon accepts a second invite for that hackathon.** This must be refused, and the `@@unique([hackathonId, userId])` on `TeamMember` must also guarantee it at the DB level. Covered in Task B.1 (rule) and Task B.3 (DB).
3. **Evidence changes that never trigger a score recompute.** This covers a resume switch, a GitHub reconnect, a skill removed through the picker, and an admin approving a reported skill (which bulk-creates `UserSkill` rows in `lib/skill-review.ts`). Each of these leaves discovery out of date. Task A.2 lists every write site and has a test that the backfill output matches live recomputes.
4. **Peer feedback on someone who was not a teammate, about yourself, or outside the feedback window.** All three must be refused on the server, not just hidden in the UI. Covered in Task D.1 (rules) and Task D.2 (action).
5. **Discovery filters given junk query parameters**, such as an unknown skill slug, `availability=FOO` or `page=-3`. The page must render with the bad filter ignored rather than throw. Covered in Task C.1.

---

## Design Decisions

### Scoring (Stream A)

Each skill's score is a number from 0 to 100. The score adds up a weighted contribution from each evidence source:

| Source | Weight | Strength (0–1) |
|---|---|---|
| GitHub | 45 | grid level / 4 (levels 2, 3, 4 → 0.5, 0.75, 1) |
| Peers | 25 | grid level / 4 |
| Resume | 20 | 1 if the active resume names the skill, else 0 |
| Self | 10 | grid level / 4 (BEGINNER 2, INTERMEDIATE 3, ADVANCED 4) |

`skillScore = Math.round(Σ weight × strength)`. With these weights the weakest GitHub signal (22.5) still beats a resume mention (20), and a resume mention still beats any self-rating (10). That gives the ordering the report commits to: **GitHub > resume > self**.

**Profile evidence score** (the card's "Evidence on file N/100"): take the mean of the user's top 5 skill scores, padding with zeros if there are fewer than 5, and round it. The score rewards depth across a few skills, not listing many.

### Hackathons, teams, invitations (Stream B)

- Only admins create hackathons. Each one has `teamSizeMin` (default 2) and `teamSizeMax` (default 4).
- A user can be in at most one team per hackathon. Whoever creates a team becomes its `LEAD`.
- Teams can be created, joined and invited to only before `endsAt`.
- `TeamInvite.kind` is either:
  - `INVITE`: the lead asks a user to join.
  - `REQUEST`: a user asks to join a team.

  `userId` is always the person who would join. Only one `PENDING` row is allowed per (team, user); this is checked in code.
- Accepting an invite or request does three things in one transaction: it rechecks the team size and the one-team rule, inserts the `TeamMember`, and cancels that user's other pending invites and requests for the same hackathon. It also sets `Participation.lookingForTeam = false`.
- Leaving a team works as follows:
  - If the lead leaves and others remain, the earliest-joined remaining member becomes lead.
  - If the last member leaves, the team is deleted.
- `Participation` (hackathon, user, `lookingForTeam`) is the "participation status". `IN_TEAM` is derived from whether a `TeamMember` row exists, so it is never stored.

### Discovery (Stream C)

- Teammates are users who have completed onboarding, excluding the viewer. The filters are:
  - `skill`: up to 3 slugs, and a user must hold all of them.
  - `interest`: a single interest tag.
  - `availability`: a single value.
  - `hackathon`: a slug; only users with `lookingForTeam = true` in that hackathon match.

  Results are sorted by the sum of `SkillScore.score` over the filtered skills if any are given, otherwise by `Profile.evidenceScore`. Ties are broken by name. There are 24 results per page, and `page` is 1-based.
- Teams are those in hackathons that have not ended and that have at least one open slot. They can be filtered by `hackathon` and by `skill` (matched against `Team.lookingFor`). Newest teams come first.
- All filters are plain GET query parameters, so filtered views can be linked and bookmarked.

### Peer feedback (Stream D)

- The feedback window opens at `hackathon.endsAt` and closes 14 days later.
- A rater may only rate members of their own team in that hackathon, never themselves. They can rate up to 5 skills per teammate, each with a `ComfortLevel`, and can only pick from skills the teammate has self-rated. Submitting again replaces the rater's earlier ratings for that teammate.
- Write-back: after each submission, rebuild the recipient's **single** `PEER_FEEDBACK` `EvidenceRecord`, replaced rather than appended, the same way GitHub evidence is handled. Its payload is `{ version: 1, verified: true, skills: [{ slug, level, raters }] }`. `level` is the lower median of the ratings mapped BEGINNER→2, INTERMEDIATE→3, ADVANCED→4. After the rebuild, recompute the recipient's scores.

### Out of scope for this plan

OCR self-hosting and the async job queue (excluded by the user), notifications, LinkedIn PDF upload, and dependency-manifest scanning. The *Invites* page and its pending-count badge stand in for notifications.

---

## Waves and Parallelism

```
Wave 0 (blocking, 1 person, ~1 day)      Wave 1 (parallel, 5 streams)                 Wave 2 (parallel)          Wave 3
 0.1 schema+migration ─┐                  A Scoring        A.1 → A.2 ─────────────┐
 0.2 Peers grid column ┼─ merge to Dev ─▶ B Teams          B.1 → B.2 → B.3 → B.4 ─┼─▶ I.1 wire cards ─┐
 0.3 CI workflow       │                  C Discovery      C.1 → C.2 → C.3 ───────┤   I.2 integ. tests ├─▶ R.1 pilot
 0.4 report notes      ┘                  D Peer feedback  D.1 → D.2 (needs A.2) ─┤   (per stream)     │   R.2 final report
                                          E Tests+metrics  E.1 ; E.2 ─────────────┘                    ┘   R.3 journals
```

- Tasks 0.1–0.4 touch different files, so up to four people can share Wave 0. All four must be merged into `Dev` before Wave 1 starts.
- In Wave 1 the only cross-stream dependency is **D.2 → A.2**: D.2 calls `recomputeUserScores`. D.1 runs in parallel with everything; D.2 starts once A.2 is merged.
- Wave 2 is integration work that joins streams B and C, plus integration tests for the new actions.
- **R.3 (journals) is continuous.** Each member writes their weekly entry from their stream's report notes.

### File ownership (prevents merge conflicts)

| Stream | Owns (only this stream edits) |
|---|---|
| 0 | `prisma/schema.prisma`, `prisma/migrations/*`, `lib/skill-grid.ts`, `lib/evidence.ts`, `.github/workflows/test.yml`, `docs/summary.md`, `vitest.config.mts` |
| A | `lib/skill-score*.ts`, `prisma/scripts/backfill-scores.ts`, and the single-line recompute hooks in `app/api/github/callback/route.ts`, `app/(protected)/profile/resume/actions.ts`, `app/onboarding/actions.ts`, `app/skills/actions.ts`, `app/admin/skill-requests/actions.ts` |
| B | `lib/team-rules.ts`, `lib/teams.ts`, `lib/hackathon-input.ts`, `app/admin/hackathons/**`, `app/(protected)/hackathons/**` (except `feedback/`), `app/(protected)/invites/**`, `app/(protected)/NavLinks.tsx` |
| C | `lib/discovery*.ts`, `app/(protected)/dashboard/teammates/**`, `app/(protected)/dashboard/teams/**`, `app/(protected)/dashboard/MatchCards.tsx`, `app/(protected)/dashboard/page.tsx`, `lib/dashboard-fixtures.ts` (deletes it) |
| D | `lib/peer-feedback*.ts`, `app/(protected)/hackathons/[slug]/feedback/**` |
| E | `vitest.integration.config.mts`, `tests/integration/**`, `lib/pilot-metrics*.ts`, `scripts/pilot-metrics.ts` |
| Each | `docs/report-notes/<its-stream>.md` |

Route contracts agreed now, so streams can link to each other without waiting:

- `/hackathons` and `/hackathons/[slug]` (B)
- `/hackathons/[slug]/feedback` (D)
- `/invites` (B)
- `/admin/hackathons` (B)
- `/dashboard/teammates?skill=&interest=&availability=&hackathon=&page=` (C)
- `/dashboard/teams?hackathon=&skill=&page=` (C)

---

## Wave 0: Foundation

### Task 0.1: Schema and migration for scores, hackathons, teams, invites, participation, feedback

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_teams_scores_feedback/migration.sql` (generated)

**Interfaces:**
- Produces the Prisma models and enums below. Every Wave 1 stream relies on these exact names.

- [ ] **Step 1: Add the models**

Add the back-relations on `User` that these models need: `skillScores`, `teamMemberships`, `teamInvites`, `participations`, `feedbackGiven`, `feedbackReceived`, `hackathonsCreated`, `teamsCreated`. On `Skill`, add `scores SkillScore[]` and `peerFeedback PeerFeedback[]`. On `Profile`, add `evidenceScore Int @default(0)` and `scoreUpdatedAt DateTime?`.

```prisma
model SkillScore {
  userId  String
  skillId String
  score   Int // 0-100, lib/skill-score-core.ts
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  skill Skill @relation(fields: [skillId], references: [id], onDelete: Cascade)
  updatedAt DateTime @updatedAt
  @@id([userId, skillId])
  @@index([skillId, score])
  @@map("skill_scores")
}

model Hackathon {
  id String @id @default(cuid())
  slug String @unique
  name String
  startsAt DateTime
  endsAt   DateTime
  teamSizeMin Int @default(2)
  teamSizeMax Int @default(4)
  createdById String
  createdBy User @relation("HackathonCreatedBy", fields: [createdById], references: [id])
  teams Team[]
  members TeamMember[]
  invites TeamInvite[]
  participations Participation[]
  feedback PeerFeedback[]
  createdAt DateTime @default(now())
  @@map("hackathons")
}

model Team {
  id String @id @default(cuid())
  hackathonId String
  name String
  description String?
  lookingFor String[] @default([]) // skill slugs
  createdById String
  hackathon Hackathon @relation(fields: [hackathonId], references: [id], onDelete: Cascade)
  createdBy User @relation("TeamCreatedBy", fields: [createdById], references: [id])
  members TeamMember[]
  invites TeamInvite[]
  feedback PeerFeedback[]
  createdAt DateTime @default(now())
  @@unique([hackathonId, name])
  @@map("teams")
}

model TeamMember {
  teamId String
  userId String
  hackathonId String // denormalised so one-team-per-hackathon is a DB constraint
  role TeamRole @default(MEMBER)
  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  hackathon Hackathon @relation(fields: [hackathonId], references: [id], onDelete: Cascade)
  joinedAt DateTime @default(now())
  @@id([teamId, userId])
  @@unique([hackathonId, userId])
  @@map("team_members")
}

model TeamInvite {
  id String @id @default(cuid())
  teamId String
  hackathonId String
  userId String // the person who would join
  kind InviteKind
  status InviteStatus @default(PENDING)
  createdById String
  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
  hackathon Hackathon @relation(fields: [hackathonId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  respondedAt DateTime?
  @@index([userId, status])
  @@index([teamId, status])
  @@map("team_invites")
}

model Participation {
  hackathonId String
  userId String
  lookingForTeam Boolean @default(true)
  hackathon Hackathon @relation(fields: [hackathonId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@id([hackathonId, userId])
  @@index([hackathonId, lookingForTeam])
  @@map("participations")
}

model PeerFeedback {
  id String @id @default(cuid())
  hackathonId String
  teamId String
  fromUserId String
  toUserId String
  skillId String
  level ComfortLevel
  hackathon Hackathon @relation(fields: [hackathonId], references: [id], onDelete: Cascade)
  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
  from User @relation("FeedbackGiven", fields: [fromUserId], references: [id], onDelete: Cascade)
  to   User @relation("FeedbackReceived", fields: [toUserId], references: [id], onDelete: Cascade)
  skill Skill @relation(fields: [skillId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([hackathonId, fromUserId, toUserId, skillId])
  @@index([toUserId])
  @@map("peer_feedback")
}

enum TeamRole { LEAD MEMBER }
enum InviteKind { INVITE REQUEST }
enum InviteStatus { PENDING ACCEPTED DECLINED CANCELLED }
```

- [ ] **Step 2: Generate and apply on a dev database**

Run: `npx prisma migrate dev --name teams_scores_feedback`
Expected: the migration is created and applied, and `prisma generate` succeeds.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm test && npm run lint`
Expected: all pass. No code reads the new models yet.

- [ ] **Step 4: Commit**: `Add schema for scores, hackathons, teams, invites and peer feedback`.

### Task 0.2: Peers column in the evidence grid

**Files:**
- Modify: `lib/skill-grid.ts`, `lib/evidence.ts`
- Test: `tests/skill-grid.test.ts`

**Interfaces:**
- Produces `peerSkillsFromPayload(payload: unknown): GithubEvidenceSkill[]` in `lib/skill-grid.ts`. It reads `{ version: 1, verified: true, skills: [{ slug, level }] }`; anything else returns `[]`.
- Produces `findPeerPayload(userId: string): Promise<unknown>` in `lib/evidence.ts`.
- `buildSkillGrid` gains an optional `peerSkills?: readonly GithubEvidenceSkill[]` (default `[]`) that fills column 3. `loadSkillGrid` loads it and also returns `peerPayload`.

- [ ] **Step 1: Write failing tests** in `tests/skill-grid.test.ts`:
  - `"fills the Peers column from peer evidence"`: `buildSkillGrid({ userSkills: [], resumeSkills: [], githubSkills: [], peerSkills: [{ slug: "react", level: 3 }], skillNames: new Map([["react", "React"]]) }).rows` equals `[{ label: "React", cells: [0, 0, 0, 3] }]`, and `backedCount` is `1`.
  - `"ignores unverified or malformed peer payloads"`: `peerSkillsFromPayload(null)`, `({ version: 1, verified: false, skills: [{slug:"a",level:3}] })` and `({ version: 1, verified: true, skills: [{ slug: "a", level: 7 }] })` all return `[]`.
- [ ] **Step 2: Run** `npx vitest run tests/skill-grid.test.ts`. Expected: FAIL (`peerSkillsFromPayload` is not exported).
- [ ] **Step 3: Implement.** Reuse `isGithubEvidenceSkill` for validation. Replace the `0, // Peers` placeholder with `peer.get(slug) ?? 0`, and add peer slugs to the union of slugs.
- [ ] **Step 4: Run** `npm test`. Expected: PASS, including the existing grid tests unchanged.
- [ ] **Step 5: Commit**: `Show peer feedback evidence in the skill grid`.

### Task 0.3: CI runs tests, types and lint

**Files:**
- Create: `.github/workflows/test.yml` (at the repo root)

- [ ] **Step 1: Write the workflow.**
  - Triggers: `push` to `Dev` and `main`, and `pull_request`, filtered to the paths `code/frontend/**` and `.github/workflows/test.yml`.
  - One job named `unit` on `ubuntu-latest`, Node 20, `working-directory: code/frontend`.
  - Steps: `npm ci`, `npx tsc --noEmit`, `npm run lint`, `npm test`.
  - `prisma generate` runs through `postinstall` and needs no database. Set `DATABASE_URL: postgresql://x:x@localhost:5432/x` as an env var so the Prisma client builds.
- [ ] **Step 2: Verify.** Push the branch and open a PR to `Dev`. Expected: the `unit` check is green.
- [ ] **Step 3: Commit**: `Run tests, type-check and lint in CI`.

### Task 0.4: Report notes skeleton and baseline record

**Files:**
- Create: `docs/report-notes/README.md`, `docs/report-notes/00-baseline.md`, `docs/report-notes/A-scoring.md`, `B-teams.md`, `C-discovery.md`, `D-peer-feedback.md`, `E-tests-metrics.md`
- Modify: `docs/summary.md` (add a `Report notes` entry pointing at `report-notes/`)

- [ ] **Step 1: Write `README.md` with the template every stream fills in:**

```markdown
## <Task id>: <title>  (<date>, <author>)
- **What was built:** 2-4 sentences, user-visible behaviour first.
- **Design decisions:** each with the alternative rejected and why.
- **Files:** created/modified (paths).
- **Schema:** models/fields touched (or "none").
- **Tests:** test files + count; what they prove.
- **Numbers for the report:** lines added, tests added, any measured value.
- **Problems hit:** bug/obstacle -> fix (feeds the report's "Analysis" section).
- **Screenshots to take:** pages/states for the report figures.
- **UML impact:** which diagram changes (class / activity / sequence / use case).
```

- [ ] **Step 2: Write `00-baseline.md`.** It records what was finished after the mid-term report (17 Sep 2026), using the template, one entry per commit group on `feature/open-skill-catalog`: Vitest and normalisation, the catalog seed, the SkillPicker and `/profile/skills`, onboarding moved to `UserSkill`, whole-catalog resume matching, GitHub languages and topics, the admin review queue, and removal of the fixed skill list. Get the facts from `git log Dev..feature/open-skill-catalog` and from `docs/superpowers/specs/2026-10-15-open-skill-catalog-design.md`. Record the current numbers: the number of `tests/*.test.ts` files and test cases (from `npm test` output) and the migration count. The stream files start as just a heading.
- [ ] **Step 3: Verify.** Run `mkdocs build` from the repo root, or check that the `mkdocs` CI workflow is green. Expected: no broken nav.
- [ ] **Step 4: Commit**: `Add report notes for the second half and record the open-catalog work`.

---

## Wave 1, Stream A: Scoring

### Task A.1: Pure scoring core

**Files:**
- Create: `lib/skill-score-core.ts`
- Test: `tests/skill-score-core.test.ts`

**Interfaces:**
- Produces:
  - `SOURCE_WEIGHTS = { github: 45, peers: 25, resume: 20, self: 10 } as const`
  - `type SkillEvidence = { slug: string; self: 0 | 2 | 3 | 4; resume: boolean; github: 0 | 2 | 3 | 4; peers: 0 | 2 | 3 | 4 }`
  - `skillScore(e: SkillEvidence): number`, an integer from 0 to 100
  - `profileScore(scores: readonly number[]): number`, the rounded mean of the top 5 scores, zero-padded
  - `collectEvidence(input: { userSkills: readonly UserSkillEntry[]; resumeSkills: readonly string[]; githubSkills: readonly GithubEvidenceSkill[]; peerSkills: readonly GithubEvidenceSkill[] }): SkillEvidence[]`, which returns one entry per slug in the union of all inputs

- [ ] **Step 1: Write failing tests:**
  - `skillScore` gives `{self:4}` → `10`, `{resume:true}` → `20`, `{github:2}` → `23`, `{github:4}` → `45`, `{peers:3}` → `19`, all sources at maximum → `100`, and nothing → `0`.
  - `"weakest GitHub beats resume beats strongest self"`: `skillScore({github:2}) > skillScore({resume:true}) > skillScore({self:4})`.
  - `profileScore([])` → `0`, `profileScore([100])` → `20`, `profileScore([90, 80, 70, 60, 50, 40])` → `70` (only the top five count).
  - `collectEvidence` merges a slug that appears in several sources into one entry, maps self levels BEGINNER/INTERMEDIATE/ADVANCED to 2/3/4, and orders entries by slug.
- [ ] **Step 2: Run** `npx vitest run tests/skill-score-core.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** using the formula in *Design Decisions → Scoring*. Round only the final sum.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit**: `Add evidence-weighted skill scoring`.

### Task A.2: Store scores and recompute on every evidence change

**Files:**
- Create: `lib/skill-score.ts`, `prisma/scripts/backfill-scores.ts`
- Modify (one `await recomputeUserScores(...)` line each, after the write commits):
  - `app/api/github/callback/route.ts` (after the transaction)
  - `app/(protected)/profile/resume/actions.ts` (both `reuploadResumeAction` and `selectResumeAction`)
  - `app/onboarding/actions.ts` (`submitOnboardingAction`)
  - `app/skills/actions.ts` (add, set level, remove)
  - `app/admin/skill-requests/actions.ts` (approve and merge, for every affected user id; have `approveGroup`/`mergeGroup` return the ids, or query them before resolving)

**Interfaces:**
- Consumes `collectEvidence`, `skillScore` and `profileScore` (A.1), and `findPeerPayload` (0.2).
- Produces `recomputeUserScores(userId: string): Promise<{ evidenceScore: number; skills: number }>` in `lib/skill-score.ts`. It loads the evidence the same way `loadSkillGrid` does (active resume, GitHub, peers, self), maps slugs to skill ids, and in one transaction deletes the user's `SkillScore` rows, `createMany`s rows for scores above 0, and updates `Profile.evidenceScore` and `scoreUpdatedAt`. D.2 and C rely on this function.

- [ ] **Step 1: Implement `recomputeUserScores`.** Slugs the catalog does not know are skipped.
- [ ] **Step 2: Write `backfill-scores.ts`.** It runs `recomputeUserScores` for every user with a profile and prints `users=<n> skillRows=<n>`. With `--check`, it instead compares the stored `evidenceScore` against a fresh computation and exits 1 on any mismatch.
- [ ] **Step 3: Add the hooks** listed under Files.
- [ ] **Step 4: Verify on the dev DB.** Run `npx tsx prisma/scripts/backfill-scores.ts`, then `--check`. Expected: exit 0. Then go through it by hand:
  - Connect GitHub on a test account. That account's `profiles.evidenceScore` changes.
  - Remove a skill on `/profile/skills`. Its `skill_scores` row disappears.
  - Switch resume. The scores change.
  - Run `--check`. Expected: still exit 0.
- [ ] **Step 5: Verify** with `npm test`, `npx tsc --noEmit` and `npm run lint`. Commit: `Store skill scores and recompute them when evidence changes`.
- [ ] **Step 6: Report notes.** Fill in `docs/report-notes/A-scoring.md` for A.1–A.2. Include the weights table, one example user's breakdown (in the shape of a report table), and the backfill numbers. Commit.

---

## Wave 1, Stream B: Hackathons, teams and invitations

### Task B.1: Pure team rules

**Files:**
- Create: `lib/team-rules.ts`, `lib/hackathon-input.ts`
- Test: `tests/team-rules.test.ts`, `tests/hackathon-input.test.ts`

**Interfaces:**
- Produces in `lib/team-rules.ts`:
  - `type RuleResult = { ok: true } | { ok: false; error: string }`
  - `type TeamState = { size: number; max: number; endsAt: Date }`
  - `canCreateTeam(a: { now: Date; endsAt: Date; alreadyInTeam: boolean }): RuleResult`
  - `canInvite(a: { now: Date; team: TeamState; actorIsLead: boolean; targetInTeam: boolean; pendingExists: boolean; targetIsSelf: boolean }): RuleResult`
  - `canRequest(a: { now: Date; team: TeamState; alreadyInTeam: boolean; pendingExists: boolean }): RuleResult`
  - `canAccept(a: { now: Date; team: TeamState; joinerInTeam: boolean; actorMayRespond: boolean }): RuleResult`. `actorMayRespond` is true for an INVITE when the actor is the invitee, and for a REQUEST when the actor is the lead.
  - `nextLead(members: readonly { userId: string; role: "LEAD" | "MEMBER"; joinedAt: Date }[], leavingUserId: string): string | null`. Returns `null` when nobody remains.
- Produces in `lib/hackathon-input.ts`: `parseHackathonInput(form: Record<string, string>): { ok: true; value: { name; slug; startsAt: Date; endsAt: Date; teamSizeMin: number; teamSizeMax: number } } | { ok: false; error: string }`. Rules: the name is 3–80 characters, `slug = toSlug(name)` unless a slug is given, `endsAt > startsAt`, and `1 ≤ min ≤ max ≤ 8`.

- [ ] **Step 1: Write failing tests.** One `it` per rule branch. The following cases must exist with these exact messages:
  - `canAccept` with `size === max` → `{ ok: false, error: "This team is full." }`
  - `canAccept` with `joinerInTeam` → `"You're already in a team for this hackathon."`
  - any check where `now >= endsAt` → `"This hackathon has ended."`
  - `canInvite` with `targetIsSelf` → `"You can't invite yourself."`
  - `nextLead` with lead leaving and members `[B joined 2nd, C joined 3rd]` → `"B"`; with the only member leaving → `null`
  - `parseHackathonInput` with `endsAt` before `startsAt` → `"The end must be after the start."`; with `teamSizeMin: "5", teamSizeMax: "3"` → error
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement.** No DB imports in either file.
- [ ] **Step 4: Run.** Expected: PASS. Commit: `Add team and hackathon rules`.

### Task B.2: Admin hackathon management

**Files:**
- Create: `app/admin/hackathons/page.tsx`, `app/admin/hackathons/actions.ts`, `app/admin/hackathons/HackathonForm.tsx`

**Interfaces:**
- Consumes `parseHackathonInput` (B.1) and `getAdminUser`.
- Produces `createHackathonAction(prev: { error?: string; ok?: boolean }, form: FormData)`, used with `useActionState` like `app/admin/skill-requests`.

- [ ] **Step 1: Build the page.** Non-admins get `notFound()`. It lists hackathons (name, dates, team count) and shows a create form. Slug collisions are caught with `isUniqueViolation` → `"A hackathon with that name already exists."`.
- [ ] **Step 2: Verify by hand.** An admin creates "HackThapar 2026". A non-admin gets 404 on `/admin/hackathons`. Commit: `Let admins create hackathons`.

### Task B.3: Teams, participation, join and leave

**Files:**
- Create: `lib/teams.ts`, `app/(protected)/hackathons/page.tsx`, `app/(protected)/hackathons/[slug]/page.tsx`, `app/(protected)/hackathons/[slug]/actions.ts`, `app/(protected)/hackathons/[slug]/TeamPanel.tsx`
- Modify: `app/(protected)/NavLinks.tsx` (add "Hackathons")

**Interfaces:**
- Consumes the B.1 rules.
- Produces in `lib/teams.ts` (all take `userId` first and return `RuleResult`-shaped results):
  - `createTeam(userId, hackathonId, input: { name: string; description?: string; lookingFor: string[] })`
  - `setLookingForTeam(userId, hackathonId, looking: boolean)`
  - `leaveTeam(userId, teamId)`
  - `getHackathonView(userId, slug)`, which returns `{ hackathon, myTeam: { id, name, role, members: { userId, name, image, role }[] } | null, lookingForTeam: boolean, phase: "upcoming" | "running" | "ended" }`
  - `acceptInTransaction(tx, inviteId)`. B.4 reuses this. Inside one `prisma.$transaction` it rechecks size and membership via `canAccept`, creates the `TeamMember`, marks the invite `ACCEPTED`, cancels the joiner's other `PENDING` invites in that hackathon, and sets `lookingForTeam=false`.
- The `[slug]` page shows a "Give feedback" link to `/hackathons/[slug]/feedback` when `phase === "ended"` and `myTeam` is set. Stream D builds that route.

- [ ] **Step 1: Implement `lib/teams.ts`.** Use `createTeam` in a transaction: create the team, the LEAD member and the participation. In `leaveTeam`, use `nextLead` to promote a new lead, or delete the team.
- [ ] **Step 2: Build the pages.**
  - `/hackathons` lists upcoming and running hackathons first, then ended ones.
  - `/hackathons/[slug]` shows the user's team panel, or a "Create a team" form and a "Looking for a team" toggle.
  - `lookingFor` uses the existing `SkillSearch` picker in single-select mode, or a slug list. Cap it at 5.
- [ ] **Step 3: Verify by hand with two accounts.**
  - Create a team.
  - Try to create a second team in the same hackathon. Expected: the error is shown.
  - Leave a team as lead with one other member. Expected: the other member becomes lead.
  - Leave as the last member. Expected: the team is gone.
- [ ] **Step 4: Commit**: `Add hackathon pages, teams and participation`.

### Task B.4: Invitations and join requests

**Files:**
- Create: `app/(protected)/invites/page.tsx`, `app/(protected)/invites/actions.ts`, `app/(protected)/invites/InviteRow.tsx`
- Modify: `lib/teams.ts` (add the functions below), `app/(protected)/NavLinks.tsx` (an "Invites" link with the pending count)

**Interfaces:**
- Produces in `app/(protected)/invites/actions.ts`. Stream C's cards (via I.1) call these.
  - `inviteToTeamAction(teamId: string, userId: string): Promise<RuleResult>`
  - `requestToJoinAction(teamId: string): Promise<RuleResult>`
  - `respondToInviteAction(inviteId: string, accept: boolean): Promise<RuleResult>`
  - `cancelInviteAction(inviteId: string): Promise<RuleResult>`
- Produces in `lib/teams.ts`:
  - `countPendingForUser(userId): Promise<number>`, counting invites to the user plus requests to teams they lead
  - `myLeadTeams(userId): Promise<{ id: string; name: string; hackathonName: string }[]>`. Stream C's Invite button uses this for the team choice.

- [ ] **Step 1: Implement the actions.** Each one checks the rules first and uses `acceptInTransaction` for accepts.
- [ ] **Step 2: Build `/invites`.** It has three sections: invitations to you, requests to your teams, and your sent requests. Each row has Accept/Decline or Cancel.
- [ ] **Step 3: Verify by hand with three accounts and a `teamSizeMax` of 2.**
  - The lead invites B and C. B accepts. C's accept fails with "This team is full."
  - B's other pending request in the same hackathon shows as cancelled.
- [ ] **Step 4: Commit**: `Add team invitations and join requests`.
- [ ] **Step 5: Report notes.** Fill in `docs/report-notes/B-teams.md` for B.1–B.4. Include the invite state machine (PENDING→ACCEPTED, DECLINED or CANCELLED) for the activity diagram, and the transaction-race decision. Commit.

---

## Wave 1, Stream C: Real discovery

### Task C.1: Pure filter parsing and ranking

**Files:**
- Create: `lib/discovery-core.ts`
- Test: `tests/discovery-core.test.ts`

**Interfaces:**
- Produces:
  - `type TeammateFilters = { skills: string[]; interest: InterestTag | null; availability: Availability | null; hackathon: string | null; page: number }`
  - `parseTeammateFilters(params: Record<string, string | string[] | undefined>): TeammateFilters`
  - `type TeamFilters = { hackathon: string | null; skill: string | null; page: number }`
  - `parseTeamFilters(params): TeamFilters`
  - `PAGE_SIZE = 24`
  - `headline(skills: readonly { name: string; score: number }[]): string`, which joins the top 2 skill names with `" · "`, or returns `"New to SkillGrid"` when there are none

- [ ] **Step 1: Write failing tests:**
  - `skill` given as a string or as an array becomes a de-duplicated lowercase list, capped at 3.
  - `availability=FOO` → `null`, and an unknown interest → `null`.
  - `page` of `"-3"`, `"abc"` or missing → `1`, and `"2"` → `2`.
  - `headline([])` → `"New to SkillGrid"`.
- [ ] **Step 2: Run** the tests. Expected: FAIL. **Step 3:** Implement, reusing `isInterestTag` and `AVAILABILITY_OPTIONS`. **Step 4:** Run the tests. Expected: PASS. Commit: `Parse discovery filters`.

### Task C.2: Teammates listing on real profiles

**Files:**
- Create: `lib/discovery.ts`, `app/(protected)/dashboard/teammates/Filters.tsx`
- Modify: `app/(protected)/dashboard/teammates/page.tsx`, `app/(protected)/dashboard/MatchCards.tsx`

**Interfaces:**
- Consumes `TeammateFilters` (C.1), plus the `SkillScore` table and `Profile.evidenceScore` (0.1). The values are 0 until A.2 is merged, which is fine.
- Produces:
  - `type TeammateCardData = { userId: string; name: string; image: string | null; headline: string; tags: string[]; evidenceScore: number }`
  - `findTeammates(viewerId: string, f: TeammateFilters): Promise<{ items: TeammateCardData[]; hasMore: boolean }>`
  - `TeammateCard({ teammate }: { teammate: TeammateCardData; action?: React.ReactNode })`. The `action` slot is filled by I.1. Until then, render nothing there.

- [ ] **Step 1: Implement `findTeammates`.**
  - Use a Prisma `profile.findMany` where `onboardingCompletedAt != null` and `userId != viewerId`, plus the filters.
  - Skill filters become `user.skillScores.some({ skill: { slug } })` once per slug, which gives AND semantics.
  - For the hackathon filter, use `user.participations.some({ hackathon: { slug }, lookingForTeam: true })`.
  - Sort in SQL by `evidenceScore` when there is no skill filter. When there is one, fetch up to `page × PAGE_SIZE + 1` and sort in memory by the sum of the matched scores. The pilot is 15–20 users, so this is fine; note the limit in the report notes.
  - `tags` are the top 3 skills by score.
- [ ] **Step 2: Build the page.** Add a GET form (`Filters.tsx`) with a skill search, interest, availability and hackathon selects. Remove `SampleNote`. Show the empty state `Empty({ message: "No one matches these filters yet." })` and a "Next page" link.
- [ ] **Step 3: Verify by hand.** Signed in as user X, X never appears in the list. Filtering by a skill only X's friend has shows just the friend. `?page=-3` renders page 1. Commit: `List real teammates with filters`.

### Task C.3: Teams listing and dashboard tiles

**Files:**
- Modify: `lib/discovery.ts`, `app/(protected)/dashboard/teams/page.tsx`, `app/(protected)/dashboard/MatchCards.tsx`, `app/(protected)/dashboard/page.tsx`
- Delete: `lib/dashboard-fixtures.ts`

**Interfaces:**
- Produces:
  - `type TeamCardData = { id: string; name: string; hackathonName: string; hackathonSlug: string; lookingFor: string[]; members: string[]; openSlots: number }`. `lookingFor` holds skill names, not slugs.
  - `findOpenTeams(viewerId: string, f: TeamFilters): Promise<{ items: TeamCardData[]; hasMore: boolean }>`
  - `TeamCard({ team, action? })`

- [ ] **Step 1: Implement `findOpenTeams`.** It returns teams whose hackathon has `endsAt > now` and whose member count is below `teamSizeMax`, excluding teams the viewer belongs to. Compute `openSlots` from `_count.members`.
- [ ] **Step 2: Swap the dashboard previews to real data.** Change every remaining fixture import (dashboard page previews) to `findTeammates`/`findOpenTeams` with `page: 1` sliced to 3, then delete `lib/dashboard-fixtures.ts`.
- [ ] **Step 3: Verify.** `grep -r dashboard-fixtures app lib` returns nothing, `npx tsc --noEmit` passes, and a full team is not listed. Commit: `List real open teams and drop dashboard fixtures`.
- [ ] **Step 4: Report notes.** Fill in `docs/report-notes/C-discovery.md`. Include the query shape, the in-memory sort limit, and before/after screenshots of `/dashboard/teammates`. Commit.

---

## Wave 1, Stream D: Peer feedback

### Task D.1: Pure feedback rules and aggregation (parallel with everything)

**Files:**
- Create: `lib/peer-feedback-core.ts`
- Test: `tests/peer-feedback-core.test.ts`

**Interfaces:**
- Produces:
  - `FEEDBACK_WINDOW_DAYS = 14`
  - `MAX_SKILLS_PER_TEAMMATE = 5`
  - `feedbackWindow(endsAt: Date, now: Date): "not-open" | "open" | "closed"`
  - `canGiveFeedback(a: { window: ReturnType<typeof feedbackWindow>; raterTeamId: string | null; targetTeamId: string | null; raterId: string; targetId: string }): RuleResult`
  - `parseFeedbackInput(input: { toUserId: string; ratings: { slug: string; level: string }[] }, allowedSlugs: ReadonlySet<string>): { ok: true; value: { toUserId: string; ratings: { slug: string; level: ComfortLevelName }[] } } | { ok: false; error: string }`
  - `aggregatePeerEvidence(rows: readonly { slug: string; level: ComfortLevelName; fromUserId: string }[]): { version: 1; verified: true; skills: { slug: string; level: 2 | 3 | 4; raters: number }[] }`

- [ ] **Step 1: Write failing tests:**
  - With `endsAt` at 10:00: `now` at 09:59 → `"not-open"`, `endsAt` exactly → `"open"`, `endsAt + 14d` → `"closed"`.
  - `canGiveFeedback` for yourself → `"You can't rate yourself."`, for different teams → `"You can only rate your own teammates."`, and when closed → `"The feedback window for this hackathon has closed."`
  - `parseFeedbackInput`: 6 ratings → error; a slug outside `allowedSlugs` → error; level `"EXPERT"` → error; a duplicate slug → error.
  - `aggregatePeerEvidence` with ratings for react of BEGINNER, ADVANCED and INTERMEDIATE from three raters → `{ slug: "react", level: 3, raters: 3 }`. With two ratings, BEGINNER and ADVANCED → level `2` (lower median).
  - The output is accepted by `peerSkillsFromPayload` (0.2): round-trip test.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS. Commit: `Add peer feedback rules and aggregation`.

### Task D.2: Feedback page, action and write-back (after A.2 is merged)

**Files:**
- Create: `lib/peer-feedback.ts`, `app/(protected)/hackathons/[slug]/feedback/page.tsx`, `.../feedback/actions.ts`, `.../feedback/FeedbackForm.tsx`

**Interfaces:**
- Consumes the D.1 functions, `recomputeUserScores` (A.2) and `getUserSkills`.
- Produces:
  - `submitFeedbackAction(hackathonSlug: string, input: { toUserId: string; ratings: { slug: string; level: string }[] }): Promise<RuleResult>`
  - `rebuildPeerEvidence(userId: string): Promise<void>`. It loads all `PeerFeedback` rows for the user across hackathons, aggregates them, and replaces the `PEER_FEEDBACK` record in one transaction (`deleteMany` then `create`, the same as the GitHub callback). When there are no rows, it just deletes the record.

- [ ] **Step 1: Implement.** The action resolves both users' `TeamMember` rows for the hackathon and runs `canGiveFeedback`. It then runs `parseFeedbackInput` with the target's self-rated slugs, deletes the rater's earlier rows for that target, inserts the new ones, and calls `rebuildPeerEvidence(target)` followed by `recomputeUserScores(target)`.
- [ ] **Step 2: Build the page.** Show one card per teammate with up to 5 of their skills and a level choice for each, reusing `SkillRatingRow`. Outside the window, show the window state message instead of the form.
- [ ] **Step 3: Verify by hand.** Use an admin-created hackathon with `endsAt` in the past.
  - A rates B on React = ADVANCED.
  - B's dashboard grid now shows a non-zero Peers cell for React, and B's `evidenceScore` has gone up.
  - Posting the action with a non-teammate's id returns the error.
- [ ] **Step 4: Commit**: `Collect peer feedback and write it back into evidence`.
- [ ] **Step 5: Report notes.** Fill in `docs/report-notes/D-peer-feedback.md`, including the write-back sequence (submit → rebuild evidence → recompute score → grid) for a sequence diagram. Commit.

---

## Wave 1, Stream E: Integration tests and pilot metrics

### Task E.1: Integration test harness and tests for existing actions

**Files:**
- Create: `vitest.integration.config.mts`, `tests/integration/setup.ts`, `tests/integration/helpers.ts`, `tests/integration/skills-actions.test.ts`, `tests/integration/admin-review.test.ts`
- Modify: `package.json` (`"test:integration": "vitest run -c vitest.integration.config.mts"`), `.github/workflows/test.yml` (add an `integration` job)

**Interfaces:**
- Produces in `tests/integration/helpers.ts`. Every stream's Wave 2 tests use these.
  - `resetDb(): Promise<void>`, which `TRUNCATE`s all app tables except `skills`, `RESTART IDENTITY CASCADE`
  - `createUser(opts?: { email?: string; onboarded?: boolean; admin?: boolean }): Promise<{ id: string; email: string }>`
  - `signInAs(user: { id: string; email: string } | null): void`. This sets the value returned by the mocked `@/auth` `auth()`.
- `setup.ts` mocks `@/auth`, `next/navigation` (`redirect` and `notFound` throw tagged errors) and `next/cache` (`revalidatePath` is a no-op). It requires `DATABASE_URL` to contain `test`, and refuses to run otherwise so it can never truncate Neon production.

- [ ] **Step 1: Write the tests.**
  - `skills-actions.test.ts`: `addUserSkillAction("react","ADVANCED")` creates a `UserSkill`. `setUserSkillLevelAction` with level `"EXPERT"` returns `ok: false`. When signed out, the action redirects. User B can't remove user A's skill.
  - `admin-review.test.ts`: a non-admin calling `approveAction` gets an error, and approving a group creates the catalog skill and the reporters' `UserSkill` rows.
- [ ] **Step 2: Run locally** against a Docker Postgres: `docker run -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=skillgrid_test -p 5433:5432 postgres:16`, then `DATABASE_URL=postgresql://postgres:pw@localhost:5433/skillgrid_test npx prisma migrate deploy && npx prisma db seed && npm run test:integration`. Expected: PASS.
- [ ] **Step 3: Add the CI job** with a `services: postgres: image: postgres:16` block, using the same three commands. Expected: the `integration` check is green on the PR.
- [ ] **Step 4: Commit**: `Add integration tests for server actions and run them in CI`.

### Task E.2: Pilot metrics script

**Files:**
- Create: `lib/pilot-metrics-core.ts`, `scripts/pilot-metrics.ts`
- Test: `tests/pilot-metrics-core.test.ts`

**Interfaces:**
- Produces:
  - `type UserRow = { createdAt: Date; onboardedAt: Date | null; hasResume: boolean; hasGithub: boolean; extracted: string[]; kept: string[] }`
  - `computeMetrics(rows: readonly UserRow[], teams: { teams: number; invites: number; accepted: number; feedbackGivers: number; eligibleGivers: number }): PilotMetrics`
  - `PilotMetrics` has these fields:
    - `users`
    - `medianTtvpMinutes: number | null`, over onboarded users with at least one evidence source, as the report defines it
    - `completionRate`
    - `coverageAny`
    - `coverageBoth`
    - `parsePrecision: number | null`, equal to Σ kept ∩ extracted ÷ Σ extracted
    - `teamsFormed`
    - `inviteAcceptRate`
    - `feedbackRate`
  - `toMarkdownTable(m: PilotMetrics): string`, which includes the targets (TTVP ≤ 10 min, coverage ≥ 60%)
- `scripts/pilot-metrics.ts --since 2026-11-01 [--until …]` loads rows created in the window and prints the table.

- [ ] **Step 1: Write failing tests.** TTVP values of 4, 8 and 30 minutes give a median of 8. Users without evidence are excluded from TTVP but included in `completionRate`. An empty input gives `null`s, not `NaN`. `parsePrecision` for extracted `[a,b,c,d]`, kept `[a,b]` is `0.5`.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS. Then run the script against the dev DB and expect a table to print. Commit: `Add pilot metrics script`.
- [ ] **Step 5: Report notes.** Fill in `docs/report-notes/E-tests-metrics.md`, including the test counts before and after, and the CI run links. Commit.

---

## Wave 2: Integration (parallel)

### Task I.1: Wire Invite / Request-to-join into discovery cards

**Files:**
- Create: `app/(protected)/dashboard/InviteButton.tsx`, `app/(protected)/dashboard/RequestJoinButton.tsx`
- Modify: `app/(protected)/dashboard/teammates/page.tsx` and `teams/page.tsx` (pass `action`)

**Interfaces:**
- Consumes `inviteToTeamAction`, `requestToJoinAction` and `myLeadTeams` (B.4), and the `action` slot (C.2, C.3).

- [ ] **Step 1: Build the buttons.**
  - `InviteButton`: if the viewer leads no team, show a disabled button and a link to `/hackathons`. If they lead one team, invite straight away. If they lead several, show a small select. Display the `RuleResult` error inline.
  - `RequestJoinButton`: calls `requestToJoinAction(team.id)` and shows "Requested" when it succeeds.
- [ ] **Step 2: Verify by hand.** The invite shows up in the target's `/invites`. Commit: `Send invites and join requests from discovery`.

### Task I.2: Integration tests for new actions (one per stream, in parallel)

**Files:**
- Create: `tests/integration/teams.test.ts` (B owner), `tests/integration/feedback.test.ts` (D owner), `tests/integration/scores.test.ts` (A owner), `tests/integration/discovery.test.ts` (C owner)

- [ ] **Step 1: Write the tests** using the E.1 helpers:
  - `teams.test.ts`: two concurrent `respondToInviteAction(…, true)` calls for the last slot (`Promise.all`) leave exactly `teamSizeMax` members, and one result is `ok: false`. A second team in the same hackathon is refused. Leave/next-lead is covered.
  - `feedback.test.ts`: a non-teammate gets an error. A valid submission creates exactly one `PEER_FEEDBACK` record, and submitting again replaces the ratings rather than duplicating them.
  - `scores.test.ts`: after `addUserSkillAction` the user's `evidenceScore > 0`, and `backfill-scores --check` logic matches `recomputeUserScores`.
  - `discovery.test.ts`: the viewer is excluded, users not yet onboarded are excluded, and two skill filters are ANDed.
- [ ] **Step 2: Run** `npm run test:integration`. Expected: PASS locally and in CI. Commit per file.
- [ ] **Step 3: Report notes.** Each owner adds the test counts to their stream's notes.

---

## Wave 3: Pilot and reports

### Task R.1: Run the pilot (people, not code)

- [ ] **Step 1: Prepare.** Merge `Dev` → `main` so production has everything. An admin creates a pilot hackathon on the production site. Run `backfill-scores.ts` against production once (with the `DATABASE_URL` from Vercel env, run by the project owner).
- [ ] **Step 2: Run the pilot.** Recruit 15–20 students across years, as the mid-term plan said. Each one onboards, then forms a team or joins one. After `endsAt`, members give feedback.
- [ ] **Step 3: Collect results.** Run `npx tsx scripts/pilot-metrics.ts --since <pilot start>` and paste the table into `docs/report-notes/E-tests-metrics.md` under **Numbers for the report**. Collect the five-point clarity question answers (Google Form) and record the mean.

### Task R.2: Final report

**Files:**
- Create: `project-report-final/main.tex`, `project-report-final/references.bib`, `project-report-final/figures/*.puml`. Copy `tietreport.cls` and the structure from `../Mid-Term Report/`, which sits outside the repo; copy it in.
- Delete: `project-report-final/TODO`

- [ ] **Step 1: Copy the mid-term chapters in, then update them from the report notes:**
  - Proposed Solution: the second-half deliverables, now marked done.
  - Methodology and Design: the scoring formula table (A), the team and invite rules (B), the discovery query (C), the feedback write-back (D), and the CI and test layers (E).
  - UML: an updated class diagram with the 0.1 models, an activity diagram for invitations, and a sequence diagram for feedback write-back.
  - Results and Evaluation: replace every "pending" with the R.1 numbers, and replace "Unit Testing: not yet automated" with the real counts.
  - Analysis: taken from the "Problems hit" entries.
  - Schedule table: the actual weeks.
  - Future Work: OCR self-hosting, notifications, LinkedIn.
- [ ] **Step 2: Build.** Run pdflatex → biber → pdflatex ×2 (MiKTeX per user), and regenerate the diagrams with PlantUML (`!pragma layout smetana`). Expected: the PDF builds with no undefined references.
- [ ] **Step 3: Commit**: `Write the final project report`.

### Task R.3: Weekly journals (continuous, every member)

- [ ] **Each week, each member adds `journals/<roll>-<name>/W<n>/main.tex`** (same preamble as `journals/1024030856-saksham/W3/main.tex`), builds `main.pdf`, and adds a line to their `index.md`. The content comes from their stream's report-notes entries for that week: Context, then one section per task (design, notable code, problem and fix), then What's next.

---

## Self-Review Notes

- **Coverage.** The mid-term "Subsequent deliverables" and "Future Work" items map to tasks as follows; anything not listed is under *Out of scope*:
  - scoring → A
  - discovery → C
  - hackathon, team, invitation and participation → B
  - peer feedback write-back → D, with 0.2
  - tests in CI → 0.3, E.1, I.2
  - pilot and metrics → E.2, R.1
  - report → 0.4, R.2, R.3
- **Types.** These names are spelled the same across tasks: `recomputeUserScores`, `RuleResult`, `GithubEvidenceSkill`, `TeammateCardData`, `TeamCardData`, `peerSkillsFromPayload`, `acceptInTransaction`, `myLeadTeams`.
- **Parallel safety.**
  - Only 0.1 touches the schema.
  - `lib/skill-grid.ts` and `lib/evidence.ts` are finished in 0.2.
  - The one-line hooks in shared action files belong to A alone.
  - `NavLinks.tsx` belongs to B alone.
  - The feedback link on the hackathon page is a route contract, not a shared edit.
