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

## I.1: Invite and request to join from discovery cards  (2026-11-12, Claude)
- **What was built:** teammate cards on `/dashboard/teammates` now carry an Invite control, and team cards on `/dashboard/teams` a Request to join button. A viewer who leads no team sees a disabled Invite button and a link to `/hackathons`; with one team they invite straight away ("Invite to <team>"); with several they pick the team from a small select. Request to join shows "Requested" once it succeeds. Any refusal from the B.4 rules (`RuleResult` error) is shown inline under the button.
- **Design decisions:** the cards start from server state instead of always showing an active button: a team that already has an open invite or request with that person is dropped from the Invite choices (shown as "Invited" once none are left), a team the viewer already asked shows "Requested", a team that invited the viewer links to `/invites`, and a team in a hackathon where the viewer already has a team shows a note instead of a button. The alternative, always showing the button and relying on the server's error, would make people click to find out. The server actions still recheck every rule, so stale card state can only produce an inline error, never a bad write. The choice logic is two pure functions (`inviteChoice`, `joinState` in `lib/discovery-core.ts`) so it is unit-tested without a DB. Pending rows of both kinds count as "already invited" because `inviteToTeam` refuses any pending row for the pair.
- **Files:** created `app/(protected)/dashboard/{InviteButton,RequestJoinButton}.tsx`; modified `app/(protected)/dashboard/{teammates,teams}/page.tsx`, `lib/discovery-core.ts` (`inviteChoice`, `joinState`), `lib/teams.ts` (`pendingWithLeadTeams`, `joinStateForUser`), `tests/discovery-core.test.ts`, `tests/integration/invites.test.ts`.
- **Schema:** none (reads `TeamMember`, `TeamInvite`).
- **Tests:** 7 unit cases (`inviteChoice`: no team, one, many, all pending; `joinState`: open, requested/invited for this team only, in-hackathon first) and 2 integration cases (`pendingWithLeadTeams` returns pending rows of both kinds only for led teams and skips answered ones; `joinStateForUser` returns member hackathons, requests sent and invites received).
- **Numbers for the report:** 2 new client components, 2 query helpers, 9 tests added.
- **Problems hit:** none in code. Two extra queries per discovery page (lead teams plus pending rows on teammates; memberships plus pending rows on teams), run in parallel with the listing query.
- **Manual checks pending:** browser check with two accounts: invite from a teammate card, then see it in the target's `/invites`; request from a team card, then see it under the lead's requests; the several-teams select.
- **Screenshots to take:** teammate card with Invite (no team, one team, select); team card with Request to join and the "Requested" state.
- **UML impact:** activity diagram for invitations gains the discovery card as an entry point; sequence diagram: card -> `inviteToTeamAction` / `requestToJoinAction` -> `lib/teams.ts`.
