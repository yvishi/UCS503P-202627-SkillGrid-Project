# Stream E: integration tests and pilot metrics

## E.1: Integration test harness and tests for existing actions  (2026-10-28, Claude)
- **What was built:** A Vitest integration suite that runs the real server actions against a real Postgres, with a separate config and an `integration` CI job. No user-visible change. Shared helpers (`resetDb`, `createUser`, `signInAs`) are reused by the Wave 2 tests.
- **Design decisions:** `@/auth` is mocked so `auth()` returns a chosen session, instead of building real NextAuth sessions (too heavy, and the actions only read `session.user`). `resetDb` lists tables from `pg_tables` instead of hard-coding them, so new models are covered automatically, and it deletes `REQUESTED` skills because `skills` is kept (seeded once). A guard in `setup.ts` refuses to run unless the database name contains "test", instead of trusting developers not to point at Neon. Files run serially (`fileParallelism: false`) because they share one database. The unit config excludes `tests/integration/**` so `npm test` needs no database.
- **Files:** `vitest.integration.config.mts`, `tests/integration/{setup,helpers}.ts`, `tests/integration/{skills-actions,admin-review}.test.ts`, `vitest.config.mts`, `package.json`, `.github/workflows/test.yml`.
- **Schema:** none.
- **Tests:** 8 integration tests in 2 files (6 skill actions: add, unknown slug, invalid level `EXPERT`, change level, signed-out, cross-user remove; 2 admin review: non-admin refused, approve creates skill and reporters' `UserSkill` rows). Unit suite unchanged at 98 tests.
- **Numbers for the report:** 8 integration tests, about 5 s locally; 98 unit tests; 2 CI jobs (`unit`, `integration`).
- **Problems hit:** Signed-out actions throw `Not signed in` (the page layer redirects), so the test asserts the throw rather than a redirect. Docker was unavailable locally, so a local Postgres on port 5433 was used instead.
- **Screenshots to take:** the green `unit` and `integration` checks on a PR.
- **UML impact:** none (test deployment: the CI job could appear in a deployment diagram as a Postgres service container).
