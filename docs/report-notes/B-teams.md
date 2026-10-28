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
