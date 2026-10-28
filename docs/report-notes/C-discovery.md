# Stream C: teammate and team discovery

## C.1: Discovery filters  (2026-10-28, Claude)
- **What was built:** discovery filters parsed by a pure, junk-tolerant module (`lib/discovery-core.ts`): unknown interest/availability become null, skills are deduped and capped at 3, a bad page becomes 1. Pages therefore never throw on bad query strings.
- **Tests:** 13 unit cases.

## C.2: Teammates listing on real profiles  (2026-10-28, Claude)
- **What was built:** `/dashboard/teammates` now lists real onboarded users (never the viewer) from a GET filter form (skills, interest, availability, hackathon) with 24 per page and a "Next page" link. The sample note and fixtures are gone from this page. Cards show the top 3 skills by score and an evidence strip driven by `Profile.evidenceScore`. The `action` slot on `TeammateCard` is empty until Task I.1.
- **Design decisions:** skill filter is up to three plain text inputs for catalog slugs, not the SkillSearch combobox, which is built around client state and server actions and is too heavy for a GET form. Unknown skill/hackathon slugs are dropped so a stale link shows the unfiltered list instead of an empty page. With a skill filter, every match is loaded and ranked in memory by the sum of matched scores (loading only `page x PAGE_SIZE + 1` unsorted rows would drop top-ranked people).
- **Limit:** the in-memory sort loads all users matching the skill filter; fine for the 15-20 user pilot, but needs SQL (`SUM` + `LIMIT`) at larger scale. Without a skill filter, sorting and paging happen in SQL.
- **Files:** `lib/discovery.ts`, `app/(protected)/dashboard/teammates/{page,Filters}.tsx`, `app/(protected)/dashboard/MatchCards.tsx`.
- **Schema:** none (reads `Profile`, `SkillScore`, `Participation`, `Hackathon`).
- **Tests:** checked with a throwaway script against a local DB: viewer excluded, non-onboarded excluded, two skills ANDed and ranked by sum, page clamping, junk filters ignored. Scores stay 0 until A.2 merges.
- **Manual checks pending:** browser check of the page signed in as two real accounts.
- **Screenshots to take:** teammates page with filters applied; empty state.
- **UML impact:** none beyond a `findTeammates` call in the discovery sequence.

## C.3: Open teams listing and dashboard tiles  (2026-10-28, Claude)
- **What was built:** `/dashboard/teams` lists real teams through `findOpenTeams` with a GET filter (hackathon select, skill slug input), 24 per page and a "Next page" link. The dashboard now shows real counts on its two tiles plus two three-card previews (teammates, open teams) with empty states. `lib/dashboard-fixtures.ts` and `SampleNote` are deleted. `TeamCard` takes `TeamCardData` and an `action` slot (empty until Task I.1; the old inert "Apply to join" button is gone).
- **Query shape:** one `prisma.team.findMany`: hackathon `endsAt > now` (and `slug` if filtered), `members: { none: { userId: viewer } }`, `lookingFor: { has: skill }` if filtered, ordered by `createdAt desc, id asc`, selecting members' names and `_count.members`. One extra catalog lookup (`findSkillNames`) turns the page's `lookingFor` slugs into names; unknown slugs are dropped.
- **Limit:** "has an open slot" means `_count.members < hackathon.teamSizeMax`, which Prisma cannot filter on. All candidate teams of unended hackathons are loaded, filtered in memory, then paged. Fine for a pilot; use raw SQL (`HAVING count(*) < teamSizeMax` with `LIMIT`) if team counts grow into the thousands.
- **Files:** `lib/discovery.ts`, `app/(protected)/dashboard/{page.tsx,MatchCards.tsx,PageHeader.tsx}`, `app/(protected)/dashboard/teams/{page,Filters}.tsx`, `tests/integration/discovery-teams.test.ts`.
- **Schema:** none.
- **Tests:** 6 integration cases against a real DB: full team hidden, ended-hackathon team hidden, viewer's team excluded, skill and hackathon filters, `openSlots`/member names/skill names (unknown slug dropped), newest-first paging with `hasMore`.
- **Manual checks pending:** browser check of `/dashboard/teams` and the dashboard previews; before/after screenshots of `/dashboard/teammates` and `/dashboard/teams` (sample data vs real).
- **UML impact:** `findOpenTeams` joins the discovery sequence next to `findTeammates`.
