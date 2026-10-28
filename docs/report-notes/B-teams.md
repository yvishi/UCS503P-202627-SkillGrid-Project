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
