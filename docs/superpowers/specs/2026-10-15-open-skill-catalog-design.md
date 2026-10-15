# SkillGrid — Open Skill Catalog Design

Replaces the fixed 20-entry skill list (`lib/skills.ts` `SKILLS`) with a database-backed,
searchable skill catalog that grows through verified user reports, and widens automatic
skill detection from GitHub and resumes.

Branched as `feature/open-skill-catalog` from `Dev` (after PR #13, the UI redesign, merged).

---

## 1. Problem and goals

Every skill path is gated on a hard-coded list of 20 slugs:

- GitHub: `mapGithubLanguageToSkill` knows 8 languages. Rust, Kotlin, HTML, Shell, etc. are dropped.
- Resume: `SKILL_KEYWORDS` only matches those 20 skills.
- Self-rating: the onboarding screen lists only those 20 rows.

**Goals**

1. A person can list any real skill they have, not just ones we anticipated.
2. Finding your skills is easy: type-ahead search, browse by category, and one-click suggestions
   from GitHub/resume evidence.
3. The catalog stays clean: "React", "ReactJS", "react.js" are one skill; typos like "Raect" never
   become catalog entries.
4. Skills are stored in a queryable shape so teammate matching ("who knows Rust?") is an indexed query.

**Decisions taken during design**

| Question | Decision |
|---|---|
| Vocabulary source | Seeded catalog (~300–500 entries) in a DB table, extendable. |
| Users typing unknown skills | Cannot create catalog entries. They **report** the skill; an admin verifies, then approves, merges or rejects it. |
| Review tooling | In-app admin page `/admin/skill-requests`, gated by `ADMIN_EMAILS` env var. |
| GitHub signals | All repo languages (byte breakdown) + repo topics. Dependency manifests are **future work**. |
| Auto-detected skills | Shown as **evidence** in the grid and as **suggestions** in the picker. **Not** auto-added to self-ratings (this changes current behaviour). |
| Storage | `Skill` catalog table + `UserSkill` join table, replacing `Profile.skillRatings` JSON. |

**Out of scope:** dependency-manifest scanning, teammate/team matching logic (still fixtures),
peer feedback, admin tools to merge two existing catalog skills, content moderation beyond
validation + admin review.

---

## 2. Data model

### 2.1 Prisma models

```prisma
model Skill {
  id          String        @id @default(cuid())
  slug        String        @unique          // "react", "rust", "csharp"
  name        String                         // display name: "React", "C#"
  aliases     String[]      @default([])     // display-form aliases: "ReactJS", "React.js"
  keys        String[]      @default([])     // skillKey() of slug, name and each alias
  category    SkillCategory @default(OTHER)
  origin      SkillOrigin   @default(CURATED)
  strictMatch Boolean       @default(false)  // resume matcher: case-sensitive (see 4.2)

  users     UserSkill[]
  createdAt DateTime @default(now())

  @@index([keys], type: Gin)
  @@map("skills")
}

model UserSkill {
  userId  String
  skillId String
  level   ComfortLevel                       // existing enum: BEGINNER | INTERMEDIATE | ADVANCED

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  skill Skill @relation(fields: [skillId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@id([userId, skillId])
  @@index([skillId])                         // "who knows X?"
  @@map("user_skills")
}

model SkillRequest {
  id              String             @id @default(cuid())
  userId          String
  rawName         String             // exactly as typed, trimmed
  key             String             // skillKey(rawName)
  requestedLevel  ComfortLevel
  note            String?            // optional, <= 200 chars
  status          SkillRequestStatus @default(PENDING)
  resolvedSkillId String?            // set on APPROVED / MERGED
  reviewedAt      DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([userId, key])
  @@index([status, key])
  @@map("skill_requests")
}

enum SkillCategory {
  LANGUAGE
  FRAMEWORK
  LIBRARY
  TOOL
  PLATFORM
  DATABASE
  DESIGN
  CONCEPT
  OTHER
}

enum SkillOrigin {
  CURATED    // seed catalog
  GITHUB     // created from a GitHub linguist language name
  REQUESTED  // approved from a user report
}

enum SkillRequestStatus {
  PENDING
  APPROVED
  MERGED
  REJECTED
}
```

`User` gains `skills UserSkill[]` and `skillRequests SkillRequest[]`.
`Profile.skillRatings` is removed (see section 7).

### 2.2 Normalisation — `lib/skill-normalize.ts` (pure, no DB)

- `skillKey(text)`: NFKC → lowercase → trim → remove whitespace, `.`, `-`, `_`. `+` and `#` are kept.
  - `"React.js"`, `"react js"`, `"ReactJS"` → `reactjs`. `"C++"` → `c++`. `"C#"` → `c#`.
- `toSlug(text)`: `+` → `plus`, `#` → `sharp`, other non-alphanumerics → `-`, collapsed and trimmed.
  Used only when creating a skill (GitHub language or admin approval). Curated slugs are hand-set
  (`cpp`, `csharp`). On collision a numeric suffix is appended.
- `validateSkillName(text)`: 1–40 chars after trim, contains at least one letter, not a URL,
  not punctuation-only. Returns `{ ok: true } | { ok: false; reason }`.
- `editDistance(a, b)`: Levenshtein, used for "did you mean".
- `LEGACY_SLUGS`: maps retired slugs to current ones —
  `pytorch-tensorflow → [pytorch, tensorflow]`, `pandas-numpy → [pandas, numpy]`. All other old
  slugs are kept unchanged in the catalog.

### 2.3 Catalog access — `lib/skill-catalog.ts` (DB-backed)

- `findSkillByText(text)`: one indexed query, `keys has skillKey(text)`.
- `resolveGithubLanguage(name)`: `findSkillByText`, else create with `origin: GITHUB`,
  `category: LANGUAGE`. Unique-slug race → catch, re-find. **Only GitHub linguist names may create
  skills automatically**; user input never does.
- `searchSkills(query, limit = 10)`: ranked groups — exact key match → name/slug prefix →
  substring (name, slug or alias). Within each group, order by `UserSkill` count desc, then name.
  Each result includes `matchedAlias` when an alias matched.
- `suggestSimilar(text, limit = 3)`: closest skills by `editDistance` over cached keys, with
  distance ≤ max(1, floor(len/4)).
- `popularByCategory(category, limit = 12)`: for the browse panel.
- **Catalog cache:** an in-memory list of `{ id, slug, name, aliases, keys, strictMatch }` with a
  5-minute TTL, used by the resume matcher and `suggestSimilar`. Admin approve/merge invalidates it
  on that instance. Other instances may lag up to 5 minutes.

### 2.4 Seed catalog

- `prisma/seed-data/skills.ts`: an array of `{ slug, name, aliases, category, strictMatch? }`,
  ~300–500 entries. Contents: GitHub linguist programming/markup languages commonly seen in student
  repos, plus popular frameworks, libraries, tools, cloud platforms, databases and design tools. It
  contains every current slug except the two split ones.
- `strictMatch: true` for names that are common words or letters: Go, R, C, D, Swift, Rust, Make,
  Spring, Express, Ruby, Julia, Dart, Elm. Rule for further entries: set it when the lowercase name is
  an ordinary English word or is ≤ 2 characters.
- `prisma/seed.ts`: upserts by slug and recomputes `keys`. It is idempotent.
- `package.json`: `"prisma": { "seed": "tsx prisma/seed.ts" }`. Adds `tsx` as a devDependency.

---

## 3. Skill requests (reporting a missing skill)

### 3.1 User side — `reportSkillAction({ rawName, level, note })`

1. Requires a session.
2. Validates with `validateSkillName`; `note` ≤ 200 chars.
3. If `findSkillByText(rawName)` now matches, the skill is added to the user directly
   (onboarding: returned to the client to add to its state) and `{ status: "exists", skill }` is
   returned instead of creating a request.
4. If the user has ≥ 10 `PENDING` requests → error "You have 10 pending reports — wait for review."
5. Creates the `SkillRequest`. A `(userId, key)` unique conflict → "You've already reported this."

`cancelSkillRequestAction(id)`: the owner can delete their own `PENDING` request.

Pending requests show to the user as grey "Pending review" rows. They are **not** in the grid and
not used for matching. A `REJECTED` request shows once as "Not added" until dismissed (dismiss
deletes the request row).

### 3.2 Admin side — `/admin/skill-requests`

- `app/admin/layout.tsx`: `notFound()` unless the session email (case-insensitive) is in
  `ADMIN_EMAILS` (comma-separated env var). Every admin server action re-checks this via a shared
  `requireAdmin()` in `lib/admin.ts`.
- Queue: `PENDING` requests grouped by `key`. Each group shows the distinct raw spellings, the number
  of reporters, notes, the oldest `createdAt`, and `suggestSimilar` candidates.
- Actions per group, each one Prisma transaction:
  - **Approve**: an editable form (name, slug, category, aliases, strictMatch) prefilled from the
    most common spelling. Creates the `Skill` (`origin: REQUESTED`, `keys` computed). Marks every
    pending request in the group `APPROVED` with `resolvedSkillId`. Creates a `UserSkill` for each
    reporter at their `requestedLevel` (`skipDuplicates`). A slug collision returns a form error
    that suggests Merge.
  - **Merge into**: pick an existing skill via the same search; an optional "also add as alias"
    checkbox adds the most common spelling to `aliases`/`keys`. Marks the group `MERGED` and creates
    `UserSkill` rows as above.
  - **Reject**: marks the group `REJECTED`.
  - An action on requests that are no longer `PENDING` is a no-op with a notice (double-click or
    two admins).
- Approve and merge invalidate the catalog cache.

---

## 4. Detection

### 4.1 GitHub — `lib/github.ts`

1. List repos as today (`/users/{login}/repos`, `type=owner`, `sort=pushed`, `per_page=100`) and drop
   forks. Keep each repo's `topics` (included in the listing).
2. For the 30 most recently pushed non-fork repos, `GET /repos/{owner}/{repo}/languages` with
   concurrency 5. A failure on one repo skips that repo only.
3. **Languages** — total bytes and repo count per language. A language qualifies if it is ≥ 1% of
   some repo's bytes or appears in ≥ 2 repos. An ignore list drops build/config noise: `Makefile`,
   `Batchfile`, `Procfile`, `Roff`. `CMake` and `Dockerfile` are **not** ignored (`Dockerfile` maps
   to Docker via an alias).
   Each qualifying language → `resolveGithubLanguage`.
4. **Topics** — count repos per topic, `findSkillByText(topic)`. Keep matches only; topics never
   create skills.
5. **Levels** (pure function `githubSkillLevels`, unit-tested):
   - 4: language that is the top language by bytes, or ≥ 25% of all bytes.
   - 3: language ≥ 5% of bytes or in ≥ 3 repos; topic in ≥ 2 repos.
   - 2: anything else that qualified.
   - A skill found via both language and topic takes the higher level and lists both in `via`.
6. Payload v2 (`EvidenceRecord.payload` for `source: GITHUB`):

   ```ts
   type GithubEvidencePayloadV2 = {
     version: 2;
     username: string;
     name: string | null;
     avatarUrl: string | null;
     verified: true;
     connectedAt: string;
     reposScanned: number;
     skills: { slug: string; level: 2 | 3 | 4; bytes?: number; repos: number; via: ("language" | "topic")[] }[];
   };
   ```

   Readers also accept v1 (`languages: slug[]`): index 0 → level 4, the rest → 3, slugs passed
   through `LEGACY_SLUGS`.
7. The callback **no longer writes self-ratings**. `mergeSkillRatings` is deleted. The callback
   still replaces the GITHUB record and sets `Profile.githubUsername`.

### 4.2 Resume — `lib/resume-parser.ts`

- Matching runs over the cached catalog (names and aliases), not `SKILL_KEYWORDS` (deleted).
- Each keyword is regex-escaped and matched with `(?<![a-z0-9])kw(?![a-z0-9])` against lowercased
  text. This handles `c++`, `c#`, `node.js` and `react native` uniformly.
- `strictMatch` skills match case-sensitively against the **original** text using the display name
  and aliases as written ("Go" matches, "go to" does not).
- Single-character names (C, R) additionally count only inside a detected Skills section: text from
  a line matching `/^\s*(technical\s+)?skills\b/i` up to the next line that looks like a section
  header from `SECTION_HEADERS`.
- `extractedSkills` remains `string[]` of slugs, now any catalog slug.
- Resume upload (onboarding and `/profile/resume`) **no longer writes self-ratings**.

### 4.3 Suggestions — `getSkillSuggestions(userId)` in `lib/skill-suggestions.ts`

The union of the GitHub payload skills and the active resume's `extractedSkills`, minus the user's
`UserSkill`s. Each entry is `{ slug, name, sources: ("github" | "resume")[], strength }`, sorted by
strength (GitHub level, +1 if also on the resume) then name. Onboarding computes the same from
client state (resume result + GitHub record) through a server action.

---

## 5. UI

### 5.1 `SkillPicker` — `app/ui/skill-picker/`

A client component shared by onboarding and `/profile/skills`. It takes callbacks
(`onAdd`, `onSetLevel`, `onRemove`, `onReport`, `onCancelReport`) so each host decides whether to
persist immediately or hold state. Sections, top to bottom:

1. **Suggestions strip — "Found in your evidence"**: teal evidence chips labelled `GitHub` /
   `Resume`. Click adds the skill at Comfortable; **Add all** adds every suggestion. Hidden when empty.
2. **Search** (ARIA combobox): 150 ms debounce → `GET /api/skills/search?q=`. Results show name,
   category tag and the matched alias ("ReactJS → React"). Enter/click adds at Comfortable.
   Already-added skills render as "Added" and are disabled.
   With no results: "Did you mean …" chips (`suggestSimilar`) and
   **"Can't find it? Report '‹text›'"**, which opens an inline form (comfort level selector +
   optional note) → `onReport`.
3. **Browse by category** (collapsed by default): category tabs, each showing up to 12 popular
   skills as chips (`GET /api/skills/popular?category=`).
4. **Your skills**: the existing `SkillRow` 3-cell amber rating plus an explicit remove (×) button.
   Clicking the selected level no longer clears it. Pending reports below as grey rows with Cancel.
   Rejected reports show as "Not added" with Dismiss.

### 5.2 Onboarding

- Wizard state: `skillRatings` → `skills: { slug, name, level }[]` and
  `pendingReports: { id, rawName }[]`. The localStorage draft key gets a version suffix, so old
  drafts are discarded.
- `SkillsStep` hosts `SkillPicker` (state held client-side; reports go to the server immediately).
- Continue requires ≥ 1 skill **or** ≥ 1 pending report.
- `ReviewStep`: no more resume-tag reconciliation into ratings. The grid preview shows Self from
  `skills`, plus Resume and GitHub columns as evidence when present.
- `submitOnboardingAction` validates each slug exists in `Skill` and each level, then in one
  transaction upserts the profile and replaces the user's `UserSkill` rows.

### 5.3 `/profile/skills`

A new protected page hosting `SkillPicker`, with server actions `addUserSkillAction(slug, level)`,
`setUserSkillLevelAction(slug, level)` and `removeUserSkillAction(slug)`. Updates are optimistic and
revert with a short error message on failure. The profile page's grid header gets an "Edit skills" link.

### 5.4 Grid — `lib/skill-grid.ts`

- `buildSkillGrid({ userSkills, resumePayload, githubPayload, skillNames })`, where
  `userSkills: { slug, name, level }[]` and `skillNames: Map<slug, name>` covers evidence-only slugs
  (fetched by the caller with one `Skill.findMany({ where: { slug: { in } } })`).
- Rows: the union of user skills and evidence skills. The sort is unchanged (evidence desc, total
  desc, then name). Unknown slugs are dropped.
- The GitHub column uses each payload skill's `level`; the Resume column stays at 3.
- Dashboard and profile grids show the top 15 rows with a "Show all N" toggle.
- The dashboard's "skills rated" count comes from the `UserSkill` count.

### 5.5 API routes

- `GET /api/skills/search?q=`: 401 without a session. `q` is trimmed and capped at 40 chars; empty
  returns `[]`. Returns `{ results, didYouMean }` (`didYouMean` only when `results` is empty).
- `GET /api/skills/popular?category=`: 401 without a session; 400 on an unknown category.

---

## 6. Error handling

| Situation | Behaviour |
|---|---|
| GitHub token/user/repo listing fails | Unchanged: redirect with `?github=error`. |
| One `/languages` call fails | Skip that repo. If all fail, topics are still used. |
| Search route without session / bad input | 401 / empty results. |
| Report: invalid name | Inline validation message. |
| Report: skill already in catalog | Add the skill to the user instead; no request. |
| Report: duplicate / 10 pending | Inline message. |
| Admin action on non-pending requests | No-op with notice. |
| Admin approve: slug collision | Form error suggesting Merge. |
| Evidence slug missing from catalog | Dropped from grid silently. |
| `/profile/skills` action fails | Optimistic change reverted, error message shown. |

---

## 7. Migration and deployment

One Prisma migration, `open_skill_catalog`:

1. Create enums, `skills`, `user_skills`, `skill_requests`; GIN index on `skills.keys`.
2. Insert the legacy catalog rows in SQL (the 18 unchanged current slugs plus `pytorch`,
   `tensorflow`, `pandas`, `numpy`) with their names, aliases and keys, so the copy below has targets
   before the seed runs.
3. Copy ratings: `INSERT INTO user_skills (...) SELECT ... FROM profiles p, jsonb_each_text(p."skillRatings") r`
   joined through a `VALUES` mapping table (legacy slug → new slug, two rows for each split slug),
   casting the level to `"ComfortLevel"`, `ON CONFLICT DO NOTHING`.
4. Drop `profiles."skillRatings"`.

Deployment follows current practice: migrations are run manually (the Vercel workflow does not
migrate). Order: `npx prisma migrate deploy` → `npx prisma db seed`. Before migrating the deployed
DB, run it on a copy of the dev DB and check that the `user_skills` row count ≥ the total number of
keys across all `skillRatings` JSON values (splits make it greater).

New env var: `ADMIN_EMAILS` (documented in `.env.example`).

---

## 8. Testing

Add **Vitest** (devDependency, `npm test`) for pure logic:

- `skillKey`, `toSlug`, `validateSkillName`, `editDistance` — including React.js / ReactJS,
  C++ / C#, Node JS, whitespace-only and URL inputs.
- Resume matcher (catalog passed in, no DB): punctuation keywords, word boundaries, `strictMatch`
  casing, single letters only inside a Skills section, and regressions for "projects" ≠ TS,
  "digital" ≠ Git, "javascript" ≠ Java.
- GitHub aggregation and `githubSkillLevels` with fixture data (no network): 1% / 2-repo threshold,
  ignore list, level thresholds, topic filtering, language+topic combination.
- `buildSkillGrid`: union of rows, sort order, v1 payload compatibility via `LEGACY_SLUGS`, unknown slugs dropped.
- `getSkillSuggestions` ranking (pure core function).

Manual checklist (written into the implementation plan): migration on a dev-DB copy; onboarding
Path A and Path B; connecting a real GitHub account; report → approve / merge / reject; non-admin gets
404 on `/admin/skill-requests`; `/profile/skills` add / rate / remove; `npm run lint` and
`npm run build` pass.

---

## 9. Future work

- Dependency-manifest scanning (`package.json`, `requirements.txt`, `pyproject.toml`, `go.mod`,
  `Cargo.toml`, `pom.xml`) for framework and library detection.
- Admin merge of two existing catalog skills; alias management UI.
- Teammate matching queries on `UserSkill`.
