# Dashboard guide, home base and three-colour theme

Date: 2026-11-14
Status: awaiting approval
Code: `code/frontend` (Next.js 16, Tailwind 4, Prisma). Read `code/frontend/AGENTS.md` before writing Next.js code.

## Why

SkillGrid is about to invite its first real testers. Today a new student lands on a dashboard that shows everything at once (skill grid, stat cards, tiles, teammate previews, team previews, checklist, projects, quick actions, availability), while three of the app's five features (hackathons, invites, peer feedback) are not on the dashboard at all. Nothing tells them what the app offers or what to do first.

The colours add to this. Blue means "backed by evidence" in the grid and is also the colour of the main buttons, so no colour is reserved for "go here".

This project fixes both: the dashboard introduces the app one step at a time, once, and the colours follow a strict 60/30/10 split where the 10% colour only ever means "this is where to go next".

## Goals

1. A new student understands what SkillGrid offers by meeting its features one at a time, in order, on the dashboard.
2. That introduction happens once. Afterwards the dashboard reports what is live and lets the student choose; it does not steer.
3. The skill grid, as the brand's signature, is visible on every dashboard visit.
4. One three-colour theme across the whole app: forest green about 60%, beige about 30%, electric purple about 10%.
5. Purple appears only on things we want the user to go to.

## Non-goals

- Changing the layout of any page other than the dashboard (landing, onboarding, profile, hackathons, invites, admin). They receive the new colours and must stay legible, nothing more. They will be revisited once there are real users and data.
- A dark or light variant. There is one look.
- Changing copy on the landing page, the onboarding wizard, or how teams, invites and feedback work.

## Anti-goals

These would make the result a failure even if it technically works:

- The guide reappearing after it has ended, or the home base nudging the student through steps again.
- Purple used for decoration, ordinary links, hover states, or "evidence" meaning. If purple is everywhere, it points nowhere.
- A dashboard that again shows every feature at full size at once.
- The skill grid buried where a returning student does not see it.

## The theme

### Decided by the owner

- Forest green leads (about 60%): it is the page ground and the top bar.
- Beige is second (about 30%): it is the cards and panels that hold content.
- Electric purple is the accent (about 10%).
- One look only. The light/dark switch is removed.
- The exact shades may be tuned later. The values below are starting points taken from the mockups the owner approved.

| Role | Starting value |
|---|---|
| Page ground (green) | `#1c4531` |
| Top bar (deeper green) | `#12301f` |
| Card (beige) | `#f1e7d3` |
| Card, raised or alternate (beige) | `#f8f1e2` / `#e6dabf` |
| Text on beige | `#173224` |
| Muted text on beige | about `#536458` |
| Text on green | `#f4ecdb` |
| Muted text on green | `#b7c8b4` |
| Forest green used on beige (ticks, cells, outlines) | `#1f4d36` |
| Accent (electric purple) | `#7a22ff`, label text white |

### Where purple is allowed

- The primary action of a page or section (the main button). Aim for one per view.
- The outline and number of the current step in the guide.
- Items in "Needs you" on the home base (marker and action button).
- The pending count next to "Invites" in the top bar.

Nowhere else. Secondary buttons, ordinary links, active navigation markers, selection, progress bars and all evidence marks use green or beige.

### What blue and amber become

Today `trust` (blue) does two jobs and `warm` (amber) means "self-reported". Both are used through shared tokens in `app/globals.css` and classes such as `bg-trust`, `text-warm-strong` (about 76 usages in `app/`). Each usage must be sorted into one of two groups:

- **An action** (primary button, call-to-action link): becomes the accent.
- **A meaning** (evidence cell, tick, badge, progress bar, active nav marker, "Self-reported" pill, hackathon phase pill): becomes forest green or a neutral beige treatment.

Introduce a separate accent token so the two jobs can never be confused again. Renaming or keeping the old token names is the builder's choice.

### The skill grid in the new colours

Shown to the owner in the mockups and accepted:

- Filled forest-green square: backed by evidence. Strength still reads as a scale from pale to full green.
- Outlined green square: the student's own rating (previously amber).
- Dashed square: empty.

The self-rating has four levels today, drawn as amber intensity (`app/ui/cell-color.ts`). The outlined square must still show the level. How (for example a centred inner square that grows with the level) is the builder's choice, as long as a self-rating can never be mistaken for evidence.

### Constraints the builder must respect

- **Text on green.** Many pages place text straight on the page ground using `text-ink` and `text-ink-muted`, which will be dark green on forest green and unreadable. Every page needs a pass so that text on the ground is beige and text on cards is dark green. One workable approach: because the theme is declared with `@theme inline`, utilities read `var(--ink)` directly, so the page can define the "on green" values at the root and card surfaces can redefine `--ink`, `--ink-muted` and the border tokens for their subtree. The builder may choose another approach.
- **Purple on green is low contrast** (about 1.8:1 for the button shape against the ground). Prefer placing purple actions on beige cards. Where a purple button must sit directly on green, give it a light outline so its shape is clear.
- **Contrast.** Body text must reach 4.5:1 and large text and control shapes 3:1, on both grounds. Check the final values with a contrast calculation, do not judge by eye.
- **Errors.** Error text and destructive actions keep a red. This is a status colour outside the three-colour theme (my call, not the owner's; see "Calls made by the designer").
- **Focus ring** must be visible on both green and beige.
- The Google logo colours in `app/ui/primitives.tsx` stay as they are.

### Removing the light/dark switch

Remove `app/ui/ThemeToggle.tsx` and its uses (top bar, landing page, onboarding page), the no-flash script in `app/layout.tsx`, and both dark token blocks in `app/globals.css`. A `skillgrid-theme` value left in a browser's storage must have no effect.

## The dashboard

The dashboard (`app/(protected)/dashboard/page.tsx`) has two states. A student sees the guide until it ends, and the home base from then on.

### State 1: the guide (first visits)

Layout: the five steps run down the left. A compact skill grid sits in a panel on the right and stays in view. On a phone the grid panel moves above the steps.

Header: "Welcome, {first name}", a line such as "Getting started, step 2 of 5", and a "Hide guide" control.

The steps, in order:

| # | Step | Counts as done when | Opens to |
|---|---|---|---|
| 1 | Build your profile | at least one skill rated and at least one evidence source on file (resume or GitHub) | `/profile` (and resume / GitHub connect) |
| 2 | Join a hackathon | the student has joined or is on a team in any hackathon | `/hackathons` |
| 3 | Find teammates or a team | the student is on a team, or has sent an invite or a join request | `/dashboard/teammates` and `/dashboard/teams` |
| 4 | Answer invites | the student has opened this step from the guide, or has ever responded to an invite | `/invites` |
| 5 | Give peer feedback | the student has acknowledged this step in the guide, or has ever given feedback | the feedback page of a finished hackathon if one is due, otherwise an explanation with a "Got it" button |

Behaviour:

- Steps tick themselves from what is on file. Nobody ticks by hand, except the acknowledgements in steps 4 and 5, which exist because those steps depend on other people and on an event ending.
- The current step is the first one not done. It is open: it shows a short explanation, a small amount of real content where there is some (for step 2, the next one or two hackathons), and one purple button.
- Done steps collapse to one line with a tick and a short summary (for example "8 skills, resume and GitHub on file").
- Later steps show their title and a one-line description, dimmed. They are still links. Nothing is locked.
- If a step cannot be completed yet (no hackathons exist), say so plainly in the step. The student can still hide the guide.
- "Hide guide" is a quiet text control, not purple.
- If the student has no skills yet, the grid panel shows the existing empty-grid treatment with a short prompt, not a blank panel.

When the guide ends:

- It ends when all five steps are done, or when the student uses "Hide guide".
- Ending is permanent and stored per user. A step later becoming "not done" again (leaving a hackathon, for example) must not bring the guide back.
- Students who onboarded before this change see the guide once too. Most of their steps will already be ticked.

### State 2: the home base (every visit after)

No order, no steps. Top to bottom:

1. **Your grid.** The largest thing on the page. A preview of the grid, one line summarising it ("6 of 8 skills backed"), a link to add evidence, and a "See the full grid" button.
2. **Needs you.** Things waiting on the student: invites to them, join requests to teams they lead, and feedback due for a finished hackathon. Each row has a purple marker and a purple action. The whole section is absent when nothing is waiting. This is the only place purple appears on the home base.
3. **Your hackathons.** Hackathons the student has joined that have not ended, each with one line on where they stand ("You're looking for a team", "On Team Rocket, 3 of 4"). When there are none, a short line and a plain link to browse hackathons.
4. **Explore.** Two tiles: people looking for a team, and teams with an open slot, each with a count, linking to the existing `/dashboard/teammates` and `/dashboard/teams` pages.
5. A small "How SkillGrid works" link that shows the five steps again for anyone who wants them. Viewing it this way does not turn the guide back on.

### The grid preview and the full grid page

The grid can grow long, so the dashboard never shows all of it.

- In both states the dashboard shows a few skills (about five), chosen as the student's best-evidenced skills.
- A "See the full grid" button leads to a new page that shows the whole grid with its legend and nothing competing with it.
- The existing `ExpandableEvidenceGrid`, `EvidenceGrid` and `GridLegend` components are the starting point.

### What leaves the dashboard

Stat cards, the evidence checklist, the projects list, availability, quick actions, the two section tiles and the teammate and team preview cards. Availability, interests, projects and evidence management are already on the profile page, so nothing becomes unreachable. Remove the outdated "Peers: coming soon" text; peer feedback exists.

The GitHub connection banner that appears after returning from GitHub stays.

## Data

Guide progress must be remembered per user: that the guide has ended, and which of the two acknowledgement steps have been seen. This needs a small additive change to `Profile` (for example an "ended at" timestamp and a list of seen steps) and one Prisma migration. Exact column names are the builder's choice. The migration must be additive so the currently deployed code keeps working, and it has to be applied to the production database before the new code is deployed.

Everything else the dashboard needs already exists: `getEvidenceStatus`, `getSkillGrid`, `listHackathons`, `countPendingForUser`, `listInvitesForUser`, `joinStateForUser`, `findTeammates`, `findOpenTeams`, and `feedbackWindow` in `lib/peer-feedback-core.ts`.

## Testing

- The rules that decide which steps are done, which step is current and whether the guide is showing should be a pure function with unit tests (the repo's pattern: `lib/*-core.ts` with `tests/*-core.test.ts`, run by `npm test`).
- The rule that picks the preview skills gets the same treatment.
- Colour work is checked by running the app and looking at every page (landing, onboarding steps, dashboard in both states, full grid, teammates, teams, hackathons list and detail, feedback, invites, profile and its sub-pages, both admin pages) at desktop and phone width, plus the contrast calculation above.

## Left to the builder

- Token names and how the action/meaning split is expressed in code.
- How the self-rating level is drawn inside an outlined cell.
- The route of the full grid page.
- Column names for guide progress.
- Component breakdown of the dashboard.
- Exact shade tuning needed to meet the contrast constraints, staying recognisably forest green, beige and electric purple.

## Calls made by the designer

The owner did not decide these. They are flagged so the owner can overrule them.

1. Red stays for errors and destructive actions, as a status colour outside the three-colour theme.
2. The dashboard preview shows about five skills, picked as the best-evidenced ones.
3. Existing users see the guide once.
4. The top bar keeps the label "Dashboard" (the mockups showed "Home").
5. Step 3 counts as done once the student has sent an invite or join request, not only once they are on a team.
6. The "How SkillGrid works" link shows the steps without re-enabling the guide.
7. In the home base, "Browse hackathons" in an empty "Your hackathons" section is a plain link, not purple, so that purple there always means something is waiting.
8. "Feedback due" means: a hackathon the student was on a team in has ended, its feedback window is still open (`feedbackWindow` returns `open`), they had at least one teammate, and they have given no feedback for it yet.

## Reference

The mockups the owner approved are saved in `.superpowers/brainstorm/264-1794646044/content/`: `colour-balance.html` (option B), `dashboard-layout.html` (option A), `grid-placement.html` (option B), `after-onboarding.html` (both states).
