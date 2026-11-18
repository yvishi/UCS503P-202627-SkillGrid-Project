# Dashboard Guide, Home Base and Three-Colour Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-theme the whole app to forest green / beige / electric purple, and rebuild the dashboard as a one-time five-step guide that gives way to an unordered home base.

**Architecture:** The theme is done almost entirely in `app/globals.css` by making the colour tokens context-scoped: the root holds "on green ground" values and any beige surface redefines the same tokens for its subtree, so existing `text-ink`, `border-border`, `text-trust` classes stay correct wherever they sit. A new `accent` token carries purple; `trust` keeps its "evidence" meaning and becomes forest green. The dashboard page becomes a thin loader that picks between two views, driven by a pure rules module with unit tests.

**Tech Stack:** Next.js 16.3 (App Router, server components and server actions), Tailwind CSS 4 (`@theme inline`), Prisma 6 on Postgres, Vitest. All paths below are relative to `code/frontend`. Read `AGENTS.md` there before writing Next.js code.

**Spec:** `docs/superpowers/specs/2026-11-14-dashboard-guide-and-theme-design.md`

## Global Constraints

- Purple (`accent`) is allowed only on: a page or section's primary button, the current guide step's outline and number, "Needs you" rows, and the pending count beside "Invites" in the top bar. Never on links, hover states, selection, progress, navigation markers or evidence.
- One look. No light/dark switch, no `data-theme`, no `prefers-color-scheme` block.
- Body text 4.5:1, large text and control shapes 3:1, on both green and beige. Verified by calculation (Task 1).
- A self-rating must never look like evidence: evidence cells are filled, self cells are outlined.
- Red remains for errors and destructive actions only.
- Layouts of pages other than the dashboard do not change.
- The guide never reappears once ended.
- The migration is additive only.
- Commits: this repo's owner commits on request. Each task ends at a green checkpoint (`npm test`, `npm run lint`, `npx tsc --noEmit`) instead of a commit. Work on branch `feature/dashboard-guide-theme`.

## Review Focus

1. A student with zero skills opens the dashboard: the grid panel shows the empty-grid treatment with a prompt, never a blank panel or a crash. (Task 5, checked in the browser.)
2. No hackathons exist: guide step 2 says so and the guide can still be hidden; home base "Your hackathons" shows its empty line. (Task 5 and 6.)
3. A step regresses after the guide ended (student leaves their only hackathon): the home base still shows, not the guide. (Task 3 test `stays hidden once ended`.)
4. A hover or nested background flips an element between green and beige: text must stay readable in both (nav link hover, pills on the ground, `bg-bg` blocks inside cards). (Task 1 sweep.)
5. A browser still holding `skillgrid-theme=dark` in storage: the page renders the single theme. (Task 2, checked in the browser.)

---

### Task 1: Context-scoped colour tokens

**Files:**
- Modify: `app/globals.css` (replace the three token blocks, `:focus-visible`, `::selection`)
- Create: `scripts/check-contrast.ts`

**Interfaces:**
- Produces: Tailwind colours `accent`, `accent-strong`, `on-accent`, `nav` (classes `bg-accent`, `text-on-accent`, `border-accent`, `bg-nav`). Existing colour names keep working. Two helper classes: `.on-ground` and `.on-surface`, which force a subtree into one context.

- [ ] **Step 1: Write `scripts/check-contrast.ts`.** It holds the two token tables below as data, computes WCAG contrast, prints each pair and exits 1 if any fails. Pairs: ground ink / ground bg ≥ 4.5; ground ink-muted / ground bg ≥ 4.5; surface ink / surface ≥ 4.5; surface ink-muted / surface ≥ 4.5; surface ink-muted / surface-alt ≥ 4.5; on-accent / accent ≥ 4.5; accent / surface ≥ 4.5; surface trust / surface ≥ 4.5; surface danger / surface ≥ 4.5; ground danger / ground bg ≥ 4.5; cell-4 / cell-0 ≥ 3 in each context.

- [ ] **Step 2: Run `npx tsx scripts/check-contrast.ts`.** Expected: all pairs pass. If one fails, adjust that value (staying in the same colour family) in the script and in Step 3.

- [ ] **Step 3: Rewrite the tokens in `app/globals.css`.** Delete the `@media (prefers-color-scheme: dark)` block and the `:root[data-theme="dark"]` block. `:root` holds shared tokens plus the ground context:

| Token | Ground (`:root`, `.on-ground`) | Surface |
|---|---|---|
| `--ink` | `#f4ecdb` | `#173224` |
| `--ink-muted` | `#b7c8b4` | `#536458` |
| `--border` | `#2f5a44` | `#d6c8aa` |
| `--border-strong` | `#4a745e` | `#b9aa88` |
| `--rule` | `rgba(244,236,219,0.05)` | `rgba(23,50,36,0.06)` |
| `--trust`, `--success` | `#d6e4c6` | `#1f4d36` |
| `--trust-strong`, `--success-strong` | `#f4ecdb` | `#173a29` |
| `--on-trust` | `#173224` | `#f4ecdb` |
| `--warm`, `--gold` | `#b7c8b4` | `#536458` |
| `--warm-strong`, `--gold-strong` | `#f4ecdb` | `#173224` |
| `--danger` | `#ffa69b` | `#b3261e` |
| `--cell-0..4` | `#2a5a42 #4f7a5f #86a587 #bccbab #f1e7d3` | `#ddd0b2 #b9c5a3 #869f80 #4f775c #1f4d36` |

Shared (context-free): `--bg: #1c4531; --nav: #12301f; --surface: #f1e7d3; --surface-alt: #e6dabf; --accent: #7a22ff; --accent-strong: #6312e0; --on-accent: #ffffff;` and the radii.

The surface context applies to this selector list:

```css
.on-surface,
[class^="bg-surface"], [class*=" bg-surface"],
[class*="hover:bg-surface"]:hover { /* surface values */ }
.on-ground,
[class^="bg-bg"], [class*=" bg-bg"],
[class^="bg-nav"], [class*=" bg-nav"] { /* ground values */ }
```

Put the ground list after the surface list so a `bg-bg` block nested in a card wins. Add `accent`, `accent-strong`, `on-accent`, `nav` to `@theme inline`. `warm` deliberately becomes a neutral: self-reported things read as neutral, evidence as green, actions as purple.

- [ ] **Step 4: Checkpoint.** `npm run lint && npx tsc --noEmit` pass.

### Task 2: Purple for actions, outlined self cells, no theme switch

**Files:**
- Modify: `app/ui/primitives.tsx` (`primaryButtonClass`), `app/(protected)/NavLinks.tsx` (pending badge, hover), `app/(protected)/NavBar.tsx` (`bg-nav`, drop toggle), `app/ui/cell-color.ts`, `app/ui/EvidenceGrid.tsx`, `app/page.tsx`, `app/onboarding/page.tsx`, `app/onboarding/steps/BranchStep.tsx`, `app/layout.tsx`
- Delete: `app/ui/ThemeToggle.tsx`
- Test: `tests/cell-color.test.ts`

**Interfaces:**
- Produces: `cellStyle(level: CellLevel, self: boolean): React.CSSProperties` in `app/ui/cell-color.ts`, replacing `cellColor`.

- [ ] **Step 1: Write `tests/cell-color.test.ts`.**

```ts
it("fills evidence cells", () => {
  expect(cellStyle(3, false)).toEqual({ backgroundColor: "var(--cell-3)" });
});
it("draws level 0 the same for both kinds", () => {
  expect(cellStyle(0, true)).toEqual(cellStyle(0, false));
});
it("outlines self cells and never fills them", () => {
  const s = cellStyle(4, true);
  expect(s.backgroundColor).toBeUndefined();
  expect(s.boxShadow).toContain("inset");
});
it("grows the inner mark with the self level", () => {
  const size = (l: CellLevel) => parseInt(String(cellStyle(l, true).backgroundSize));
  expect(size(1)).toBeLessThan(size(2));
  expect(size(3)).toBeLessThan(size(4));
  expect(size(4)).toBeLessThanOrEqual(60);
});
```

- [ ] **Step 2: Run `npx vitest run tests/cell-color.test.ts`.** Expected: FAIL, `cellStyle` is not exported.

- [ ] **Step 3: Implement `cellStyle`.** Self cells with level ≥ 1: an inset `box-shadow` outline in `var(--cell-4)` plus a centred, non-repeating `linear-gradient(var(--cell-4), var(--cell-4))` background whose `backgroundSize` is `24% / 36% / 48% / 60%` for levels 1 to 4. Replace every `cellColor` call (`EvidenceGrid`, `EvidenceStrip`, `GridLegend`, landing `SourceCell`) by spreading `cellStyle` into `style`. In `BranchStep.tsx` replace the inline `color-mix(... var(--warm) ...)` with `cellStyle(level, true)`. Remove `text-warm-strong` from the self column header in `EvidenceGrid`.

- [ ] **Step 4: Run the test.** Expected: PASS.

- [ ] **Step 5: Move actions to purple.** `primaryButtonClass` becomes `bg-accent text-on-accent hover:bg-accent-strong` with a faint light outline (`shadow-[0_0_0_1px_rgba(244,236,219,0.35)]`) so the shape reads on green. The pending-invite badge in `NavLinks.tsx` becomes `bg-accent text-on-accent`. Nav link hover becomes `hover:bg-white/10 hover:text-ink`.

- [ ] **Step 6: Remove the switch.** Delete `ThemeToggle.tsx` and its three uses; delete `THEME_INIT_SCRIPT`, the `<head>` script and both `suppressHydrationWarning` props in `app/layout.tsx`. `NavBar` header becomes `bg-nav/95`.

- [ ] **Step 7: Checkpoint.** `npm test && npm run lint && npx tsc --noEmit` pass.

### Task 3: Guide rules (pure)

**Files:**
- Create: `lib/guide-core.ts`
- Test: `tests/guide-core.test.ts`

**Interfaces:**
- Produces:

```ts
export const GUIDE_STEPS = ["profile", "hackathon", "team", "invites", "feedback"] as const;
export type GuideStepId = (typeof GUIDE_STEPS)[number];
export const ACK_STEPS: readonly GuideStepId[] = ["invites", "feedback"];
export const GRID_PREVIEW_ROWS = 5;
export type GuideFacts = {
  skillCount: number; evidenceSources: number;
  joinedHackathon: boolean; onTeam: boolean; sentInviteOrRequest: boolean;
  respondedToInvite: boolean; gaveFeedback: boolean; seenSteps: readonly string[];
};
export type GuideState = {
  done: Record<GuideStepId, boolean>;
  current: GuideStepId | null; doneCount: number; allDone: boolean;
};
export function guideState(facts: GuideFacts): GuideState;
export function guideVisible(endedAt: Date | null, state: GuideState): boolean;
```

- [ ] **Step 1: Write `tests/guide-core.test.ts`** with a `facts(overrides)` helper defaulting to everything empty/false:

```ts
it("starts at profile with nothing on file", () => {
  const s = guideState(facts());
  expect(s.current).toBe("profile"); expect(s.doneCount).toBe(0);
});
it("needs both a skill and an evidence source for profile", () => {
  expect(guideState(facts({ skillCount: 3 })).done.profile).toBe(false);
  expect(guideState(facts({ evidenceSources: 1 })).done.profile).toBe(false);
  expect(guideState(facts({ skillCount: 1, evidenceSources: 1 })).done.profile).toBe(true);
});
it("counts a team membership as having joined a hackathon", () => {
  expect(guideState(facts({ onTeam: true })).done.hackathon).toBe(true);
});
it("finishes the team step on a sent invite or request", () => {
  expect(guideState(facts({ sentInviteOrRequest: true })).done.team).toBe(true);
  expect(guideState(facts({ onTeam: true })).done.team).toBe(true);
});
it("finishes ack steps when seen or when really done", () => {
  expect(guideState(facts({ seenSteps: ["invites"] })).done.invites).toBe(true);
  expect(guideState(facts({ respondedToInvite: true })).done.invites).toBe(true);
  expect(guideState(facts({ seenSteps: ["feedback"] })).done.feedback).toBe(true);
  expect(guideState(facts({ gaveFeedback: true })).done.feedback).toBe(true);
});
it("makes the first unfinished step current, skipping finished ones", () => {
  expect(guideState(facts({ skillCount: 1, evidenceSources: 1, joinedHackathon: true })).current).toBe("team");
});
it("ignores unknown seen steps", () => {
  expect(guideState(facts({ seenSteps: ["nope"] })).doneCount).toBe(0);
});
it("is all done with no current step", () => {
  const s = guideState(facts({ skillCount: 1, evidenceSources: 1, onTeam: true, seenSteps: ["invites", "feedback"] }));
  expect(s.allDone).toBe(true); expect(s.current).toBeNull();
});
it("stays hidden once ended", () => {
  expect(guideVisible(new Date(), guideState(facts()))).toBe(false);
});
it("hides when all done, shows otherwise", () => {
  expect(guideVisible(null, guideState(facts()))).toBe(true);
  const all = guideState(facts({ skillCount: 1, evidenceSources: 1, onTeam: true, seenSteps: ["invites", "feedback"] }));
  expect(guideVisible(null, all)).toBe(false);
});
```

- [ ] **Step 2: Run `npx vitest run tests/guide-core.test.ts`.** Expected: FAIL, module not found.
- [ ] **Step 3: Implement `lib/guide-core.ts`** to the signatures above.
- [ ] **Step 4: Run the test.** Expected: PASS.

### Task 4: Guide progress storage and dashboard data

**Files:**
- Modify: `prisma/schema.prisma` (`Profile`)
- Create: `prisma/migrations/<timestamp>_guide_progress/migration.sql`, `lib/guide.ts`, `lib/home-base.ts`, `app/(protected)/dashboard/actions.ts`

**Interfaces:**
- Consumes: `GuideFacts`, `GuideStepId`, `ACK_STEPS` (Task 3); `feedbackWindow` from `lib/peer-feedback-core.ts`; `listInvitesForUser` from `lib/teams.ts`.
- Produces:

```ts
// lib/guide.ts
export async function getGuideFacts(userId: string, profile: { guideSeenSteps: string[] }): Promise<GuideFacts>;
export async function endGuide(userId: string): Promise<void>;          // sets guideEndedAt only if null
export async function markGuideStepSeen(userId: string, step: GuideStepId): Promise<void>; // ACK_STEPS only, no duplicates
// lib/home-base.ts
export type NeedsYouItem = { key: string; title: string; detail: string; href: string; action: string };
export async function getNeedsYou(userId: string, now?: Date): Promise<NeedsYouItem[]>;
export type MyHackathon = { slug: string; name: string; startsAt: Date; endsAt: Date; status: string };
export async function getMyHackathons(userId: string, now?: Date): Promise<MyHackathon[]>;
// app/(protected)/dashboard/actions.ts ("use server"; actor is always the session user)
export async function hideGuideAction(): Promise<void>;                 // endGuide, revalidate /dashboard
export async function ackGuideStepAction(formData: FormData): Promise<void>; // field "step"; invites redirects to /invites
```

- [ ] **Step 1: Add to `Profile`:** `guideEndedAt DateTime?` and `guideSeenSteps String[] @default([])`.
- [ ] **Step 2: Create the migration** with `npx prisma migrate dev --create-only --name guide_progress`. Confirm the SQL is exactly two `ADD COLUMN`s on `profiles`. Apply with `npx prisma migrate deploy`, then `npx prisma generate`.
- [ ] **Step 3: Implement `lib/guide.ts`.** Facts: `skillCount` = `user_skills` rows; `evidenceSources` from `getEvidenceStatus`; `joinedHackathon` = any `Participation` or `TeamMember`; `onTeam` = any `TeamMember`; `sentInviteOrRequest` = any `TeamInvite` with `createdById = userId`; `respondedToInvite` = any `TeamInvite` with `kind INVITE`, `userId = userId`, `respondedAt` not null; `gaveFeedback` = any `PeerFeedback` from the user.
- [ ] **Step 4: Implement `lib/home-base.ts`.** `getNeedsYou`: one item per pending invite to the user ("{team} invited you", action "Answer", href `/invites`), one per pending request to a team they lead ("{name} asked to join {team}", action "Review", href `/invites`), one per hackathon where feedback is due (spec, designer call 8; action "Give feedback", href `/hackathons/{slug}/feedback`). `getMyHackathons`: hackathons not ended where the user has a `Participation` or `TeamMember`, soonest first; `status` is `On {team}, {n} of {max}` or `You're looking for a team` or `Joined, not looking for a team`.
- [ ] **Step 5: Implement the two server actions.**
- [ ] **Step 6: Checkpoint.** `npm test && npm run lint && npx tsc --noEmit` pass.

### Task 5: Guide view and full grid page

**Files:**
- Create: `app/(protected)/dashboard/GridPanel.tsx`, `app/(protected)/dashboard/GuideView.tsx`, `app/(protected)/profile/grid/page.tsx`
- Modify: `app/(protected)/dashboard/page.tsx`

**Interfaces:**
- Consumes: Tasks 3 and 4; `getSkillGrid`, `GRID_COLUMNS` from `./grid-data`; `listHackathons`; `formatIst`.
- Produces: `GridPanel({ grid, variant }: { grid: DashboardSkillGrid; variant: "side" | "hero" })`; `GuideView({ firstName, state, grid, hackathons, feedbackHref, review })`.

- [ ] **Step 1: `GridPanel`.** First `GRID_PREVIEW_ROWS` rows, the line "{backed} of {total} skills backed", `GridLegend`, and a "See the full grid" secondary button to `/profile/grid`. With no rows: the existing empty-grid treatment and a prompt to upload a resume or connect GitHub.
- [ ] **Step 2: `/profile/grid` page.** Full `EvidenceGrid` (no row limit), legend, back link to the dashboard.
- [ ] **Step 3: `GuideView`.** Layout `lg:grid-cols-[minmax(0,1fr)_20rem]`, grid panel first in DOM order on small screens. Step copy:

| Step | Title | One line | Button |
|---|---|---|---|
| profile | Build your profile | Add your skills, then back them with a resume or GitHub. | Add evidence → `/profile` |
| hackathon | Join a hackathon | Pick the event you want a team for. | Browse hackathons → `/hackathons` |
| team | Find teammates or a team | See who has the skills you need, or join a team with an open slot. | Find teammates → `/dashboard/teammates` (plain link beside it: Browse teams) |
| invites | Answer invites | Invites and join requests land in one place. | See your invites (form → `ackGuideStepAction`) |
| feedback | Give peer feedback | After a hackathon, rate your teammates' skills. It becomes evidence on their grid, and theirs on yours. | Give feedback → `feedbackHref` if set, else "Got it" (form → `ackGuideStepAction`) |

Current step: `border-2 border-accent`, number in accent, open, one primary button. Done: tick in `bg-trust`, one line. Later: dimmed, title is a link. Step 2 shows up to two non-ended hackathons with start date, or "No hackathons are open yet. Check back soon." with no button. "Hide guide" is a text-style form button calling `hideGuideAction`; in `review` mode it is replaced by a "Back to dashboard" link.
- [ ] **Step 4: `page.tsx`.** Load profile, grid, facts; compute `guideState`; if `allDone` and `guideEndedAt` is null call `endGuide`. Render `GuideView` when `guideVisible(...)` or when `searchParams.guide === "1"` (review mode), otherwise `HomeBase` (Task 6; render a placeholder until then). Keep `GithubConnectionBanner`.
- [ ] **Step 5: Checkpoint.** `npm run lint && npx tsc --noEmit` pass; the guide renders in the browser.

### Task 6: Home base

**Files:**
- Create: `app/(protected)/dashboard/HomeBase.tsx`
- Modify: `app/(protected)/dashboard/page.tsx` (remove everything the spec lists under "What leaves the dashboard")

**Interfaces:**
- Consumes: `GridPanel` (variant `hero`), `getNeedsYou`, `getMyHackathons`, `findTeammates`, `findOpenTeams`, `NavTile`.

- [ ] **Step 1: `HomeBase`.** Order: header "Welcome back, {firstName}"; grid hero; "Needs you" (omitted when empty; each row a purple dot, title, detail and a primary button); "Your hackathons" (rows link to `/hackathons/{slug}`; empty: "You haven't joined a hackathon yet." and a plain "Browse hackathons" link); "Explore" (two `NavTile`s: People, Teams, with the existing counts); a small "How SkillGrid works" link to `/dashboard?guide=1`.
- [ ] **Step 2: Checkpoint.** `npm test && npm run lint && npx tsc --noEmit && npm run build` pass.

### Task 7: Page-by-page sweep

- [ ] **Step 1:** Run the app and view every page in the spec's testing list at 1280px and 390px. Fix any text unreadable on its ground, any stray purple, and any leftover amber or blue. Check Review Focus items 1, 2, 4 and 5.
- [ ] **Step 2: Checkpoint.** `npm test && npm run lint && npx tsc --noEmit && npm run build` pass.
