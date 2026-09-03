# Onboarding Flow Design

## Context

Google Sign-In (restricted to the college domain) already creates a
bare `User` row on first login, but nothing populates `Profile` yet.
This spec covers the screen and logic that runs between "just signed
in for the first time" and "has a usable profile in the app" —
implementing the Path A / Path B split already described in
`Reports/skillgrid-project-spec.md`, adapted to the auth model actually
built (Google Sign-In, not GitHub-as-login).

## Goals

- A new user fills in the minimum needed to get a usable profile, in
  one screen, then enters the app immediately.
- Path A (has resume and/or GitHub) and Path B (Explorer,
  self-reported) both converge on the same `Profile` row afterward —
  nothing downstream needs to know which path a user took.
- Self-reported data (Path B) is stored as plain profile fields, not
  as `EvidenceRecord`s — per the spec's "evidence over self-report"
  principle, only verifiable sources (GitHub, resume, peer feedback)
  count as evidence.

## Explicitly out of scope (deferred to later, separate work)

- **Resume parsing** (spec Section 7a: OCR + regex, no AI). This spec
  only accepts and stores the uploaded file; a later pipeline reads
  records with `payload.status === "pending_parse"` and fills in
  extracted fields.
- **Real GitHub OAuth linking for evidence.** The onboarding screen
  does not offer a working "Connect GitHub" button. Path A's
  requirement is satisfied by resume upload alone for now. When
  GitHub linking ships later, it becomes a second way to satisfy Path
  A, and the "resume only" rule below relaxes to "resume OR GitHub."

## Data model changes

Additions to `prisma/schema.prisma`:

- **`Profile`** gains:
  - `onboardingCompletedAt DateTime?` — `null` means the user has not
    finished onboarding; this is the field the route gate checks.
  - `comfortLevel` — enum `Beginner | Intermediate | Advanced`
    (Path B only, nullable).
  - `interestTags String[]` — multi-select from a fixed list defined
    in application code (not a DB-backed taxonomy yet), e.g. Web Dev,
    Backend, ML, Data, Design, Mobile, DevOps, Security, ... (Path B
    only).
  - `availability` — enum `Weekdays | Weekends | Both | Flexible`
    (Path B only, nullable).
  - `projectLinks String[]` — up to 3 URLs, optional (Path B only).
- **Resume upload** does not require a schema change: it creates an
  `EvidenceRecord` with `source: RESUME` and
  `payload: { fileUrl, status: "pending_parse" }`, using the existing
  JSONB payload column.

## File storage

Resumes are uploaded to **Vercel Blob** (same reasoning as choosing
Vercel Postgres/Neon: zero extra infra, same dashboard, and a
`DATABASE_URL`-style env-var swap is all that's needed to move
providers later if ever required).

## Route gating

A shared server layout, `app/(protected)/layout.tsx`, wraps every
route that requires a completed profile (initially just the home
page). Deliberately **not** Next.js middleware: middleware runs on
the Edge runtime by default, which can't use our Node-based Prisma
client without a second, HTTP-based DB driver just for this one
check. A server component layout runs as a normal Node.js server
function, so `await auth()` and `prisma.profile.findUnique(...)` work
with no special runtime configuration.

Logic in the layout:

1. No session → let Auth.js's existing sign-in flow handle it
   (unchanged).
2. Session exists, `Profile` missing or `onboardingCompletedAt` is
   `null` → redirect to `/onboarding`.
3. Session exists, onboarding complete → render children normally.

`/onboarding` itself checks the inverse: if `onboardingCompletedAt` is
already set, redirect to `/`, so a finished user can't re-enter the
wizard by navigating there directly.

## The `/onboarding` screen

Single page, no multi-step navigation:

1. **Path picker** (always visible): two cards, *"I have a resume or
   GitHub"* (Path A) vs. *"I'll set it up manually"* (Path B).
   Selecting one reveals that path's fields in place, below the
   picker.
2. **Path A fields:**
   - Resume upload (drag-and-drop or click), PDF/DOCX only, 5MB max,
     validated client-side before upload.
   - A visibly-disabled "Connect GitHub" button labeled "Coming
     soon" — present so the UI doesn't need reshuffling once GitHub
     linking ships, but inert for now.
   - **Validation:** resume is required to submit (GitHub can't yet
     satisfy the "at least one" rule, since it isn't functional).
3. **Path B fields:**
   - Comfort level: single-select, required, no default.
   - Interest tags: multi-select chips from the fixed list, at least
     one required.
   - Availability: single-select, required, no default.
   - Project links: up to 3 optional URL inputs, validated as
     well-formed URLs if filled in.
4. **Submit** (a server action):
   - Path A: upload the file to Vercel Blob, then in a single Prisma
     transaction, create the `EvidenceRecord` and set
     `Profile.onboardingCompletedAt = now()` (creating `Profile` if it
     doesn't exist yet).
   - Path B: in a single Prisma transaction, write the four fields
     above onto `Profile` and set `onboardingCompletedAt = now()`.
   - Redirect to `/` on success.

## Error handling

- Client-side: reject oversized/wrong-type files and malformed URLs
  before submission, with inline messages.
- Server-side: if Path A submits with no resume, reject with "Please
  upload a resume to continue."
- Ordering: blob upload happens before the DB transaction. If the DB
  write fails after a successful upload, the orphaned blob is
  accepted as low-value cleanup debt for now — not worth building
  reconciliation logic for a course-project-scale deployment.

## Testing

No automated test framework exists in this repo yet. Verification is
manual, consistent with how auth and the Prisma setup were verified
earlier:

- Fresh sign-in redirects to `/onboarding`.
- The home page is inaccessible until onboarding completes.
- Path A submission with a resume succeeds; without one, is blocked.
- Path B submission with all required fields succeeds; missing a
  required field is blocked.
- Re-visiting `/onboarding` after completion redirects to `/`.
