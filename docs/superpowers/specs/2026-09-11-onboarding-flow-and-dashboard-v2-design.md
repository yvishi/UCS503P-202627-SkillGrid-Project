# SkillGrid — Onboarding Flow v2 & Dashboard Specification (Sign-in through Dashboard Landing)

This spec covers: Google sign-in, the resume/no-resume branch, both onboarding paths screen-by-screen,
the resume integrity check, the review-and-submit step, and the dashboard a user lands on afterward
(with dummy/placeholder data for the two dashboard sections, since matching logic isn't built yet).

Supersedes `2026-09-03-onboarding-flow-design.md` for the onboarding flow and adds the dashboard spec.
Implemented on `feature/onboarding-and-dashboard-v2`, branched from `Dev`.

---

## 1. Sign-in

- Single screen, one button: "Sign in with Google."
- Restrict to Thapar institutional accounts (domain-restricted Google Workspace, e.g. @thapar.edu) if feasible —
  this doubles as identity + institutional verification, removing the need for a separate email-OTP step.
- First-time user (no profile record yet) → route to Screen 2 (the branch).
- Returning user (profile already exists) → route straight to Dashboard.

---

## 2. Branch screen

- One question: "Do you have a resume you'd like to upload?"
- Two buttons: "Yes, I have a resume" (→ Path A) / "No, I'll set up manually" (→ Path B)
- No other content on this screen.

---

## 3. Shared UI shell for both paths

- Horizontal stepper/progress bar at the top of every onboarding screen, job-application style.
- Stepper steps (exact order to be finalized separately — do NOT hardcode order yet, see note at bottom):
  Resume/Skills, Interests, Availability, Projects, GitHub (optional), Review & Submit.
- Every screen (except the resume upload and review screens) has a single "Continue" button.
  Optional screens (Projects, GitHub) also show a visible "Skip" option next to Continue.

---

## 4. Path A — "I have a resume"

### 4.1 Resume upload screen
- One file upload field. Accept PDF only. Validate file type and file size client-side.
- On upload, immediately run the FAST INTEGRITY CHECK (see section 6) — this is synchronous and blocking.
  - If check FAILS or is low-confidence: show inline message on this same screen, e.g.
    "This doesn't look like a resume. Try a different file, or continue manually instead."
    Offer two actions: re-upload, or switch to Path B.
  - If check PASSES: kick off the SLOW FULL PARSE (OCR + skill/section extraction) as a background/async job,
    and immediately advance the user to the next onboarding screen. Do not block on the slow parse.

### 4.2 Comfort-level screen
- Uses the fixed skill list (see section 7) — NOT the resume-extracted tags, since those aren't ready yet
  and the review step is where resume tags get reconciled.
- For each skill in the fixed list the user wants to include, a selector: "Just starting / Comfortable / Confident."
- Continue button.

### 4.3 Interests screen
- Multi-select list of interest tags (list TBD, separate from the skills list). Tap to toggle.
- Continue button.

### 4.4 Availability screen
- Reuse whatever availability selector already exists elsewhere in the app (do not redesign).
- Continue button.

### 4.5 Project links screen (optional)
- One text input for a project URL, "add another" to repeat the field.
- Continue and Skip both visible.

### 4.6 GitHub connect screen (optional)
- One button: "Connect GitHub" — starts real GitHub OAuth flow (see section 8).
- "Skip for now" option visible alongside.
- Continue button proceeds regardless of whether GitHub was connected.

### 4.7 Review & Submit screen
- By this point the background full-parse job from 4.1 should have completed (this is *why* it was moved here —
  the other screens buy time for it to finish).
- Shows:
  - Resume-extracted skill tags, editable (add/remove), pre-filled from the parse.
  - Everything entered in 4.2–4.6 as an editable summary (comfort levels, interests, availability, project links,
    GitHub connection status).
- One "Submit" button at the bottom, saves the full profile.
- On submit → route to Dashboard.

---

## 5. Path B — "I don't have a resume"

Same screen shapes as Path A minus the resume upload/parse, and no resume tags to reconcile at review time.

### 5.1 Skills screen (replaces 4.2)
- Since there's no resume, this screen shows the full fixed skill list (section 7) directly.
- Same comfort-level selector per skill as Path A: "Just starting / Comfortable / Confident."
- Continue button.

### 5.2 Interests screen — identical to 4.3
### 5.3 Availability screen — identical to 4.4
### 5.4 Project links screen (optional) — identical to 4.5
### 5.5 GitHub connect screen (optional) — identical to 4.6

### 5.6 Review & Submit screen
- Shows everything entered in 5.1–5.5 as an editable summary. No resume tags section (none exist).
- "Submit" button saves the profile.
- On submit → route to Dashboard.

---

## 6. Resume integrity check (fast, synchronous, blocking)

- Purpose: catch non-resume uploads (blank files, unrelated documents, users testing/breaking the system)
  BEFORE the user proceeds into the rest of onboarding.
- Must be fast — this is a lightweight structural/heuristic classification, NOT full OCR extraction.
- Implementation approach: hardcoded rule-based checks against the parsed text, e.g.:
  - Document contains extractable text at all (not a blank/corrupt/image-only file with no text layer).
  - Presence of resume-like structural signals — section headers such as "Experience," "Education," "Projects,"
    "Skills," or equivalents.
  - Presence of contact-info-like patterns (email pattern, phone-number-like pattern).
  - Reasonable text length (not a 3-word file, not a 500-page file).
- Output: a pass/fail (or confidence score) used immediately to decide whether to block or advance the user.
- This check is separate from, and runs before, the slow full parse in section 4.1.

---

## 7. Fixed skill list

- Single defined list used consistently everywhere (not improvised per screen).
- ~20 hackathon-relevant tags spanning languages, web/mobile frameworks, dev-ops/cloud tools, data/ML,
  design/product. Drafted as part of this implementation in `lib/skills.ts`.

---

## 8. GitHub connection — implementation note

- Use real GitHub OAuth (not a typed-in username field). Standard flow: "Connect GitHub" button → GitHub's
  own consent screen → redirect back with an authorization code → server exchanges it for an access token →
  token stored server-side, never exposed to client.
- No GitHub OAuth app credentials are available in this environment, so this implementation uses the
  documented temporary placeholder instead: a text field for a GitHub profile URL, clearly labeled as
  unverified/temporary. Swapping in real OAuth is a follow-up (see auth.ts's existing note that GitHub is
  reserved as a per-user evidence source, not a sign-in provider).

---

## 9. Dashboard (landing screen after onboarding submit, and after every future login)

- New users land here immediately after Review & Submit. Returning users land here on every login.
- Dashboard is populated from the start for every user — it shows the population of OTHER users/teams,
  not the viewing user's own activity, so it is never empty even for a brand-new account.
- Two sections for this first version (more sections, e.g. AI Team Builder, notifications, will be added later
  as separate dashboard sections/cards — the dashboard shell should be built to accommodate more sections
  being added later without restructuring):

  ### 9.1 "Find Teammates" section
  - Listing of individual user profiles (dummy/placeholder data for now, since matching/scoring isn't built).
  - Each entry shows enough to browse: name, headline skills/interests, profile-strength indicator (placeholder).
  - Action: invite this person to a team you're building.

  ### 9.2 "Find a Team" section
  - Listing of existing teams that have an open slot (dummy/placeholder data for now).
  - Each entry shows: team name/hackathon, what they're looking for, current members (placeholder).
  - Action: apply to join this team.

- Profile page remains reachable from the dashboard at any time (already exists).

---

## Implementation decisions made for this pass

- **Visual theme**: replacing the default Next.js neutral/indigo/Geist look with a distinct SkillGrid theme —
  warm off-white/ink palette with a single accent color, a serif display face for headings paired with a
  humanist sans for body text. Full rationale recorded via the frontend-design skill during implementation.
- **Per-skill comfort ratings** require a schema change: `Profile` gains a `skillRatings Json` field
  (`{ [skillSlug]: "STARTING" | "COMFORTABLE" | "CONFIDENT" }`), additive to the existing single `comfortLevel`
  enum (kept for backward compatibility with the existing profile page, but no longer written by onboarding v2).
- **Resume parsing**: fast integrity check and a lightweight keyword-based "slow parse" (matches resume text
  against the fixed skill list) both run server-side using `pdf-parse`; there is no OCR/ML pipeline in this
  phase, matching the spec's explicit deferral.
- **GitHub**: implemented as the documented unverified-URL placeholder, not real OAuth.
- **Dashboard dummy data**: hardcoded fixture arrays for "Find Teammates" and "Find a Team", not database-backed,
  since matching logic is explicitly out of scope.

## Open items intentionally deferred (not part of this spec)

- Exact final stepper ordering across all screens — to be specified precisely in a later summary once this
  part is built, per explicit instruction not to re-litigate ordering now. (This pass uses the order listed
  in section 3.)
- Real backend logic for Find Teammates / Find a Team ranking — dashboard sections are placeholder/dummy data
  in this phase.
- Full OCR/skill-extraction pipeline internals (parsing accuracy, entity extraction detail) — only the
  fast/slow split and where each fits in the flow is specified here.
- Real GitHub OAuth wiring — placeholder URL field for now.
