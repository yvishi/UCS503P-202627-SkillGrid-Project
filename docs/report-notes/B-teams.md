# Stream B: hackathons, teams and invitations

## B.1: Pure team rules  (2026-10-28, Claude)
- **What was built:** Pure functions deciding whether a team can be created, a person invited, a join requested or an invite/request accepted, plus lead succession when a member leaves, and a parser for the admin hackathon form (name, slug, IST start/end, team size 1 to 8).
- **Design decisions:** Rules take plain facts and return `{ ok, error }` instead of querying the DB, so they are unit-tested exhaustively and reused by server actions and transactions (rejected: inline checks in each action, which would drift apart). Failure precedence is fixed as ended, permission, self/membership, full, pending. Form times with no offset are read as Asia/Kolkata (+05:30) (rejected: server timezone, which is UTC on Vercel and shifts times by 5.5 hours).
- **Files:** code/frontend/lib/team-rules.ts, lib/hackathon-input.ts, tests/team-rules.test.ts, tests/hackathon-input.test.ts.
- **Schema:** none.
- **Tests:** 2 files, 36 tests; one per rule branch, failure ordering, lead succession, form validation and IST parsing.
- **Numbers for the report:** about 150 lines of code, 36 tests added.
- **Problems hit:** `new Date("2026-11-01T10:00")` depends on the server timezone -> append an explicit +05:30 offset.
- **Screenshots to take:** none.
- **UML impact:** none (activity diagram for team formation can cite these rules).

## B.2: Admin hackathon management  (2026-10-28, Claude)
- **What was built:** An admin-only page at `/admin/hackathons` with a create form (name, optional slug, start and end as datetime-local in IST, smallest and largest team) and a list of hackathons showing dates in Asia/Kolkata, team size range and team count. A duplicate name shows "A hackathon with that name already exists."; non-admins get a 404 on the page and "Not allowed." from the action.
- **Design decisions:** `createdById` comes from `getAdminUser()` inside the action, never from the form (rejected: hidden field, forgeable). The list is ordered by `createdAt` descending so the newest hackathon is first. Slug collisions are caught through `isUniqueViolation` rather than a pre-check, so two concurrent creates cannot both pass. The admin layout has no nav list, so no link was added.
- **Files:** code/frontend/app/admin/hackathons/page.tsx, actions.ts, HackathonForm.tsx; tests/integration/admin-hackathons.test.ts.
- **Schema:** none (reads and writes `Hackathon`).
- **Tests:** 1 integration file, 4 tests: admin creates (IST stored as UTC, createdById set), duplicate name, non-admin writes no row, invalid dates return the parser error.
- **Numbers for the report:** 211 lines added in code and tests (224 insertions in total with these notes, per `git diff --stat`), 4 integration tests added.
- **Problems hit:** none.
- **Screenshots to take:** `/admin/hackathons` with the form and a created "HackThapar 2026"; the duplicate-name error.
- **UML impact:** use case diagram gains "Create hackathon" for the admin actor.

Manual checks pending: render of the page in a browser and the non-admin 404 (covered by the layout and page guards, not run in a browser).

## B.3: Teams, participation, join and leave  (2026-10-28, Claude)
- **What was built:** A "Hackathons" nav link and a `/hackathons` list (upcoming and running first, then ended, times shown in IST). Each `/hackathons/[slug]` page shows the user's team (members, lead, open slots, skills it is looking for, and a Leave button), or a "Create a team" form and a "Looking for a team" toggle. After a hackathon ends, team members see a "Give feedback" link to the Stream D route. `lib/teams.ts` holds `createTeam`, `setLookingForTeam`, `leaveTeam`, `getHackathonView`, `listHackathons` and `acceptInTransaction`, which the B.4 invitations task reuses.
- **Design decisions:**
  - Race safety for the last slot (Review Focus 1): `acceptInTransaction` locks the team row with `SELECT ... FOR UPDATE` before counting members. Rejected: a Serializable transaction with P2034 retries, because `acceptInTransaction` runs inside the caller's transaction and cannot set its isolation level, and retries would have to live in every caller. The lock makes concurrent accepts for one team queue up, and under the default READ COMMITTED the second one counts the first one's member and gets "This team is full." `leaveTeam` takes the same lock, so a leave that deletes the team cannot interleave with an accept.
  - One team per hackathon at DB level (Review Focus 2): the member insert uses `INSERT ... ON CONFLICT DO NOTHING` and maps 0 rows to "You're already in a team for this hackathon." Rejected: catching P2002 from `prisma.teamMember.create`, because a failed statement aborts the caller's whole Postgres transaction, so the error could not be returned as a normal result without a savepoint.
  - `TeamMember.hackathonId` is always copied from the team row read in the same transaction, never from client input.
  - `acceptInTransaction(tx, inviteId, actorMayRespond)` takes authorization as a flag, because it cannot know who the actor is. The B.4 caller decides it.
  - `lookingFor` is a comma-separated text input resolved through the catalog (`findSkillByText`). Unknown text is dropped, and at most 5 slugs are kept. Rejected: the `SkillSearch` picker, which is built for rating skills and would need a new single-select mode.
  - Creating a team also cancels the creator's pending invites and requests in that hackathon, because they could no longer be accepted.
  - Leaving is refused after the hackathon ends, so teams stay fixed for peer feedback.
  - `hackathonPhase` (upcoming, running or ended) was added to the pure `lib/team-rules.ts`. `endsAt` itself counts as ended, the same as in the other rules.
- **Files:** created `lib/teams.ts`, `app/(protected)/hackathons/{page.tsx,format.ts}`, `app/(protected)/hackathons/[slug]/{page.tsx,actions.ts,TeamPanel.tsx}`, `tests/integration/teams.test.ts`. Modified `lib/team-rules.ts`, `tests/team-rules.test.ts`, `app/(protected)/NavLinks.tsx`.
- **Schema:** none. Reads and writes Hackathon, Team, TeamMember, TeamInvite and Participation.
- **Tests:** 13 integration tests in `tests/integration/teams.test.ts`:
  - create (with catalog-only `lookingFor` and participation off), second team refused, duplicate name refused
  - lead leaves and the other member becomes lead, last member leaves and the team is deleted, a non-member can't leave
  - the looking toggle works, and can't be turned on while in a team
  - two concurrent accepts for the last slot of a size-2 team (`Promise.all`) leave exactly 2 members and exactly one failure
  - a forced-overlap version of the last-slot race, where the second accept is held until it blocks on the lock
  - the same user accepted into two teams at once is stopped by the unique index (forced overlap)
  - accepting cancels the joiner's other pending invites in that hackathon only, and clears `lookingForTeam`
  - accept is refused without permission, and a second accept of the same invite is refused

  3 unit tests for `hackathonPhase`.
- **Numbers for the report:** about 1050 lines added (about 290 in `lib/teams.ts`, 280 in tests). 16 tests added: unit suite 174 tests, integration suite 21 tests.
- **Problems hit:**
  - The plain `Promise.all` race test passed even with the row lock removed, because the two transactions rarely overlap. Fix: a forced-overlap test holds the first transaction open until `pg_stat_activity` shows the second waiting on a lock. That test fails without `FOR UPDATE` and passes with it.
  - When two teams raced for the same user, the loser saw its invite already cancelled by the winner and reported "already answered". Fix: a non-pending invite whose joiner is now in a team reports "You're already in a team for this hackathon."
- **Manual checks pending:** these steps were automated in `tests/integration/teams.test.ts`, but the browser flow with two signed-in accounts was not run:
  - create a team
  - second-team error shown
  - lead hand-over on leave
  - team deleted when the last member leaves
- **Screenshots to take:**
  - `/hackathons` list with upcoming, running and ended entries
  - `/hackathons/[slug]` with the create form and the looking toggle
  - the same page with a team panel showing the Lead pill
  - an ended hackathon showing "Give feedback"
- **UML impact:**
  - Class diagram: Team, TeamMember and Participation, plus the `lib/teams.ts` service.
  - Sequence diagram: accept, with lock team, recheck, insert, cancel others.
  - Activity diagram: leave, with lead hand-over or team deletion.
