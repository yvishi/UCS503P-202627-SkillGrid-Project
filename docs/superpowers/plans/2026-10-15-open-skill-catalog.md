# Open Skill Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed 20-skill list with a database-backed, searchable skill catalog. Users report missing skills for admin review, and GitHub/resume detection covers the whole catalog.

**Architecture:** A `Skill` catalog table (seeded with about 320 entries, with aliases and normalised lookup `keys`) plus a `UserSkill` join table replace the `Profile.skillRatings` JSON. Pure modules (`lib/skill-normalize.ts`, `lib/skill-catalog-core.ts`, matchers and scorers) hold all the logic and are unit-tested with Vitest. Thin server modules wrap Prisma. One self-contained `SkillPicker` client component (search, suggestions, browse, report) saves through server actions and is used by both onboarding and a new `/profile/skills` page. An `ADMIN_EMAILS`-gated `/admin/skill-requests` page verifies reported skills.

**Tech Stack:** Next.js 16.3.3 (App Router, server actions), React 19, Prisma 6.19.3 on Postgres (Neon), Tailwind 4, Vitest 3.2.4, tsx 4.20.3.

**Spec:** `docs/superpowers/specs/2026-10-15-open-skill-catalog-design.md`

## Global Constraints

- All paths below are relative to `code/frontend/`. Run every command from `code/frontend/`.
- Exact dev dependency versions: `vitest@3.2.4`, `tsx@4.20.3`. Do not upgrade any other dependency.
- **Database safety:** `.env` `DATABASE_URL` points at Neon host `ep-small-base-az24ur6p-pooler…neon.tech`, which may be the same database the deployed app uses. Before the first `prisma migrate` command (Task 2), stop and ask the user to confirm it is a dev database or Neon branch. Never run a migration against a database the user has not confirmed.
- New code never reads or writes `Profile.skillRatings`. The column stays in the schema, marked deprecated, until the data copy is verified on production. It is dropped in a follow-up (Task 11, Step 7).
- User input never creates `Skill` rows. Only GitHub linguist language names auto-create, with `origin: "GITHUB"`, `category: "LANGUAGE"`, `strictMatch: true`. Admin approval creates `origin: "REQUESTED"`.
- Comfort labels stay "Just starting" / "Comfortable" / "Confident" (`BEGINNER`/`INTERMEDIATE`/`ADVANCED`). A newly added skill defaults to `INTERMEDIATE`.
- Limits (verbatim from spec):
  - Skill name 1–40 characters; report note ≤ 200 characters; at most 10 pending reports per user.
  - GitHub: 30 most recent non-fork repos for languages, fetched 5 at a time. A language qualifies at ≥ 1% of some repo or in ≥ 2 repos. Levels: 4 = top or ≥ 25%; 3 = ≥ 5% or ≥ 3 repos, or a topic in ≥ 2 repos; 2 otherwise.
  - Grids show the top 15 rows with a "Show all" toggle.
  - Search: 150 ms debounce, 10 results, 3 "did you mean" suggestions, 12 popular per category.
  - Catalog cache TTL 5 minutes.
- The tsconfig target is ES2017, so regexes with lookbehind are built with `new RegExp(...)`, never as regex literals.
- `lib/skill-normalize.ts`, `lib/skill-catalog-core.ts` and `prisma/seed-data/skills.ts` use **relative** imports only, because the seed script runs them through `tsx`.
- Code style: match the surrounding code. Use comments that explain *why*, and Tailwind tokens already in `app/globals.css` (`bg`, `surface`, `surface-alt`, `ink`, `ink-muted`, `border`, `border-strong`, `trust`, `trust-strong`, `warm`, `warm-strong`, `danger`, `cell-0..4`).
- Commit after each task. Commit messages end with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Per-task verification: `npm test`, `npx tsc --noEmit` and `npm run lint` must pass at the end of every task (from Task 1 on). The build stays green between tasks, so later tasks may rely on earlier ones being complete.

## Review Focus

1. **Rapid add then remove in the picker** (or remove before the add's server call returns). The saved list must match what the UI shows. Covered by Task 6: rows in flight are `busy` and can't be removed, plus a manual check step.
2. **GitHub account with no repos, or every `/languages` call failing** (rate limit). The connection must still succeed, with an empty skill list and no crash. Covered by Task 9 tests (`qualifyLanguages([])`, `githubSkillLevels` with empty input) and `mapSettled` swallowing per-repo errors.
3. **Reporting a case or punctuation variant of an existing skill** ("react.JS"). The skill must be added directly, never queued for review. Covered by a Task 5 test (report key equals the catalog key) and `reportSkill`'s `findSkillByText` short-circuit.
4. **Catalog names or aliases containing regex metacharacters** ("C++", "UI/UX", "A+ (cert)") must not throw or mis-match in the resume matcher. Covered by a Task 8 test.
5. **Existing `skillRatings` JSON holding retired slugs or bad levels** must not fail the migration, and must not be reported as missing data. Covered by Task 2: the SQL join and level filter, plus a verify script that counts only valid entries. The column itself is kept until that script passes on production (Task 11).

---

### Task 1: Vitest and skill-name normalisation

**Files:**
- Modify: `package.json`
- Create: `vitest.config.mts`
- Create: `lib/skill-normalize.ts`
- Test: `tests/skill-normalize.test.ts`

**Interfaces:**
- Produces:
  - `skillKey(text: string): string`
  - `toSlug(text: string): string`
  - `MAX_SKILL_NAME_LENGTH = 40`
  - `validateSkillName(text: string): { ok: true; name: string } | { ok: false; reason: string }`
  - `editDistance(a: string, b: string): number` (optimal string alignment)
  - `maxTypoDistance(key: string): number`
  - `LEGACY_SLUGS: Readonly<Record<string, readonly string[]>>`
  - `expandLegacySlugs(slugs: readonly string[]): string[]`
  - `npm test` script

- [ ] **Step 1: Install Vitest and add the test script**

Run: `npm install -D vitest@3.2.4`

In `package.json` `"scripts"`, add after `"lint": "eslint",`:

```json
    "test": "vitest run",
```

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.mts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests cover the pure skill logic only (normalisation, matching,
// scoring). Nothing here touches the database or Next.js runtime.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 3: Write the failing test**

Create `tests/skill-normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  editDistance,
  expandLegacySlugs,
  maxTypoDistance,
  skillKey,
  toSlug,
  validateSkillName,
} from "@/lib/skill-normalize";

describe("skillKey", () => {
  it.each([
    ["React.js", "reactjs"],
    ["react js", "reactjs"],
    ["ReactJS", "reactjs"],
    ["  Node JS ", "nodejs"],
    ["C++", "c++"],
    ["C#", "c#"],
    ["c", "c"],
    ["Ruby_on-Rails", "rubyonrails"],
    ["   ", ""],
  ])("%j -> %j", (input, expected) => {
    expect(skillKey(input)).toBe(expected);
  });

  it("keeps C, C++ and C# distinct", () => {
    expect(new Set(["C", "C++", "C#"].map(skillKey)).size).toBe(3);
  });
});

describe("toSlug", () => {
  it.each([
    ["C++", "cplusplus"],
    ["C#", "csharp"],
    ["F#", "fsharp"],
    ["Vue.js", "vue-js"],
    ["  Ruby on Rails ", "ruby-on-rails"],
    ["---", ""],
  ])("%j -> %j", (input, expected) => {
    expect(toSlug(input)).toBe(expected);
  });
});

describe("validateSkillName", () => {
  it("accepts a name and tidies whitespace", () => {
    expect(validateSkillName("  Svelte   Kit ")).toEqual({ ok: true, name: "Svelte Kit" });
  });

  it("accepts names with symbols", () => {
    expect(validateSkillName("C++")).toEqual({ ok: true, name: "C++" });
  });

  it("accepts exactly 40 characters", () => {
    expect(validateSkillName("x".repeat(40)).ok).toBe(true);
  });

  it.each(["", "   ", "x".repeat(41), "https://svelte.dev", "www.svelte.dev", "github.com/user/repo", "+++", "123"])(
    "rejects %j",
    (input) => {
      expect(validateSkillName(input).ok).toBe(false);
    },
  );
});

describe("editDistance", () => {
  it("counts a transposition as one edit", () => {
    expect(editDistance("raect", "react")).toBe(1);
  });

  it.each([
    ["pyhton", "python", 1],
    ["kubernets", "kubernetes", 1],
    ["", "abc", 3],
    ["same", "same", 0],
    ["rust", "ruby", 2],
  ])("%j vs %j = %d", (a, b, expected) => {
    expect(editDistance(a, b)).toBe(expected);
  });
});

describe("maxTypoDistance", () => {
  it.each([
    ["go", 1],
    ["react", 1],
    ["kubernetes", 2],
  ])("%j allows %d", (key, expected) => {
    expect(maxTypoDistance(key)).toBe(expected);
  });
});

describe("expandLegacySlugs", () => {
  it("splits retired combined slugs and de-duplicates", () => {
    expect(expandLegacySlugs(["react", "pytorch-tensorflow", "pytorch", "pandas-numpy"])).toEqual([
      "react",
      "pytorch",
      "tensorflow",
      "pandas",
      "numpy",
    ]);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run tests/skill-normalize.test.ts`
Expected: FAIL, "Failed to resolve import "@/lib/skill-normalize"".

- [ ] **Step 5: Write the implementation**

Create `lib/skill-normalize.ts`:

```ts
// Pure text helpers for the skill catalog (spec section 2.2). No DB or
// framework imports -- the seed script (run through tsx), client
// components and unit tests all use these -- and relative imports only,
// for the same reason.

/**
 * Lookup key for a skill name or alias: "React.js", "react js" and
 * "ReactJS" all become "reactjs". `+` and `#` are kept so C, C++ and C#
 * stay three different skills.
 */
export function skillKey(text: string): string {
  return text.normalize("NFKC").toLowerCase().trim().replace(/[\s._-]+/g, "");
}

/** URL-safe slug for a newly created skill: "C++" -> "cplusplus", "Vue.js" -> "vue-js". */
export function toSlug(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/\+/g, "plus")
    .replace(/#/g, "sharp")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const MAX_SKILL_NAME_LENGTH = 40;

export type SkillNameCheck = { ok: true; name: string } | { ok: false; reason: string };

const LINK_PATTERN = /^(https?:\/\/|www\.)|\.[a-z]{2,}\//i;

export function validateSkillName(text: string): SkillNameCheck {
  const name = text.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (name.length === 0) {
    return { ok: false, reason: "Type the skill's name." };
  }
  if (name.length > MAX_SKILL_NAME_LENGTH) {
    return { ok: false, reason: `Skill names can be at most ${MAX_SKILL_NAME_LENGTH} characters.` };
  }
  if (LINK_PATTERN.test(name)) {
    return { ok: false, reason: "Enter the skill's name, not a link. You can put a link in the note." };
  }
  // A cased letter somewhere -- rules out "+++" and "123" without needing
  // the ES2018-only \p{L} regex class (tsconfig targets ES2017).
  if (name.toLowerCase() === name.toUpperCase()) {
    return { ok: false, reason: "A skill name needs at least one letter." };
  }
  return { ok: true, name };
}

/**
 * Edit distance where swapping two adjacent letters counts as one edit
 * (optimal string alignment), so the common "raect" typo is 1 away from
 * "react" rather than 2.
 */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** How far a typed key may be from a catalog key to count as "did you mean". */
export function maxTypoDistance(key: string): number {
  return Math.max(1, Math.floor(key.length / 4));
}

// The old fixed list had two combined entries that the catalog splits.
// Old Profile.skillRatings rows and old evidence payloads may still hold
// them, so readers expand them on the way in.
export const LEGACY_SLUGS: Readonly<Record<string, readonly string[]>> = {
  "pytorch-tensorflow": ["pytorch", "tensorflow"],
  "pandas-numpy": ["pandas", "numpy"],
};

export function expandLegacySlugs(slugs: readonly string[]): string[] {
  const out: string[] = [];
  for (const slug of slugs) {
    for (const expanded of LEGACY_SLUGS[slug] ?? [slug]) {
      if (!out.includes(expanded)) out.push(expanded);
    }
  }
  return out;
}
```

- [ ] **Step 6: Run tests, typecheck and lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: every `skill-normalize` test passes; no type or lint errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.mts lib/skill-normalize.ts tests/skill-normalize.test.ts
git commit -m "Add Vitest and skill-name normalisation helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Catalog schema, migration and seed

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_open_skill_catalog/migration.sql` (generated, then appended to)
- Create: `lib/skill-catalog-core.ts` (types and `computeKeys`; Task 3 adds search)
- Create: `prisma/seed-data/skills.ts`
- Create: `prisma/seed.ts`
- Create: `prisma/scripts/verify-skill-migration.ts`
- Modify: `package.json`
- Test: `tests/seed-catalog.test.ts`

**Interfaces:**
- Consumes: `skillKey` from Task 1.
- Produces:
  - Prisma models `Skill`, `UserSkill`, `SkillRequest`; enums `SkillCategory`, `SkillOrigin`, `SkillRequestStatus`; `prisma.skill` / `prisma.userSkill` / `prisma.skillRequest`.
  - `SKILL_CATEGORIES`, `type SkillCategoryName`, `SKILL_CATEGORY_LABELS` (plural, for tabs), `SKILL_CATEGORY_TAGS` (singular, for result tags), `isSkillCategory(v: string): v is SkillCategoryName`.
  - `type CatalogSkill = { slug; name; aliases: string[]; keys: string[]; category: SkillCategoryName; strictMatch: boolean; users: number }`.
  - `type SkillSearchResult = { slug; name; category: SkillCategoryName; matchedAlias: string | null }`.
  - `computeKeys(slug, name, aliases): string[]`.
  - `SEED_SKILLS: SeedSkill[]`.

- [ ] **Step 1: Write the failing test for the seed catalog**

Create `tests/seed-catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { computeKeys } from "@/lib/skill-catalog-core";
import { skillKey } from "@/lib/skill-normalize";
import { SEED_SKILLS } from "@/prisma/seed-data/skills";

describe("seed catalog", () => {
  it("is large enough to replace the fixed list", () => {
    expect(SEED_SKILLS.length).toBeGreaterThanOrEqual(250);
  });

  it("has unique, well-formed slugs", () => {
    const slugs = SEED_SKILLS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("never gives two skills the same lookup key", () => {
    const owner = new Map<string, string>();
    for (const s of SEED_SKILLS) {
      for (const key of computeKeys(s.slug, s.name, s.aliases ?? [])) {
        expect(owner.get(key) ?? s.slug, `key "${key}"`).toBe(s.slug);
        owner.set(key, s.slug);
      }
    }
  });

  it("keeps every slug old data can point at", () => {
    const slugs = new Set(SEED_SKILLS.map((s) => s.slug));
    for (const legacy of [
      "javascript", "typescript", "python", "java", "cpp", "go", "react", "nextjs", "nodejs",
      "flutter", "react-native", "sql", "docker", "kubernetes", "aws", "git", "figma", "solidity",
      "pytorch", "tensorflow", "pandas", "numpy",
    ]) {
      expect(slugs.has(legacy), legacy).toBe(true);
    }
  });

  it("marks every name of two characters or fewer as strictMatch", () => {
    for (const s of SEED_SKILLS.filter((s) => s.name.length <= 2)) {
      expect(s.strictMatch, s.name).toBe(true);
    }
  });

  it("covers the GitHub linguist names that should map onto existing skills", () => {
    const keys = new Set(SEED_SKILLS.flatMap((s) => computeKeys(s.slug, s.name, s.aliases ?? [])));
    for (const linguist of ["Jupyter Notebook", "Dockerfile", "HCL", "SCSS", "TeX", "Vue", "Shell", "TSQL", "PLpgSQL", "C++", "C#"]) {
      expect(keys.has(skillKey(linguist)), linguist).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/seed-catalog.test.ts`
Expected: FAIL, cannot resolve `@/lib/skill-catalog-core`.

- [ ] **Step 3: Create the catalog core types**

Create `lib/skill-catalog-core.ts`:

```ts
// Pure catalog types and helpers (spec section 2.3). Shared by the seed
// script (tsx, hence relative imports only), server code, the picker's
// client components and unit tests. Anything that needs Prisma lives in
// lib/skill-catalog.ts instead.

import { skillKey } from "./skill-normalize";

// Must match the Prisma enum SkillCategory exactly.
export const SKILL_CATEGORIES = [
  "LANGUAGE",
  "FRAMEWORK",
  "LIBRARY",
  "TOOL",
  "PLATFORM",
  "DATABASE",
  "DESIGN",
  "CONCEPT",
  "OTHER",
] as const;
export type SkillCategoryName = (typeof SKILL_CATEGORIES)[number];

/** Plural, for the browse tabs. */
export const SKILL_CATEGORY_LABELS: Record<SkillCategoryName, string> = {
  LANGUAGE: "Languages",
  FRAMEWORK: "Frameworks",
  LIBRARY: "Libraries",
  TOOL: "Tools",
  PLATFORM: "Platforms",
  DATABASE: "Databases",
  DESIGN: "Design",
  CONCEPT: "Concepts",
  OTHER: "Other",
};

/** Singular, for the tag beside a search result. */
export const SKILL_CATEGORY_TAGS: Record<SkillCategoryName, string> = {
  LANGUAGE: "Language",
  FRAMEWORK: "Framework",
  LIBRARY: "Library",
  TOOL: "Tool",
  PLATFORM: "Platform",
  DATABASE: "Database",
  DESIGN: "Design",
  CONCEPT: "Concept",
  OTHER: "Other",
};

export function isSkillCategory(value: string): value is SkillCategoryName {
  return (SKILL_CATEGORIES as readonly string[]).includes(value);
}

/** One catalog entry as held in the in-memory cache. `users` = how many people have it. */
export type CatalogSkill = {
  slug: string;
  name: string;
  aliases: string[];
  keys: string[];
  category: SkillCategoryName;
  strictMatch: boolean;
  users: number;
};

export type SkillSearchResult = {
  slug: string;
  name: string;
  category: SkillCategoryName;
  /** Set when an alias (not the name or slug) is what matched, e.g. "ReactJS" for React. */
  matchedAlias: string | null;
};

/** Every lookup key for a skill: the slug, name and each alias, normalised and de-duplicated. */
export function computeKeys(slug: string, name: string, aliases: readonly string[]): string[] {
  const keys: string[] = [];
  for (const text of [slug, name, ...aliases]) {
    const key = skillKey(text);
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}
```

- [ ] **Step 4: Create the seed catalog**

Create `prisma/seed-data/skills.ts`:

```ts
// The curated starting catalog (spec section 2.4). Upserted by slug by
// prisma/seed.ts, so editing an entry here and re-seeding updates it.
//
// strictMatch: resume matching becomes case-sensitive on the name and
// aliases as written. Set it when the lowercase name is an ordinary
// English word ("react", "express", "go") or is two characters or fewer,
// otherwise every resume saying "ready to go" gains a Go skill.
//
// Keep slugs stable once shipped -- UserSkill rows and evidence payloads
// point at them. Relative imports only (this runs under tsx).

import type { SkillCategoryName } from "../../lib/skill-catalog-core";

export type SeedSkill = {
  slug: string;
  name: string;
  category: SkillCategoryName;
  aliases?: string[];
  strictMatch?: boolean;
};

function group(category: SkillCategoryName) {
  return (slug: string, name: string, aliases: string[] = [], strictMatch = false): SeedSkill => ({
    slug,
    name,
    category,
    aliases,
    strictMatch,
  });
}

const lang = group("LANGUAGE");
const fw = group("FRAMEWORK");
const lib = group("LIBRARY");
const tool = group("TOOL");
const plat = group("PLATFORM");
const db = group("DATABASE");
const design = group("DESIGN");
const concept = group("CONCEPT");
const STRICT = true;

export const SEED_SKILLS: SeedSkill[] = [
  // ── Languages ──────────────────────────────────────────────────────
  lang("javascript", "JavaScript", ["JS", "ECMAScript", "ES6"]),
  lang("typescript", "TypeScript", ["TS"]),
  lang("python", "Python", ["Python3", "Python 3"]),
  lang("java", "Java", ["Core Java"]),
  lang("c", "C", [], STRICT),
  lang("cpp", "C++", ["CPP"]),
  lang("csharp", "C#", ["C Sharp", "CSharp"]),
  lang("go", "Go", ["Golang", "golang"], STRICT),
  lang("rust", "Rust", [], STRICT),
  lang("kotlin", "Kotlin"),
  lang("swift", "Swift", [], STRICT),
  lang("objective-c", "Objective-C", ["ObjC"]),
  lang("dart", "Dart", [], STRICT),
  lang("ruby", "Ruby", [], STRICT),
  lang("php", "PHP"),
  lang("scala", "Scala"),
  lang("haskell", "Haskell"),
  lang("elixir", "Elixir", [], STRICT),
  lang("erlang", "Erlang"),
  lang("clojure", "Clojure"),
  lang("fsharp", "F#", ["FSharp"]),
  lang("ocaml", "OCaml"),
  lang("lua", "Lua"),
  lang("perl", "Perl"),
  lang("r", "R", [], STRICT),
  lang("julia", "Julia", [], STRICT),
  lang("matlab", "MATLAB"),
  lang("fortran", "Fortran"),
  lang("cobol", "COBOL"),
  lang("pascal", "Pascal", ["Delphi"]),
  lang("ada", "Ada", [], STRICT),
  lang("smalltalk", "Smalltalk"),
  lang("assembly", "Assembly", ["Assembly Language", "x86 Assembly", "ASM"], STRICT),
  lang("verilog", "Verilog"),
  lang("systemverilog", "SystemVerilog"),
  lang("vhdl", "VHDL"),
  lang("zig", "Zig", [], STRICT),
  lang("nim", "Nim", [], STRICT),
  lang("crystal", "Crystal", [], STRICT),
  lang("groovy", "Groovy", [], STRICT),
  lang("vbnet", "Visual Basic .NET", ["VB.NET", "Visual Basic"]),
  lang("vba", "VBA", ["Visual Basic for Applications"]),
  lang("solidity", "Solidity"),
  lang("html", "HTML", ["HTML5"]),
  lang("css", "CSS", ["CSS3"]),
  lang("sass", "Sass", ["SCSS"], STRICT),
  lang("less", "Less", [], STRICT),
  lang("sql", "SQL", ["Structured Query Language"]),
  lang("shell", "Shell", ["Bash", "Shell Scripting", "Bash Scripting", "Zsh"], STRICT),
  lang("powershell", "PowerShell"),
  lang("cuda", "CUDA"),
  lang("glsl", "GLSL"),
  lang("lisp", "Lisp", ["Common Lisp"]),
  lang("scheme", "Scheme", [], STRICT),
  lang("racket", "Racket", [], STRICT),
  lang("prolog", "Prolog"),
  lang("elm", "Elm", [], STRICT),
  lang("purescript", "PureScript"),
  lang("coffeescript", "CoffeeScript"),
  lang("gdscript", "GDScript"),
  lang("apex", "Apex", [], STRICT),
  lang("abap", "ABAP"),
  lang("latex", "LaTeX", ["TeX"]),
  lang("webassembly", "WebAssembly", ["WASM"]),
  lang("nix", "Nix", [], STRICT),
  lang("processing", "Processing", [], STRICT),

  // ── Frameworks and runtimes ────────────────────────────────────────
  fw("react", "React", ["ReactJS", "React.js", "React JS"], STRICT),
  fw("nextjs", "Next.js", ["NextJS", "Next JS"]),
  fw("vue", "Vue.js", ["Vue", "VueJS", "Vue 3"]),
  fw("nuxt", "Nuxt", ["Nuxt.js", "NuxtJS"]),
  fw("angular", "Angular", ["AngularJS"], STRICT),
  fw("svelte", "Svelte", [], STRICT),
  fw("sveltekit", "SvelteKit", ["Svelte Kit"]),
  fw("solidjs", "SolidJS", ["Solid.js"]),
  fw("remix", "Remix", [], STRICT),
  fw("astro", "Astro", [], STRICT),
  fw("gatsby", "Gatsby", ["GatsbyJS"]),
  fw("ember", "Ember.js", ["EmberJS"]),
  fw("nodejs", "Node.js", ["Node", "NodeJS", "Node JS"]),
  fw("deno", "Deno"),
  fw("bun", "Bun", [], STRICT),
  fw("express", "Express", ["Express.js", "ExpressJS"], STRICT),
  fw("nestjs", "NestJS", ["Nest.js"]),
  fw("fastify", "Fastify"),
  fw("koa", "Koa", ["Koa.js"]),
  fw("hono", "Hono"),
  fw("django", "Django", ["Django REST Framework", "DRF"]),
  fw("flask", "Flask"),
  fw("fastapi", "FastAPI"),
  fw("spring", "Spring", ["Spring Framework"], STRICT),
  fw("spring-boot", "Spring Boot", ["SpringBoot"]),
  fw("hibernate", "Hibernate", [], STRICT),
  fw("rails", "Ruby on Rails", ["Rails", "RoR"], STRICT),
  fw("laravel", "Laravel"),
  fw("symfony", "Symfony"),
  fw("codeigniter", "CodeIgniter"),
  fw("aspnet", "ASP.NET", ["ASP.NET Core", "ASP.NET MVC"]),
  fw("dotnet", ".NET", [".NET Core", "dotnet", ".NET Framework"]),
  fw("blazor", "Blazor"),
  fw("flutter", "Flutter", [], STRICT),
  fw("react-native", "React Native", ["ReactNative"]),
  fw("ionic", "Ionic", [], STRICT),
  fw("xamarin", "Xamarin"),
  fw("swiftui", "SwiftUI"),
  fw("jetpack-compose", "Jetpack Compose"),
  fw("electron", "Electron", ["Electron.js", "ElectronJS"], STRICT),
  fw("tauri", "Tauri"),
  fw("qt", "Qt", ["PyQt"], STRICT),
  fw("unity", "Unity", ["Unity3D", "Unity 3D"], STRICT),
  fw("unreal-engine", "Unreal Engine", ["Unreal", "UE5", "UE4"], STRICT),
  fw("godot", "Godot", ["Godot Engine"]),
  fw("phaser", "Phaser", ["Phaser.js"], STRICT),
  fw("bootstrap", "Bootstrap", [], STRICT),
  fw("tailwind-css", "Tailwind CSS", ["Tailwind", "TailwindCSS"], STRICT),
  fw("htmx", "htmx"),
  fw("streamlit", "Streamlit"),
  fw("gradio", "Gradio"),
  fw("strapi", "Strapi"),
  fw("ros", "ROS", ["Robot Operating System", "ROS2"], STRICT),

  // ── Libraries ──────────────────────────────────────────────────────
  lib("jquery", "jQuery"),
  lib("redux", "Redux", ["Redux Toolkit", "RTK"]),
  lib("zustand", "Zustand"),
  lib("react-query", "TanStack Query", ["React Query"]),
  lib("threejs", "Three.js", ["ThreeJS"]),
  lib("d3", "D3.js", ["D3"]),
  lib("chartjs", "Chart.js", ["ChartJS"]),
  lib("material-ui", "Material UI", ["MUI", "Material-UI"]),
  lib("chakra-ui", "Chakra UI"),
  lib("shadcn-ui", "shadcn/ui", ["shadcn"]),
  lib("framer-motion", "Framer Motion"),
  lib("socketio", "Socket.IO", ["SocketIO"]),
  lib("axios", "Axios"),
  lib("prisma", "Prisma", ["Prisma ORM"]),
  lib("sequelize", "Sequelize"),
  lib("typeorm", "TypeORM"),
  lib("mongoose", "Mongoose", [], STRICT),
  lib("drizzle", "Drizzle ORM", ["Drizzle"]),
  lib("sqlalchemy", "SQLAlchemy"),
  lib("trpc", "tRPC"),
  lib("apollo-graphql", "Apollo GraphQL", ["Apollo Client", "Apollo Server"]),
  lib("pytorch", "PyTorch"),
  lib("tensorflow", "TensorFlow", ["TensorFlow.js", "TFJS"]),
  lib("keras", "Keras"),
  lib("scikit-learn", "scikit-learn", ["sklearn", "Scikit Learn"]),
  lib("pandas", "Pandas", [], STRICT),
  lib("numpy", "NumPy"),
  lib("scipy", "SciPy"),
  lib("matplotlib", "Matplotlib"),
  lib("seaborn", "Seaborn"),
  lib("plotly", "Plotly"),
  lib("opencv", "OpenCV", ["cv2"]),
  lib("hugging-face", "Hugging Face", ["HuggingFace", "Hugging Face Transformers"]),
  lib("langchain", "LangChain"),
  lib("llamaindex", "LlamaIndex"),
  lib("xgboost", "XGBoost"),
  lib("lightgbm", "LightGBM"),
  lib("spacy", "spaCy"),
  lib("nltk", "NLTK"),
  lib("jax", "JAX", [], STRICT),
  lib("polars", "Polars"),
  lib("beautiful-soup", "Beautiful Soup", ["BeautifulSoup", "bs4"]),
  lib("scrapy", "Scrapy"),
  lib("pydantic", "Pydantic"),
  lib("celery", "Celery", [], STRICT),
  lib("pygame", "Pygame"),
  lib("onnx", "ONNX"),
  lib("openai-api", "OpenAI API", ["OpenAI"]),
  lib("web3js", "Web3.js"),
  lib("ethersjs", "Ethers.js", ["ethers"]),
  lib("junit", "JUnit"),
  lib("pytest", "pytest"),
  lib("jest", "Jest", [], STRICT),
  lib("vitest", "Vitest"),
  lib("mocha", "Mocha", [], STRICT),

  // ── Tools ──────────────────────────────────────────────────────────
  tool("git", "Git", ["GitHub", "GitLab", "Bitbucket"]),
  tool("docker", "Docker", ["Dockerfile", "Docker Compose"]),
  tool("kubernetes", "Kubernetes", ["K8s"]),
  tool("helm", "Helm", [], STRICT),
  tool("terraform", "Terraform", ["HCL"]),
  tool("ansible", "Ansible"),
  tool("jenkins", "Jenkins"),
  tool("github-actions", "GitHub Actions"),
  tool("gitlab-ci", "GitLab CI", ["GitLab CI/CD"]),
  tool("circleci", "CircleCI"),
  tool("nginx", "Nginx"),
  tool("linux", "Linux", ["Ubuntu", "Debian", "Arch Linux"]),
  tool("vim", "Vim", ["Neovim"], STRICT),
  tool("postman", "Postman", [], STRICT),
  tool("jira", "Jira"),
  tool("vite", "Vite"),
  tool("webpack", "Webpack"),
  tool("babel", "Babel", [], STRICT),
  tool("maven", "Maven", ["Apache Maven"], STRICT),
  tool("gradle", "Gradle"),
  tool("cmake", "CMake"),
  tool("jupyter", "Jupyter", ["Jupyter Notebook", "Jupyter Notebooks", "JupyterLab"]),
  tool("cypress", "Cypress", [], STRICT),
  tool("playwright", "Playwright", [], STRICT),
  tool("selenium", "Selenium", [], STRICT),
  tool("puppeteer", "Puppeteer", [], STRICT),
  tool("storybook", "Storybook"),
  tool("graphql", "GraphQL"),
  tool("grpc", "gRPC"),
  tool("kafka", "Apache Kafka", ["Kafka"]),
  tool("rabbitmq", "RabbitMQ"),
  tool("apache-spark", "Apache Spark", ["Spark", "PySpark"], STRICT),
  tool("hadoop", "Hadoop", ["Apache Hadoop"]),
  tool("airflow", "Apache Airflow", ["Airflow"], STRICT),
  tool("dbt", "dbt"),
  tool("mlflow", "MLflow"),
  tool("prometheus", "Prometheus"),
  tool("grafana", "Grafana"),
  tool("power-bi", "Power BI", ["PowerBI"]),
  tool("tableau", "Tableau"),
  tool("excel", "Microsoft Excel", ["Excel", "MS Excel"], STRICT),
  tool("wireshark", "Wireshark"),
  tool("burp-suite", "Burp Suite"),
  tool("metasploit", "Metasploit"),
  tool("nmap", "Nmap"),
  tool("kali-linux", "Kali Linux"),
  tool("hardhat", "Hardhat", [], STRICT),
  tool("arduino", "Arduino"),
  tool("raspberry-pi", "Raspberry Pi"),
  tool("autocad", "AutoCAD"),
  tool("solidworks", "SolidWorks"),
  tool("simulink", "Simulink"),
  tool("labview", "LabVIEW"),
  tool("blender", "Blender", [], STRICT),
  tool("wordpress", "WordPress"),
  tool("shopify", "Shopify"),
  tool("webflow", "Webflow"),
  tool("android-studio", "Android Studio"),
  tool("xcode", "Xcode"),

  // ── Platforms ──────────────────────────────────────────────────────
  plat("aws", "AWS", ["Amazon Web Services"]),
  plat("google-cloud", "Google Cloud", ["GCP", "Google Cloud Platform"]),
  plat("azure", "Microsoft Azure", ["Azure"]),
  plat("firebase", "Firebase"),
  plat("supabase", "Supabase"),
  plat("vercel", "Vercel"),
  plat("netlify", "Netlify"),
  plat("heroku", "Heroku"),
  plat("digitalocean", "DigitalOcean"),
  plat("cloudflare", "Cloudflare", ["Cloudflare Workers"]),
  plat("android", "Android", ["Android Development", "Android SDK"]),
  plat("ios", "iOS", ["iOS Development"]),
  plat("ethereum", "Ethereum"),
  plat("solana", "Solana"),

  // ── Databases ──────────────────────────────────────────────────────
  db("postgresql", "PostgreSQL", ["Postgres", "PLpgSQL"]),
  db("mysql", "MySQL"),
  db("sqlite", "SQLite"),
  db("mongodb", "MongoDB", ["Mongo"]),
  db("redis", "Redis"),
  db("oracle-db", "Oracle Database", ["Oracle DB", "PL/SQL", "PLSQL"]),
  db("sql-server", "Microsoft SQL Server", ["SQL Server", "MSSQL", "T-SQL", "TSQL"]),
  db("mariadb", "MariaDB"),
  db("cassandra", "Cassandra", ["Apache Cassandra"]),
  db("dynamodb", "DynamoDB"),
  db("elasticsearch", "Elasticsearch", ["Elastic Search"]),
  db("neo4j", "Neo4j"),
  db("firestore", "Firestore", ["Cloud Firestore"]),
  db("snowflake", "Snowflake", [], STRICT),
  db("bigquery", "BigQuery"),

  // ── Design ─────────────────────────────────────────────────────────
  design("figma", "Figma"),
  design("ui-ux-design", "UI/UX Design", ["UI/UX", "UX Design", "UI Design", "User Experience Design"]),
  design("adobe-photoshop", "Adobe Photoshop", ["Photoshop"]),
  design("adobe-illustrator", "Adobe Illustrator", ["Illustrator"]),
  design("adobe-xd", "Adobe XD"),
  design("adobe-premiere-pro", "Adobe Premiere Pro", ["Premiere Pro"]),
  design("after-effects", "Adobe After Effects", ["After Effects"]),
  design("canva", "Canva"),
  design("sketch", "Sketch", [], STRICT),
  design("framer", "Framer", [], STRICT),
  design("graphic-design", "Graphic Design"),
  design("video-editing", "Video Editing"),
  design("3d-modeling", "3D Modeling", ["3D Modelling"]),

  // ── Concepts ───────────────────────────────────────────────────────
  concept("machine-learning", "Machine Learning", ["ML"]),
  concept("deep-learning", "Deep Learning"),
  concept("nlp", "Natural Language Processing", ["NLP"]),
  concept("computer-vision", "Computer Vision"),
  concept("generative-ai", "Generative AI", ["GenAI", "Gen AI"]),
  concept("llms", "Large Language Models", ["LLM", "LLMs"]),
  concept("prompt-engineering", "Prompt Engineering"),
  concept("reinforcement-learning", "Reinforcement Learning"),
  concept("mlops", "MLOps"),
  concept("data-analysis", "Data Analysis", ["Data Analytics"]),
  concept("data-visualization", "Data Visualization", ["Data Visualisation"]),
  concept("data-engineering", "Data Engineering"),
  concept("statistics", "Statistics"),
  concept("dsa", "Data Structures & Algorithms", ["DSA", "Data Structures and Algorithms", "Data Structures", "Algorithms"]),
  concept("competitive-programming", "Competitive Programming"),
  concept("system-design", "System Design"),
  concept("oop", "Object-Oriented Programming", ["OOP", "OOPs", "Object Oriented Programming"]),
  concept("operating-systems", "Operating Systems"),
  concept("computer-networks", "Computer Networks", ["Computer Networking"]),
  concept("dbms", "Database Management Systems", ["DBMS"]),
  concept("rest-apis", "REST APIs", ["REST", "RESTful APIs", "REST API", "RESTful"], STRICT),
  concept("microservices", "Microservices"),
  concept("distributed-systems", "Distributed Systems"),
  concept("ci-cd", "CI/CD", ["CICD", "Continuous Integration"]),
  concept("devops", "DevOps"),
  concept("cloud-computing", "Cloud Computing"),
  concept("cybersecurity", "Cybersecurity", ["Cyber Security", "Information Security", "InfoSec"]),
  concept("penetration-testing", "Penetration Testing", ["Pentesting", "Ethical Hacking"]),
  concept("cryptography", "Cryptography"),
  concept("blockchain", "Blockchain"),
  concept("web3", "Web3"),
  concept("smart-contracts", "Smart Contracts"),
  concept("web-development", "Web Development", ["Web Dev"]),
  concept("mobile-development", "Mobile Development", ["App Development"]),
  concept("game-development", "Game Development", ["Game Dev"]),
  concept("embedded-systems", "Embedded Systems", ["Embedded C"]),
  concept("iot", "Internet of Things", ["IoT"]),
  concept("robotics", "Robotics"),
  concept("agile", "Agile", ["Agile Methodology"], STRICT),
  concept("scrum", "Scrum"),
  concept("unit-testing", "Unit Testing"),
  concept("tdd", "Test-Driven Development", ["TDD"]),
  concept("technical-writing", "Technical Writing"),
  concept("websockets", "WebSockets", ["WebSocket"]),
  concept("webrtc", "WebRTC"),
  concept("pwa", "Progressive Web Apps", ["PWA"]),
  concept("seo", "SEO", ["Search Engine Optimization"]),
  concept("accessibility", "Web Accessibility", ["a11y", "WCAG"]),
];
```

- [ ] **Step 5: Run the seed-catalog test**

Run: `npx vitest run tests/seed-catalog.test.ts`
Expected: PASS. If the duplicate-key test fails, it names the colliding key. Remove or rename that alias so each key belongs to exactly one skill, then re-run.

- [ ] **Step 6: Add the Prisma models**

In `prisma/schema.prisma`, add these two lines to `model User` directly after `evidenceRecords EvidenceRecord[]`:

```prisma
  skills          UserSkill[]
  skillRequests   SkillRequest[]
```

Append to the end of `prisma/schema.prisma`:

```prisma
// ---------------------------------------------------------------------------
// Open skill catalog (docs/superpowers/specs/2026-10-15-open-skill-catalog-design.md)
// ---------------------------------------------------------------------------

// One row per skill anyone can hold. `keys` holds skillKey() of the slug,
// name and every alias (lib/skill-normalize.ts) so "ReactJS" and "react.js"
// both find React with one indexed lookup.
model Skill {
  id          String        @id @default(cuid())
  slug        String        @unique
  name        String
  aliases     String[]      @default([])
  keys        String[]      @default([])
  category    SkillCategory @default(OTHER)
  origin      SkillOrigin   @default(CURATED)
  // Resume matching is case-sensitive for names that are ordinary words.
  strictMatch Boolean       @default(false)

  users UserSkill[]

  createdAt DateTime @default(now())

  @@index([keys], type: Gin)
  @@map("skills")
}

// A user's self-rated skill. Replaces the old Profile.skillRatings JSON.
model UserSkill {
  userId  String
  skillId String
  level   ComfortLevel

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  skill Skill @relation(fields: [skillId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@id([userId, skillId])
  @@index([skillId])
  @@map("user_skills")
}

// A skill a user couldn't find in the catalog. Nothing enters the catalog
// until an admin approves or merges it (app/admin/skill-requests).
model SkillRequest {
  id              String             @id @default(cuid())
  userId          String
  rawName         String
  key             String
  requestedLevel  ComfortLevel
  note            String?
  status          SkillRequestStatus @default(PENDING)
  resolvedSkillId String?
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
  CURATED
  GITHUB
  REQUESTED
}

enum SkillRequestStatus {
  PENDING
  APPROVED
  MERGED
  REJECTED
}
```

Leave `Profile.skillRatings` in place; it is dropped in a follow-up after production is verified (Task 11, Step 7).

- [ ] **Step 7: STOP and confirm the database with the user**

Ask the user: "Task 2 creates and migrates tables in the database at `ep-small-base-az24ur6p…neon.tech` (from `.env`). Is that a dev database or Neon branch that's safe to migrate?" Do not continue until they confirm. If they give a different `DATABASE_URL`, use that one.

- [ ] **Step 8: Generate the migration without applying it**

Run: `npx prisma migrate dev --create-only --name open_skill_catalog`
Expected: a new folder `prisma/migrations/<timestamp>_open_skill_catalog/` whose `migration.sql` creates the three enums, the three tables, the GIN index and the foreign keys.

- [ ] **Step 9: Append the legacy-data copy to the migration**

Append to the end of that `migration.sql`:

```sql
-- ---------------------------------------------------------------------
-- Copy existing self-ratings out of profiles."skillRatings" (JSON) into
-- user_skills. The legacy skills are inserted here first so the copy has
-- targets before `prisma db seed` fills in the rest of the catalog (the
-- seed then upserts these rows with their full aliases and keys).
-- ---------------------------------------------------------------------
INSERT INTO "skills" ("id", "slug", "name", "aliases", "keys", "category", "origin", "strictMatch") VALUES
  ('legacy_javascript', 'javascript', 'JavaScript', '{}', '{javascript}', 'LANGUAGE', 'CURATED', false),
  ('legacy_typescript', 'typescript', 'TypeScript', '{}', '{typescript}', 'LANGUAGE', 'CURATED', false),
  ('legacy_python', 'python', 'Python', '{}', '{python}', 'LANGUAGE', 'CURATED', false),
  ('legacy_java', 'java', 'Java', '{}', '{java}', 'LANGUAGE', 'CURATED', false),
  ('legacy_cpp', 'cpp', 'C++', '{}', '{cpp,c++}', 'LANGUAGE', 'CURATED', false),
  ('legacy_go', 'go', 'Go', '{}', '{go}', 'LANGUAGE', 'CURATED', true),
  ('legacy_react', 'react', 'React', '{}', '{react}', 'FRAMEWORK', 'CURATED', true),
  ('legacy_nextjs', 'nextjs', 'Next.js', '{}', '{nextjs}', 'FRAMEWORK', 'CURATED', false),
  ('legacy_nodejs', 'nodejs', 'Node.js', '{}', '{nodejs}', 'FRAMEWORK', 'CURATED', false),
  ('legacy_flutter', 'flutter', 'Flutter', '{}', '{flutter}', 'FRAMEWORK', 'CURATED', true),
  ('legacy_react_native', 'react-native', 'React Native', '{}', '{reactnative}', 'FRAMEWORK', 'CURATED', false),
  ('legacy_sql', 'sql', 'SQL', '{}', '{sql}', 'LANGUAGE', 'CURATED', false),
  ('legacy_docker', 'docker', 'Docker', '{}', '{docker}', 'TOOL', 'CURATED', false),
  ('legacy_kubernetes', 'kubernetes', 'Kubernetes', '{}', '{kubernetes}', 'TOOL', 'CURATED', false),
  ('legacy_aws', 'aws', 'AWS', '{}', '{aws}', 'PLATFORM', 'CURATED', false),
  ('legacy_git', 'git', 'Git', '{}', '{git}', 'TOOL', 'CURATED', false),
  ('legacy_figma', 'figma', 'Figma', '{}', '{figma}', 'DESIGN', 'CURATED', false),
  ('legacy_solidity', 'solidity', 'Solidity', '{}', '{solidity}', 'LANGUAGE', 'CURATED', false),
  ('legacy_pytorch', 'pytorch', 'PyTorch', '{}', '{pytorch}', 'LIBRARY', 'CURATED', false),
  ('legacy_tensorflow', 'tensorflow', 'TensorFlow', '{}', '{tensorflow}', 'LIBRARY', 'CURATED', false),
  ('legacy_pandas', 'pandas', 'Pandas', '{}', '{pandas}', 'LIBRARY', 'CURATED', true),
  ('legacy_numpy', 'numpy', 'NumPy', '{}', '{numpy}', 'LIBRARY', 'CURATED', false)
ON CONFLICT ("slug") DO NOTHING;

-- Old slug -> new slug(s). The two combined entries split into two rows
-- each at the same level. Entries with any other key, or a level that
-- isn't one of the three enum values, are skipped rather than failing.
INSERT INTO "user_skills" ("userId", "skillId", "level", "createdAt")
SELECT p."userId", s."id", r.value::"ComfortLevel", NOW()
FROM "profiles" p
CROSS JOIN LATERAL jsonb_each_text(p."skillRatings") AS r(key, value)
JOIN (VALUES
  ('javascript', 'javascript'), ('typescript', 'typescript'), ('python', 'python'),
  ('java', 'java'), ('cpp', 'cpp'), ('go', 'go'), ('react', 'react'), ('nextjs', 'nextjs'),
  ('nodejs', 'nodejs'), ('flutter', 'flutter'), ('react-native', 'react-native'), ('sql', 'sql'),
  ('docker', 'docker'), ('kubernetes', 'kubernetes'), ('aws', 'aws'), ('git', 'git'),
  ('figma', 'figma'), ('solidity', 'solidity'),
  ('pytorch-tensorflow', 'pytorch'), ('pytorch-tensorflow', 'tensorflow'),
  ('pandas-numpy', 'pandas'), ('pandas-numpy', 'numpy')
) AS m(old_slug, new_slug) ON m.old_slug = r.key
JOIN "skills" s ON s."slug" = m.new_slug
WHERE r.value IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')
ON CONFLICT ("userId", "skillId") DO NOTHING;
```

- [ ] **Step 10: Create the seed script and wire it up**

Run: `npm install -D tsx@4.20.3`

In `package.json`, add a top-level key after `"overrides"`:

```json
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
```

Create `prisma/seed.ts`:

```ts
// Upserts the curated skill catalog (prisma/seed-data/skills.ts). Safe to
// re-run: existing rows are matched by slug and refreshed, and nothing is
// deleted. Run after migrating: `npx prisma db seed`.

import { PrismaClient } from "@prisma/client";

import { computeKeys } from "../lib/skill-catalog-core";
import { SEED_SKILLS } from "./seed-data/skills";

const prisma = new PrismaClient();

async function main() {
  for (const skill of SEED_SKILLS) {
    const aliases = skill.aliases ?? [];
    const data = {
      name: skill.name,
      aliases,
      keys: computeKeys(skill.slug, skill.name, aliases),
      category: skill.category,
      strictMatch: skill.strictMatch ?? false,
    };
    await prisma.skill.upsert({
      where: { slug: skill.slug },
      create: { slug: skill.slug, origin: "CURATED", ...data },
      update: data,
    });
  }
  console.log(`Seeded ${SEED_SKILLS.length} skills.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 11: Create the migration verification script**

Create `prisma/scripts/verify-skill-migration.ts`:

```ts
// One-off check for the open_skill_catalog migration: every valid entry
// in the old profiles."skillRatings" JSON must have become a user_skills
// row (the two split slugs become two rows each, so >= is expected).
// Run: `npx tsx prisma/scripts/verify-skill-migration.ts`. Deleted once the
// skillRatings column is dropped (follow-up in Task 11, Step 7).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LEGACY_SLUGS = [
  "javascript", "typescript", "python", "java", "cpp", "go", "react", "nextjs", "nodejs", "flutter",
  "react-native", "sql", "docker", "kubernetes", "aws", "git", "figma", "solidity",
  "pytorch-tensorflow", "pandas-numpy",
];

async function main() {
  const [counts] = await prisma.$queryRaw<{ user_skills: number; valid_rating_entries: number }[]>`
    SELECT
      (SELECT count(*) FROM "user_skills")::int AS user_skills,
      (SELECT count(*) FROM "profiles" p, jsonb_each_text(p."skillRatings") AS r(key, value)
        WHERE r.value IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED') AND r.key = ANY(${LEGACY_SLUGS}))::int
        AS valid_rating_entries`;
  console.log(counts);
  if (counts.user_skills < counts.valid_rating_entries) {
    console.error("user_skills has fewer rows than valid skillRatings entries -- investigate before dropping the column.");
    process.exitCode = 1;
  } else {
    console.log("OK: every valid self-rating was copied.");
  }
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 12: Apply the migration, seed and verify**

Run: `npx prisma migrate dev`
Expected: "Applying migration `<timestamp>_open_skill_catalog`" and the Prisma Client is regenerated.

Run: `npx prisma db seed`
Expected: `Seeded 3xx skills.` (the exact count is `SEED_SKILLS.length`).

Run: `npx tsx prisma/scripts/verify-skill-migration.ts`
Expected: the counts object, then `OK: every valid self-rating was copied.`

- [ ] **Step 13: Run tests, typecheck and lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass.

- [ ] **Step 14: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed.ts prisma/seed-data/skills.ts prisma/scripts/verify-skill-migration.ts lib/skill-catalog-core.ts tests/seed-catalog.test.ts package.json package-lock.json
git commit -m "Add skill catalog tables, legacy rating migration and seed catalog" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Catalog search and server catalog access

**Files:**
- Modify: `lib/skill-catalog-core.ts`
- Create: `lib/skill-catalog.ts`
- Test: `tests/skill-catalog-core.test.ts`

**Interfaces:**
- Consumes: `skillKey`, `editDistance`, `maxTypoDistance`, `toSlug` (Task 1); `CatalogSkill`, `SkillSearchResult`, `computeKeys`, `SkillCategoryName` (Task 2).
- Produces (core, pure):
  - `findInCatalog(catalog, text): CatalogSkill | null`
  - `rankSkills(catalog, query, limit = 10): SkillSearchResult[]`
  - `suggestSimilarIn(catalog, text, limit = 3): SkillSearchResult[]`
  - `popularIn(catalog, category, limit = 12): SkillSearchResult[]`
  - `type SkillSearchResponse = { results: SkillSearchResult[]; didYouMean: SkillSearchResult[] }`
- Produces (server, `lib/skill-catalog.ts`):
  - `getCatalog(): Promise<CatalogSkill[]>`
  - `invalidateCatalog(): void`
  - `type SkillRef = { id: string; slug: string; name: string }`
  - `type Db = PrismaClient | Prisma.TransactionClient`
  - `findSkillByText(text, db?: Db): Promise<SkillRef | null>`
  - `findSkillNames(slugs): Promise<Map<string, string>>`
  - `uniqueSlug(base, db?: Db): Promise<string>`
  - `resolveGithubLanguage(language): Promise<SkillRef>`
  - `isUniqueViolation(err: unknown): boolean`

- [ ] **Step 1: Write the failing test**

Create `tests/skill-catalog-core.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  computeKeys,
  findInCatalog,
  popularIn,
  rankSkills,
  suggestSimilarIn,
  type CatalogSkill,
  type SkillCategoryName,
} from "@/lib/skill-catalog-core";

function skill(
  slug: string,
  name: string,
  aliases: string[] = [],
  users = 0,
  category: SkillCategoryName = "FRAMEWORK",
): CatalogSkill {
  return { slug, name, aliases, keys: computeKeys(slug, name, aliases), category, strictMatch: false, users };
}

const CATALOG: CatalogSkill[] = [
  skill("react", "React", ["ReactJS", "React.js"], 50),
  skill("react-native", "React Native", [], 10),
  skill("redux", "Redux", [], 5, "LIBRARY"),
  skill("preact", "Preact", [], 1),
  skill("nodejs", "Node.js", ["Node", "NodeJS"], 30),
  skill("cpp", "C++", ["CPP"], 20, "LANGUAGE"),
  skill("c", "C", [], 15, "LANGUAGE"),
  skill("csharp", "C#", [], 12, "LANGUAGE"),
  skill("python", "Python", [], 60, "LANGUAGE"),
  skill("kubernetes", "Kubernetes", ["K8s"], 8, "TOOL"),
];

const slugs = (results: { slug: string }[]) => results.map((r) => r.slug);

describe("rankSkills", () => {
  it("puts the exact match first, then prefixes, then substrings", () => {
    expect(slugs(rankSkills(CATALOG, "react"))).toEqual(["react", "react-native", "preact"]);
  });

  it("reports the alias that matched", () => {
    const [top] = rankSkills(CATALOG, "reactjs");
    expect(top).toMatchObject({ slug: "react", matchedAlias: "ReactJS" });
  });

  it("does not report an alias when the name itself matched", () => {
    expect(rankSkills(CATALOG, "node js")[0]).toMatchObject({ slug: "nodejs", matchedAlias: null });
  });

  it("orders each tier by popularity and respects the limit", () => {
    expect(slugs(rankSkills(CATALOG, "c", 3))).toEqual(["c", "cpp", "csharp"]);
  });

  it("returns nothing for blank input", () => {
    expect(rankSkills(CATALOG, "   ")).toEqual([]);
  });
});

describe("findInCatalog", () => {
  it("finds by alias regardless of spacing or case", () => {
    expect(findInCatalog(CATALOG, "k8s")?.slug).toBe("kubernetes");
    expect(findInCatalog(CATALOG, "React.JS")?.slug).toBe("react");
  });

  it("returns null when nothing matches", () => {
    expect(findInCatalog(CATALOG, "Rust")).toBeNull();
  });
});

describe("suggestSimilarIn", () => {
  it("catches transposed letters", () => {
    expect(slugs(suggestSimilarIn(CATALOG, "raect"))).toEqual(["react"]);
    expect(slugs(suggestSimilarIn(CATALOG, "pyhton"))).toEqual(["python"]);
  });

  it("suggests nothing for unrelated text", () => {
    expect(suggestSimilarIn(CATALOG, "zzzzzz")).toEqual([]);
  });
});

describe("popularIn", () => {
  it("returns the most-used skills in one category", () => {
    expect(slugs(popularIn(CATALOG, "LANGUAGE", 2))).toEqual(["python", "cpp"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/skill-catalog-core.test.ts`
Expected: FAIL, `findInCatalog` (and the others) are not exported.

- [ ] **Step 3: Add the search functions to the core**

In `lib/skill-catalog-core.ts`, change the import line to:

```ts
import { editDistance, maxTypoDistance, skillKey } from "./skill-normalize";
```

Append to `lib/skill-catalog-core.ts`:

```ts
/** Body of GET /api/skills/search. */
export type SkillSearchResponse = { results: SkillSearchResult[]; didYouMean: SkillSearchResult[] };

export function findInCatalog(catalog: readonly CatalogSkill[], text: string): CatalogSkill | null {
  const key = skillKey(text);
  if (!key) return null;
  return catalog.find((s) => s.keys.includes(key)) ?? null;
}

function byPopularity(a: CatalogSkill, b: CatalogSkill): number {
  return b.users - a.users || a.name.localeCompare(b.name);
}

function toResult(skill: CatalogSkill, matches: (key: string) => boolean): SkillSearchResult {
  const nameMatched = matches(skillKey(skill.name)) || matches(skillKey(skill.slug));
  return {
    slug: skill.slug,
    name: skill.name,
    category: skill.category,
    matchedAlias: nameMatched ? null : (skill.aliases.find((alias) => matches(skillKey(alias))) ?? null),
  };
}

/**
 * Type-ahead ranking (spec 2.3): exact key, then key prefix, then key
 * substring; most-used first within each tier. Keys are normalised, so
 * "node js" finds Node.js and "k8s" finds Kubernetes.
 */
export function rankSkills(catalog: readonly CatalogSkill[], query: string, limit = 10): SkillSearchResult[] {
  const q = skillKey(query);
  if (!q) return [];
  const tiers: ((key: string) => boolean)[] = [
    (key) => key === q,
    (key) => key.startsWith(q),
    (key) => key.includes(q),
  ];
  const seen = new Set<string>();
  const out: SkillSearchResult[] = [];
  for (const test of tiers) {
    const tier = catalog.filter((s) => !seen.has(s.slug) && s.keys.some(test)).sort(byPopularity);
    for (const skill of tier) {
      if (out.length >= limit) return out;
      seen.add(skill.slug);
      out.push(toResult(skill, test));
    }
  }
  return out;
}

/** "Did you mean" candidates for text that matched nothing -- typo-distance only. */
export function suggestSimilarIn(catalog: readonly CatalogSkill[], text: string, limit = 3): SkillSearchResult[] {
  const q = skillKey(text);
  if (!q) return [];
  const max = maxTypoDistance(q);
  return catalog
    .map((skill) => {
      let best = Infinity;
      let bestKey = "";
      for (const key of skill.keys) {
        const d = editDistance(q, key);
        if (d < best) {
          best = d;
          bestKey = key;
        }
      }
      return { skill, best, bestKey };
    })
    .filter((c) => c.best <= max)
    .sort((a, b) => a.best - b.best || byPopularity(a.skill, b.skill))
    .slice(0, limit)
    .map((c) => toResult(c.skill, (key) => key === c.bestKey));
}

/** Browse panel: the most-used skills in one category. */
export function popularIn(catalog: readonly CatalogSkill[], category: SkillCategoryName, limit = 12): SkillSearchResult[] {
  return catalog
    .filter((s) => s.category === category)
    .sort(byPopularity)
    .slice(0, limit)
    .map((s) => ({ slug: s.slug, name: s.name, category: s.category, matchedAlias: null }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/skill-catalog-core.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the server catalog module**

Create `lib/skill-catalog.ts`:

```ts
import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { computeKeys, type CatalogSkill } from "@/lib/skill-catalog-core";
import { skillKey, toSlug } from "@/lib/skill-normalize";

// DB-backed catalog access (spec 2.3). Search itself is pure
// (lib/skill-catalog-core.ts) and runs over this module's cached copy of
// the catalog: a few hundred short rows, cheap to hold and far cheaper than
// a query per keystroke.

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { loadedAt: number; skills: CatalogSkill[] } | null = null;

export async function getCatalog(): Promise<CatalogSkill[]> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.skills;
  const rows = await prisma.skill.findMany({
    select: {
      slug: true,
      name: true,
      aliases: true,
      keys: true,
      category: true,
      strictMatch: true,
      _count: { select: { users: true } },
    },
  });
  const skills = rows.map(({ _count, ...skill }) => ({ ...skill, users: _count.users }));
  cache = { loadedAt: Date.now(), skills };
  return skills;
}

/** Drops this instance's cached catalog; other instances catch up within the TTL. */
export function invalidateCatalog(): void {
  cache = null;
}

export type SkillRef = { id: string; slug: string; name: string };
export type Db = PrismaClient | Prisma.TransactionClient;

/** Exact lookup by name, slug or alias -- one indexed query on `keys`. Always fresh (no cache). */
export async function findSkillByText(text: string, db: Db = prisma): Promise<SkillRef | null> {
  const key = skillKey(text);
  if (!key) return null;
  return db.skill.findFirst({ where: { keys: { has: key } }, select: { id: true, slug: true, name: true } });
}

/** Display names for evidence-only slugs (grid rows, suggestions). Unknown slugs are absent. */
export async function findSkillNames(slugs: readonly string[]): Promise<Map<string, string>> {
  if (slugs.length === 0) return new Map();
  const rows = await prisma.skill.findMany({ where: { slug: { in: [...slugs] } }, select: { slug: true, name: true } });
  return new Map(rows.map((r) => [r.slug, r.name]));
}

export async function uniqueSlug(base: string, db: Db = prisma): Promise<string> {
  const root = base || "skill";
  let slug = root;
  for (let i = 2; await db.skill.findUnique({ where: { slug }, select: { id: true } }); i++) {
    slug = `${root}-${i}`;
  }
  return slug;
}

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Maps a GitHub linguist language name onto the catalog, creating it if
 * it's missing. Linguist names are a trusted vocabulary (no typos), which
 * is why this is the one path besides admin approval that may add skills.
 * New ones are strictMatch because linguist has names like "Hack" and
 * "Red" that would otherwise match ordinary resume words.
 */
export async function resolveGithubLanguage(language: string): Promise<SkillRef> {
  const existing = await findSkillByText(language);
  if (existing) return existing;
  const name = language.trim();
  try {
    const slug = await uniqueSlug(toSlug(name));
    const created = await prisma.skill.create({
      data: { slug, name, keys: computeKeys(slug, name, []), category: "LANGUAGE", origin: "GITHUB", strictMatch: true },
      select: { id: true, slug: true, name: true },
    });
    invalidateCatalog();
    return created;
  } catch (err) {
    // Two connections racing to create the same language: use the winner's row.
    if (!isUniqueViolation(err)) throw err;
    const raced = await findSkillByText(language);
    if (raced) return raced;
    throw err;
  }
}
```

- [ ] **Step 6: Run tests, typecheck and lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add lib/skill-catalog-core.ts lib/skill-catalog.ts tests/skill-catalog-core.test.ts
git commit -m "Add catalog search ranking and cached server catalog access" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Grid, suggestions and evidence on top of UserSkill

**Files:**
- Modify: `lib/skills.ts` (add `DEFAULT_SKILL_LEVEL`, `UserSkillEntry`; legacy exports stay until Task 11)
- Modify: `lib/skill-grid.ts` (rewrite)
- Create: `lib/skill-suggestions.ts`
- Create: `lib/user-skills.ts`
- Modify: `lib/evidence.ts`
- Create: `app/ui/ExpandableEvidenceGrid.tsx`
- Modify: `app/(protected)/dashboard/grid-data.ts` (rewrite)
- Modify: `app/(protected)/dashboard/page.tsx`
- Modify: `app/(protected)/profile/page.tsx`
- Modify: `app/page.tsx`
- Test: `tests/skill-grid.test.ts`, `tests/skill-suggestions.test.ts`

**Interfaces:**
- Consumes: `expandLegacySlugs` (Task 1); `findSkillNames` (Task 3).
- Produces:
  - `lib/skills.ts`: `DEFAULT_SKILL_LEVEL: SkillRatingLevel`; `type UserSkillEntry = { slug: string; name: string; level: SkillRatingLevel }`.
  - `lib/skill-grid.ts`:
    - `SKILL_GRID_COLUMNS`, `SKILL_GRID_SELF_COLUMN`
    - `type GithubSkillLevel = 2 | 3 | 4`; `type GithubEvidenceSkill = { slug: string; level: GithubSkillLevel }`
    - `resumeSkillsFromPayload(payload: unknown): string[]`
    - `githubSkillsFromPayload(payload: unknown): GithubEvidenceSkill[]`
    - `type SkillGrid`
    - `buildSkillGrid({ userSkills, resumeSkills, githubSkills, skillNames }): SkillGrid`
  - `lib/skill-suggestions.ts`:
    - `type EvidenceSnapshot = { github: GithubEvidenceSkill[]; resume: string[]; names: Record<string, string> }`
    - `type SkillSuggestion = { slug; name; sources: ("github" | "resume")[]; strength: number }`
    - `rankSuggestions(evidence: EvidenceSnapshot, owned: ReadonlySet<string>): SkillSuggestion[]`
  - `lib/user-skills.ts`: `getUserSkills(userId): Promise<UserSkillEntry[]>`.
  - `lib/evidence.ts`:
    - `findActiveResumePayload(userId, activeResumeId): Promise<unknown>`
    - `findGithubPayload(userId): Promise<unknown>`
    - `loadSkillGrid(userId, activeResumeId): Promise<{ userSkills; resumePayload; githubPayload; grid: SkillGrid }>`
    - `getEvidenceSnapshot(userId, resumeEvidenceId): Promise<EvidenceSnapshot>`
  - `ExpandableEvidenceGrid` (props of `EvidenceGrid` plus `limit?: number`, default 15).
  - `getSkillGrid(userId, activeResumeId)` in `dashboard/grid-data.ts`, now returning `userSkills` too.

Note: until Task 7 lands, new onboarding users still write the old JSON and will see an empty grid. That is expected on this branch.

- [ ] **Step 1: Write the failing grid test**

Create `tests/skill-grid.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildSkillGrid, githubSkillsFromPayload, resumeSkillsFromPayload } from "@/lib/skill-grid";
import type { UserSkillEntry } from "@/lib/skills";

const NAMES = new Map([
  ["react", "React"],
  ["python", "Python"],
  ["docker", "Docker"],
  ["rust", "Rust"],
  ["pytorch", "PyTorch"],
  ["tensorflow", "TensorFlow"],
]);

const USER_SKILLS: UserSkillEntry[] = [
  { slug: "react", name: "React", level: "ADVANCED" },
  { slug: "docker", name: "Docker", level: "BEGINNER" },
];

describe("buildSkillGrid", () => {
  it("unions self-rated and evidence-only skills, strongest evidence first", () => {
    const grid = buildSkillGrid({
      userSkills: USER_SKILLS,
      resumeSkills: ["python", "react"],
      githubSkills: [
        { slug: "react", level: 4 },
        { slug: "rust", level: 3 },
      ],
      skillNames: NAMES,
    });
    expect(grid.rows).toEqual([
      { label: "React", cells: [4, 3, 4, 0] },
      { label: "Python", cells: [0, 3, 0, 0] },
      { label: "Rust", cells: [0, 0, 3, 0] },
      { label: "Docker", cells: [2, 0, 0, 0] },
    ]);
    expect(grid.backedCount).toBe(3);
    expect(grid.columns).toEqual(["Self", "Resume", "GitHub", "Peers"]);
  });

  it("drops evidence slugs the catalog doesn't know", () => {
    const grid = buildSkillGrid({ userSkills: [], resumeSkills: ["no-such-skill"], githubSkills: [], skillNames: NAMES });
    expect(grid.rows).toEqual([]);
  });
});

describe("resumeSkillsFromPayload", () => {
  it("expands legacy combined slugs", () => {
    expect(resumeSkillsFromPayload({ extractedSkills: ["pytorch-tensorflow", 7, "react"] })).toEqual([
      "pytorch",
      "tensorflow",
      "react",
    ]);
  });

  it("returns nothing for a missing payload", () => {
    expect(resumeSkillsFromPayload(null)).toEqual([]);
  });
});

describe("githubSkillsFromPayload", () => {
  it("reads v2 payloads and ignores malformed entries", () => {
    expect(
      githubSkillsFromPayload({
        verified: true,
        version: 2,
        skills: [{ slug: "react", level: 4, repos: 3, via: ["language"] }, { slug: "rust", level: 9 }, null],
      }),
    ).toEqual([{ slug: "react", level: 4 }]);
  });

  it("reads v1 payloads: first language strongest", () => {
    expect(githubSkillsFromPayload({ verified: true, languages: ["python", "rust"] })).toEqual([
      { slug: "python", level: 4 },
      { slug: "rust", level: 3 },
    ]);
  });

  it("ignores unverified connections", () => {
    expect(githubSkillsFromPayload({ verified: false, languages: ["python"] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Write the failing suggestions test**

Create `tests/skill-suggestions.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { rankSuggestions, type EvidenceSnapshot } from "@/lib/skill-suggestions";

const EVIDENCE: EvidenceSnapshot = {
  github: [
    { slug: "react", level: 4 },
    { slug: "rust", level: 3 },
    { slug: "go", level: 2 },
  ],
  resume: ["react", "python", "unknown"],
  names: { react: "React", rust: "Rust", python: "Python", go: "Go" },
};

describe("rankSuggestions", () => {
  it("merges sources, skips owned skills and unnamed slugs, strongest first", () => {
    expect(rankSuggestions(EVIDENCE, new Set(["rust"]))).toEqual([
      { slug: "react", name: "React", sources: ["github", "resume"], strength: 5 },
      { slug: "python", name: "Python", sources: ["resume"], strength: 3 },
      { slug: "go", name: "Go", sources: ["github"], strength: 2 },
    ]);
  });

  it("breaks strength ties by name", () => {
    const evidence: EvidenceSnapshot = {
      github: [
        { slug: "b", level: 3 },
        { slug: "a", level: 3 },
      ],
      resume: [],
      names: { a: "Alpha", b: "Beta" },
    };
    expect(rankSuggestions(evidence, new Set()).map((s) => s.slug)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/skill-grid.test.ts tests/skill-suggestions.test.ts`
Expected: FAIL. The current `buildSkillGrid` has a different signature, and `lib/skill-suggestions` doesn't exist.

- [ ] **Step 4: Add the shared types to `lib/skills.ts`**

Append to `lib/skills.ts` (leave every existing export in place for now):

```ts
// A newly added skill starts at "Comfortable" -- the user chose to add it,
// so it isn't a cold start, and one click on the rating changes it.
export const DEFAULT_SKILL_LEVEL: SkillRatingLevel = "INTERMEDIATE";

/** One of the user's self-rated skills, as the UI shows it (from the UserSkill table). */
export type UserSkillEntry = { slug: string; name: string; level: SkillRatingLevel };
```

- [ ] **Step 5: Rewrite `lib/skill-grid.ts`**

Replace the whole file with:

```ts
// Derives a user's skills x evidence-sources grid (dashboard, profile and
// the onboarding Review preview) from real data only. Nothing here invents
// evidence: a cell is non-zero only when the corresponding record actually
// names that skill. Pure -- callers load the data.

import type { CellLevel, GridRow } from "@/app/ui/EvidenceGrid";
import { expandLegacySlugs } from "@/lib/skill-normalize";
import type { SkillRatingLevel, UserSkillEntry } from "@/lib/skills";

export const SKILL_GRID_COLUMNS = ["Self", "Resume", "GitHub", "Peers"] as const;
export const SKILL_GRID_SELF_COLUMN = 0;

const SELF_LEVEL: Record<SkillRatingLevel, CellLevel> = {
  BEGINNER: 2,
  INTERMEDIATE: 3,
  ADVANCED: 4,
};

// A resume naming a skill is a single document-level mention: "solid" (3).
const RESUME_LEVEL: CellLevel = 3;

export type GithubSkillLevel = 2 | 3 | 4;
export type GithubEvidenceSkill = { slug: string; level: GithubSkillLevel };

/** Skill slugs from a RESUME EvidenceRecord payload (`extractedSkills`). */
export function resumeSkillsFromPayload(payload: unknown): string[] {
  const list = (payload as { extractedSkills?: unknown } | null)?.extractedSkills;
  if (!Array.isArray(list)) return [];
  return expandLegacySlugs(list.filter((s): s is string => typeof s === "string"));
}

function isGithubEvidenceSkill(value: unknown): value is GithubEvidenceSkill {
  const v = value as { slug?: unknown; level?: unknown } | null;
  return typeof v?.slug === "string" && (v.level === 2 || v.level === 3 || v.level === 4);
}

/**
 * Skills from a GITHUB EvidenceRecord payload. Only a verified OAuth
 * connection counts. v2 payloads carry a level per skill (lib/github-skills.ts);
 * v1 payloads (before the open catalog) were a ranked list of language
 * slugs, read here as most-used = 4 and the rest = 3, as the old grid did.
 */
export function githubSkillsFromPayload(payload: unknown): GithubEvidenceSkill[] {
  const p = payload as { verified?: unknown; version?: unknown; skills?: unknown; languages?: unknown } | null;
  if (p?.verified !== true) return [];
  if (p.version === 2 && Array.isArray(p.skills)) {
    return p.skills.filter(isGithubEvidenceSkill).map(({ slug, level }) => ({ slug, level }));
  }
  if (Array.isArray(p.languages)) {
    return expandLegacySlugs(p.languages.filter((s): s is string => typeof s === "string")).map((slug, i) => ({
      slug,
      level: i === 0 ? 4 : 3,
    }));
  }
  return [];
}

export type SkillGrid = {
  columns: string[];
  selfColumn: number;
  rows: GridRow[];
  /** Skills with at least one non-self (evidence-backed) cell. */
  backedCount: number;
};

export function buildSkillGrid({
  userSkills,
  resumeSkills,
  githubSkills,
  skillNames,
}: {
  userSkills: readonly UserSkillEntry[];
  resumeSkills: readonly string[];
  githubSkills: readonly GithubEvidenceSkill[];
  /** Names for evidence-only slugs; slugs missing here (and not self-rated) are dropped. */
  skillNames: ReadonlyMap<string, string>;
}): SkillGrid {
  const self = new Map(userSkills.map((s) => [s.slug, s]));
  const resume = new Set(resumeSkills);
  const github = new Map(githubSkills.map((s) => [s.slug, s.level]));
  const slugs = new Set([...self.keys(), ...resume, ...github.keys()]);

  const rows = [...slugs]
    .flatMap((slug) => {
      const name = self.get(slug)?.name ?? skillNames.get(slug);
      if (!name) return [];
      const level = self.get(slug)?.level;
      const cells: CellLevel[] = [
        level ? SELF_LEVEL[level] : 0,
        resume.has(slug) ? RESUME_LEVEL : 0,
        github.get(slug) ?? 0,
        0, // Peers: peer feedback isn't built yet.
      ];
      const evidence = cells[1] + cells[2] + cells[3];
      return [{ name, cells, evidence, total: evidence + cells[0] }];
    })
    // Most evidence first, then self-rating, then name.
    .sort((a, b) => b.evidence - a.evidence || b.total - a.total || a.name.localeCompare(b.name));

  return {
    columns: [...SKILL_GRID_COLUMNS],
    selfColumn: SKILL_GRID_SELF_COLUMN,
    rows: rows.map((r) => ({ label: r.name, cells: r.cells })),
    backedCount: rows.filter((r) => r.evidence > 0).length,
  };
}
```

- [ ] **Step 6: Create `lib/skill-suggestions.ts`**

```ts
// "Found in your evidence" suggestions for the skill picker (spec 4.3).
// Pure, so the picker can re-rank in the browser as skills are added.

import type { GithubEvidenceSkill } from "@/lib/skill-grid";

/** What the picker needs to know about a user's evidence. Plain JSON (crosses the server-action boundary). */
export type EvidenceSnapshot = {
  github: GithubEvidenceSkill[];
  resume: string[];
  names: Record<string, string>;
};

export type SkillSuggestion = {
  slug: string;
  name: string;
  sources: ("github" | "resume")[];
  strength: number;
};

// A resume-only skill ranks like a GitHub level-3 one -- the same cell
// strength the Resume column gives it on the grid.
const RESUME_STRENGTH = 3;

export function rankSuggestions(evidence: EvidenceSnapshot, owned: ReadonlySet<string>): SkillSuggestion[] {
  const bySlug = new Map<string, SkillSuggestion>();
  for (const { slug, level } of evidence.github) {
    bySlug.set(slug, { slug, name: evidence.names[slug] ?? "", sources: ["github"], strength: level });
  }
  for (const slug of evidence.resume) {
    const existing = bySlug.get(slug);
    if (existing) {
      existing.sources.push("resume");
      existing.strength += 1;
    } else {
      bySlug.set(slug, { slug, name: evidence.names[slug] ?? "", sources: ["resume"], strength: RESUME_STRENGTH });
    }
  }
  return [...bySlug.values()]
    .filter((s) => s.name && !owned.has(s.slug))
    .sort((a, b) => b.strength - a.strength || a.name.localeCompare(b.name));
}
```

- [ ] **Step 7: Run the two tests to verify they pass**

Run: `npx vitest run tests/skill-grid.test.ts tests/skill-suggestions.test.ts`
Expected: PASS.

- [ ] **Step 8: Create `lib/user-skills.ts`**

```ts
import { prisma } from "@/lib/prisma";
import type { UserSkillEntry } from "@/lib/skills";

// Reads and writes a user's self-rated skills (UserSkill rows). Oldest
// first, so the picker list stays in the order skills were added.

export async function getUserSkills(userId: string): Promise<UserSkillEntry[]> {
  const rows = await prisma.userSkill.findMany({
    where: { userId },
    include: { skill: { select: { slug: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ slug: r.skill.slug, name: r.skill.name, level: r.level }));
}
```

- [ ] **Step 9: Add evidence loaders to `lib/evidence.ts`**

Replace the imports at the top of `lib/evidence.ts` with:

```ts
import { prisma } from "@/lib/prisma";
import { findSkillNames } from "@/lib/skill-catalog";
import {
  buildSkillGrid,
  githubSkillsFromPayload,
  resumeSkillsFromPayload,
  type SkillGrid,
} from "@/lib/skill-grid";
import type { EvidenceSnapshot } from "@/lib/skill-suggestions";
import type { UserSkillEntry } from "@/lib/skills";
import { getUserSkills } from "@/lib/user-skills";
```

Append to `lib/evidence.ts`:

```ts
// The resume a user's evidence reads from: the active one, falling back to
// the latest upload (e.g. records from before activeResumeId existed).
// Scoped to userId, so a client-supplied id can't read someone else's.
export async function findActiveResumePayload(userId: string, activeResumeId: string | null): Promise<unknown> {
  if (activeResumeId) {
    const active = await prisma.evidenceRecord.findFirst({
      where: { id: activeResumeId, userId, source: "RESUME" },
      select: { payload: true },
    });
    if (active) return active.payload;
  }
  const latest = await prisma.evidenceRecord.findFirst({
    where: { userId, source: "RESUME" },
    orderBy: { createdAt: "desc" },
    select: { payload: true },
  });
  return latest?.payload ?? null;
}

export async function findGithubPayload(userId: string): Promise<unknown> {
  const record = await prisma.evidenceRecord.findFirst({
    where: { userId, source: "GITHUB" },
    select: { payload: true },
  });
  return record?.payload ?? null;
}

// Everything the dashboard and profile grids need, in one place.
export async function loadSkillGrid(
  userId: string,
  activeResumeId: string | null,
): Promise<{ userSkills: UserSkillEntry[]; resumePayload: unknown; githubPayload: unknown; grid: SkillGrid }> {
  const [userSkills, resumePayload, githubPayload] = await Promise.all([
    getUserSkills(userId),
    findActiveResumePayload(userId, activeResumeId),
    findGithubPayload(userId),
  ]);
  const resumeSkills = resumeSkillsFromPayload(resumePayload);
  const githubSkills = githubSkillsFromPayload(githubPayload);
  const skillNames = await findSkillNames([...new Set([...resumeSkills, ...githubSkills.map((s) => s.slug)])]);
  return {
    userSkills,
    resumePayload,
    githubPayload,
    grid: buildSkillGrid({ userSkills, resumeSkills, githubSkills, skillNames }),
  };
}

// The picker's view of a user's evidence (spec 4.3). Slugs the catalog
// doesn't know are dropped here so the client never sees a nameless skill.
export async function getEvidenceSnapshot(userId: string, resumeEvidenceId: string | null): Promise<EvidenceSnapshot> {
  const [resumePayload, githubPayload] = await Promise.all([
    findActiveResumePayload(userId, resumeEvidenceId),
    findGithubPayload(userId),
  ]);
  const resume = resumeSkillsFromPayload(resumePayload);
  const github = githubSkillsFromPayload(githubPayload);
  const names = await findSkillNames([...new Set([...resume, ...github.map((g) => g.slug)])]);
  return {
    github: github.filter((g) => names.has(g.slug)),
    resume: resume.filter((slug) => names.has(slug)),
    names: Object.fromEntries(names),
  };
}
```

- [ ] **Step 10: Create `app/ui/ExpandableEvidenceGrid.tsx`**

```tsx
"use client";

import { useState } from "react";

import { EvidenceGrid } from "./EvidenceGrid";

export const GRID_ROW_LIMIT = 15;

// Skill lists are open-ended now, so long grids show the strongest rows
// first (rows arrive sorted by evidence) and fold the rest behind a toggle.
export function ExpandableEvidenceGrid({
  rows,
  limit = GRID_ROW_LIMIT,
  ...gridProps
}: React.ComponentProps<typeof EvidenceGrid> & { limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  const hidden = rows.length - limit;
  const shown = expanded || hidden <= 0 ? rows : rows.slice(0, limit);

  return (
    <div className="flex flex-col gap-3">
      <EvidenceGrid {...gridProps} rows={shown} />
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="self-start rounded-theme-sm text-xs font-semibold text-ink-muted underline decoration-border-strong underline-offset-4 transition hover:text-ink hover:decoration-ink"
        >
          {expanded ? "Show fewer" : `Show all ${rows.length} skills`}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 11: Rewrite `app/(protected)/dashboard/grid-data.ts`**

Replace the whole file with:

```ts
import type { GridRow } from "@/app/ui/EvidenceGrid";
import { loadSkillGrid } from "@/lib/evidence";
import { githubSkillsFromPayload, resumeSkillsFromPayload } from "@/lib/skill-grid";
import type { UserSkillEntry } from "@/lib/skills";

export { SKILL_GRID_COLUMNS as GRID_COLUMNS } from "@/lib/skill-grid";

export type DashboardSkillGrid = {
  rows: GridRow[];
  userSkills: UserSkillEntry[];
  resume: { filename: string; skillCount: number } | null;
  github: { username: string; skillCount: number } | null;
};

export async function getSkillGrid(userId: string, activeResumeId: string | null): Promise<DashboardSkillGrid> {
  const { userSkills, resumePayload, githubPayload, grid } = await loadSkillGrid(userId, activeResumeId);

  const resumeData = resumePayload as { filename?: unknown } | null;
  const githubData = githubPayload as { verified?: unknown; username?: unknown } | null;

  return {
    rows: grid.rows,
    userSkills,
    resume: resumeData
      ? {
          filename: typeof resumeData.filename === "string" ? resumeData.filename : "resume.pdf",
          skillCount: resumeSkillsFromPayload(resumePayload).length,
        }
      : null,
    github:
      githubData?.verified === true
        ? {
            username: typeof githubData.username === "string" ? githubData.username : "GitHub",
            skillCount: githubSkillsFromPayload(githubPayload).length,
          }
        : null,
  };
}
```

- [ ] **Step 12: Update the dashboard page**

In `app/(protected)/dashboard/page.tsx`:

1. Delete the line `import { parseSkillRatings, skillLabel } from "@/lib/skills";`.
2. After `import { EvidenceGrid, GridLegend } from "@/app/ui/EvidenceGrid";` add:
   ```ts
   import { ExpandableEvidenceGrid } from "@/app/ui/ExpandableEvidenceGrid";
   ```
3. Replace `const grid = await getSkillGrid(userId, profile);` with:
   ```ts
   const grid = await getSkillGrid(userId, profile.activeResumeId);
   ```
4. Replace the two lines
   ```ts
   const skillRatings = parseSkillRatings(profile.skillRatings);
   const ratedSkillSlugs = Object.keys(skillRatings);
   ```
   with:
   ```ts
   const ratedSkills = grid.userSkills;
   ```
5. Replace every remaining `ratedSkillSlugs` with `ratedSkills`. Then change `ratedSkills.slice(0, 2).map(skillLabel).join(", ")` to `ratedSkills.slice(0, 2).map((s) => s.name).join(", ")`.
6. In the non-empty grid branch, replace `<EvidenceGrid columns={GRID_COLUMNS} rows={grid.rows} selfColumn={0} size={gridSize} caption="Your skills by evidence source: self-rating, resume, GitHub and peers" />` with the same props on `<ExpandableEvidenceGrid … />`. Keep the empty-state `EvidenceGrid` as it is.

- [ ] **Step 13: Update the profile page**

In `app/(protected)/profile/page.tsx`:

1. Replace `import { getEvidenceStatus } from "@/lib/evidence";` with:
   ```ts
   import { getEvidenceStatus, loadSkillGrid } from "@/lib/evidence";
   ```
2. Replace `import { buildSkillGrid, githubSkillsFromPayload } from "@/lib/skill-grid";` with:
   ```ts
   import { githubSkillsFromPayload } from "@/lib/skill-grid";
   ```
3. After the `EvidenceGrid` import add:
   ```ts
   import { ExpandableEvidenceGrid } from "@/app/ui/ExpandableEvidenceGrid";
   ```
4. Replace the block
   ```ts
   const grid = buildSkillGrid({
     skillRatings: profile.skillRatings,
     resumePayload: resumeRecord?.payload,
     githubPayload: githubRecord?.payload,
   });
   ```
   with:
   ```ts
   const { grid } = await loadSkillGrid(userId, profile.activeResumeId);
   ```
5. In the "Skills × evidence" section, change `<EvidenceGrid` to `<ExpandableEvidenceGrid` (same props). If `EvidenceGrid` is then unused, remove it from the import but keep `GridLegend`.

- [ ] **Step 14: Update the landing page sample**

In `app/page.tsx`:

1. Delete `import { skillLabel, type SkillSlug } from "@/lib/skills";`.
2. Replace the `SAMPLE` constant and `SAMPLE_ROWS` with:
   ```ts
   const SAMPLE: GridRow[] = [
     { label: "React", cells: [3, 3, 4, 0] },
     { label: "TypeScript", cells: [2, 2, 3, 0] },
     { label: "Python", cells: [3, 2, 2, 0] },
     { label: "SQL", cells: [2, 2, 0, 0] },
     { label: "Docker", cells: [3, 0, 0, 0] },
     { label: "Kubernetes", cells: [2, 0, 0, 0] },
     { label: "Figma", cells: [3, 0, 0, 0] },
   ];

   const SAMPLE_ROWS: GridRow[] = SAMPLE;
   ```
   `BACKED` and `CLAIMED_ONLY` keep working unchanged (`s.cells` / `r.cells`).

- [ ] **Step 15: Run tests, typecheck and lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass. `tsc` may report other callers of the old `buildSkillGrid` or `getSkillGrid` signatures. There should be none besides the files above; if there are, update them the same way.

- [ ] **Step 16: Commit**

```bash
git add lib/skills.ts lib/skill-grid.ts lib/skill-suggestions.ts lib/user-skills.ts lib/evidence.ts app/ui/ExpandableEvidenceGrid.tsx "app/(protected)/dashboard/grid-data.ts" "app/(protected)/dashboard/page.tsx" "app/(protected)/profile/page.tsx" app/page.tsx tests/skill-grid.test.ts tests/skill-suggestions.test.ts
git commit -m "Build the skill grid from UserSkill rows and catalog-wide evidence" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Skill reports, skill actions and search API

**Files:**
- Create: `lib/skill-report-input.ts`
- Modify: `lib/user-skills.ts`
- Create: `lib/skill-requests.ts`
- Create: `app/skills/actions.ts`
- Create: `app/api/skills/search/route.ts`
- Create: `app/api/skills/popular/route.ts`
- Test: `tests/skill-report-input.test.ts`

**Interfaces:**
- Consumes: `validateSkillName`, `skillKey`, `MAX_SKILL_NAME_LENGTH` (Task 1); `rankSkills`, `suggestSimilarIn`, `popularIn`, `isSkillCategory` (Tasks 2–3); `getCatalog`, `findSkillByText` (Task 3); `getEvidenceSnapshot` (Task 4); `UserSkillEntry`, `isSkillRatingLevel`.
- Produces:
  - `lib/skill-report-input.ts`:
    - `MAX_REPORT_NOTE_LENGTH = 200`, `MAX_PENDING_REPORTS = 10`
    - `type ReportInput = { rawName: string; level: string; note?: string | null }`
    - `type ParsedReport = { rawName; key; level: SkillRatingLevel; note: string | null }`
    - `parseReportInput(input): { ok: true; value: ParsedReport } | { ok: false; error: string }`
    - `type OpenReport = { id: string; rawName: string; status: "PENDING" | "REJECTED" }`
    - `type ReportResult = { status: "reported"; report: OpenReport } | { status: "exists"; skill: UserSkillEntry } | { status: "error"; error: string }`
  - `lib/user-skills.ts`:
    - `addUserSkill(userId, slug, level): Promise<UserSkillEntry | null>`
    - `setUserSkillLevel(userId, slug, level): Promise<UserSkillEntry | null>`
    - `removeUserSkill(userId, slug): Promise<void>`
    - `countSkillsAndPendingReports(userId): Promise<{ skills: number; pendingReports: number }>`
  - `lib/skill-requests.ts`:
    - `listOpenReports(userId): Promise<OpenReport[]>`
    - `reportSkill(userId, input): Promise<ReportResult>`
    - `cancelReport(userId, id): Promise<boolean>`
  - `app/skills/actions.ts` (server actions):
    - `type SkillActionResult = { ok: true; skill: UserSkillEntry } | { ok: false; error: string }`
    - `addUserSkillAction(slug, level): Promise<SkillActionResult>`
    - `setUserSkillLevelAction(slug, level): Promise<SkillActionResult>`
    - `removeUserSkillAction(slug): Promise<{ ok: true } | { ok: false; error: string }>`
    - `reportSkillAction(input: ReportInput): Promise<ReportResult>`
    - `cancelReportAction(id): Promise<{ ok: boolean }>`
    - `getEvidenceSnapshotAction(resumeEvidenceId: string | null): Promise<EvidenceSnapshot>`
  - `GET /api/skills/search?q=` → `SkillSearchResponse`
  - `GET /api/skills/popular?category=` → `{ results: SkillSearchResult[] }`

- [ ] **Step 1: Write the failing test**

Create `tests/skill-report-input.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { computeKeys } from "@/lib/skill-catalog-core";
import { parseReportInput } from "@/lib/skill-report-input";

describe("parseReportInput", () => {
  it("normalises the name and derives the lookup key", () => {
    expect(parseReportInput({ rawName: "  Svelte   Kit ", level: "ADVANCED", note: "  https://svelte.dev " })).toEqual({
      ok: true,
      value: { rawName: "Svelte Kit", key: "sveltekit", level: "ADVANCED", note: "https://svelte.dev" },
    });
  });

  it("gives a case/punctuation variant the same key as the catalog entry", () => {
    const parsed = parseReportInput({ rawName: "react.JS", level: "INTERMEDIATE" });
    expect(parsed.ok && computeKeys("react", "React", ["React.js"]).includes(parsed.value.key)).toBe(true);
  });

  it("treats a blank note as no note", () => {
    const parsed = parseReportInput({ rawName: "Svelte", level: "BEGINNER", note: "   " });
    expect(parsed.ok && parsed.value.note).toBeNull();
  });

  it.each([
    [{ rawName: "", level: "BEGINNER" }],
    [{ rawName: "https://x.dev", level: "BEGINNER" }],
    [{ rawName: "Svelte", level: "EXPERT" }],
    [{ rawName: "Svelte", level: "BEGINNER", note: "x".repeat(201) }],
  ])("rejects %j", (input) => {
    expect(parseReportInput(input).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/skill-report-input.test.ts`
Expected: FAIL, cannot resolve `@/lib/skill-report-input`.

- [ ] **Step 3: Create `lib/skill-report-input.ts`**

```ts
// Validation and shared types for "report a missing skill" (spec 3.1).
// Pure, so the picker's client components can import the types and limits.

import { skillKey, validateSkillName } from "@/lib/skill-normalize";
import { isSkillRatingLevel, type SkillRatingLevel, type UserSkillEntry } from "@/lib/skills";

export const MAX_REPORT_NOTE_LENGTH = 200;
export const MAX_PENDING_REPORTS = 10;

export type ReportInput = { rawName: string; level: string; note?: string | null };
export type ParsedReport = { rawName: string; key: string; level: SkillRatingLevel; note: string | null };

/** A report the user can still see: waiting for review, or rejected and not yet dismissed. */
export type OpenReport = { id: string; rawName: string; status: "PENDING" | "REJECTED" };

export type ReportResult =
  | { status: "reported"; report: OpenReport }
  | { status: "exists"; skill: UserSkillEntry }
  | { status: "error"; error: string };

export function parseReportInput(input: ReportInput): { ok: true; value: ParsedReport } | { ok: false; error: string } {
  const name = validateSkillName(input.rawName);
  if (!name.ok) return { ok: false, error: name.reason };
  if (!isSkillRatingLevel(input.level)) return { ok: false, error: "Pick a comfort level for this skill." };
  const note = input.note?.trim() || null;
  if (note && note.length > MAX_REPORT_NOTE_LENGTH) {
    return { ok: false, error: `Notes can be at most ${MAX_REPORT_NOTE_LENGTH} characters.` };
  }
  return { ok: true, value: { rawName: name.name, key: skillKey(name.name), level: input.level, note } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/skill-report-input.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the write functions to `lib/user-skills.ts`**

Change the imports at the top of `lib/user-skills.ts` to:

```ts
import { prisma } from "@/lib/prisma";
import type { SkillRatingLevel, UserSkillEntry } from "@/lib/skills";
```

Append:

```ts
/** Adds a catalog skill to the user. Already added -> keeps their existing rating. Unknown slug -> null. */
export async function addUserSkill(userId: string, slug: string, level: SkillRatingLevel): Promise<UserSkillEntry | null> {
  const skill = await prisma.skill.findUnique({ where: { slug }, select: { id: true, slug: true, name: true } });
  if (!skill) return null;
  const row = await prisma.userSkill.upsert({
    where: { userId_skillId: { userId, skillId: skill.id } },
    create: { userId, skillId: skill.id, level },
    update: {},
  });
  return { slug: skill.slug, name: skill.name, level: row.level };
}

/** Changes the rating of a skill the user already has. Not added -> null. */
export async function setUserSkillLevel(userId: string, slug: string, level: SkillRatingLevel): Promise<UserSkillEntry | null> {
  const skill = await prisma.skill.findUnique({ where: { slug }, select: { id: true, slug: true, name: true } });
  if (!skill) return null;
  const { count } = await prisma.userSkill.updateMany({ where: { userId, skillId: skill.id }, data: { level } });
  return count === 0 ? null : { slug: skill.slug, name: skill.name, level };
}

export async function removeUserSkill(userId: string, slug: string): Promise<void> {
  await prisma.userSkill.deleteMany({ where: { userId, skill: { slug } } });
}

export async function countSkillsAndPendingReports(userId: string): Promise<{ skills: number; pendingReports: number }> {
  const [skills, pendingReports] = await Promise.all([
    prisma.userSkill.count({ where: { userId } }),
    prisma.skillRequest.count({ where: { userId, status: "PENDING" } }),
  ]);
  return { skills, pendingReports };
}
```

- [ ] **Step 6: Create `lib/skill-requests.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { findSkillByText, isUniqueViolation } from "@/lib/skill-catalog";
import {
  MAX_PENDING_REPORTS,
  parseReportInput,
  type OpenReport,
  type ReportInput,
  type ReportResult,
} from "@/lib/skill-report-input";
import { addUserSkill } from "@/lib/user-skills";

// User side of "report a missing skill" (spec 3.1). A report never adds
// anything to the catalog -- an admin decides (lib/skill-review.ts).

export async function listOpenReports(userId: string): Promise<OpenReport[]> {
  const rows = await prisma.skillRequest.findMany({
    where: { userId, status: { in: ["PENDING", "REJECTED"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, rawName: true, status: true },
  });
  return rows.map((r) => ({ id: r.id, rawName: r.rawName, status: r.status === "REJECTED" ? "REJECTED" : "PENDING" }));
}

export async function reportSkill(userId: string, input: ReportInput): Promise<ReportResult> {
  const parsed = parseReportInput(input);
  if (!parsed.ok) return { status: "error", error: parsed.error };
  const { rawName, key, level, note } = parsed.value;

  // The search may have missed it (typed before an admin approved it, or a
  // spelling variant the cache hadn't caught up with): add it directly
  // instead of queueing a report for something that already exists.
  const existing = await findSkillByText(rawName);
  if (existing) {
    const skill = await addUserSkill(userId, existing.slug, level);
    if (skill) return { status: "exists", skill };
  }

  const pending = await prisma.skillRequest.count({ where: { userId, status: "PENDING" } });
  if (pending >= MAX_PENDING_REPORTS) {
    return {
      status: "error",
      error: `You have ${MAX_PENDING_REPORTS} pending reports. Wait for those to be reviewed first.`,
    };
  }

  try {
    const row = await prisma.skillRequest.create({
      data: { userId, rawName, key, requestedLevel: level, note },
      select: { id: true, rawName: true },
    });
    return { status: "reported", report: { id: row.id, rawName: row.rawName, status: "PENDING" } };
  } catch (err) {
    if (isUniqueViolation(err)) return { status: "error", error: "You've already reported this skill." };
    throw err;
  }
}

/** Cancels a pending report or dismisses a rejected one (both just delete the row). */
export async function cancelReport(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.skillRequest.deleteMany({
    where: { id, userId, status: { in: ["PENDING", "REJECTED"] } },
  });
  return count > 0;
}
```

- [ ] **Step 7: Create `app/skills/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { getEvidenceSnapshot } from "@/lib/evidence";
import type { ReportInput, ReportResult } from "@/lib/skill-report-input";
import { cancelReport, reportSkill } from "@/lib/skill-requests";
import type { EvidenceSnapshot } from "@/lib/skill-suggestions";
import { isSkillRatingLevel, type UserSkillEntry } from "@/lib/skills";
import { addUserSkill, removeUserSkill, setUserSkillLevel } from "@/lib/user-skills";

// Server actions behind the SkillPicker (app/ui/skill-picker), shared by
// onboarding and /profile/skills -- both save as the user goes.

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not signed in");
  return userId;
}

function revalidateSkillPages() {
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/profile/skills");
}

const GENERIC_ERROR = "Something went wrong. Please try again.";

export type SkillActionResult = { ok: true; skill: UserSkillEntry } | { ok: false; error: string };

export async function addUserSkillAction(slug: string, level: string): Promise<SkillActionResult> {
  const userId = await requireUserId();
  if (!isSkillRatingLevel(level)) return { ok: false, error: "Invalid comfort level." };
  try {
    const skill = await addUserSkill(userId, slug, level);
    if (!skill) return { ok: false, error: "That skill isn't in the catalog." };
    revalidateSkillPages();
    return { ok: true, skill };
  } catch (err) {
    console.error("addUserSkillAction failed:", err);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function setUserSkillLevelAction(slug: string, level: string): Promise<SkillActionResult> {
  const userId = await requireUserId();
  if (!isSkillRatingLevel(level)) return { ok: false, error: "Invalid comfort level." };
  try {
    const skill = await setUserSkillLevel(userId, slug, level);
    if (!skill) return { ok: false, error: "You haven't added that skill." };
    revalidateSkillPages();
    return { ok: true, skill };
  } catch (err) {
    console.error("setUserSkillLevelAction failed:", err);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function removeUserSkillAction(slug: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUserId();
  try {
    await removeUserSkill(userId, slug);
    revalidateSkillPages();
    return { ok: true };
  } catch (err) {
    console.error("removeUserSkillAction failed:", err);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function reportSkillAction(input: ReportInput): Promise<ReportResult> {
  const userId = await requireUserId();
  try {
    const result = await reportSkill(userId, input);
    if (result.status !== "error") revalidateSkillPages();
    return result;
  } catch (err) {
    console.error("reportSkillAction failed:", err);
    return { status: "error", error: GENERIC_ERROR };
  }
}

export async function cancelReportAction(id: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  try {
    const ok = await cancelReport(userId, id);
    if (ok) revalidateSkillPages();
    return { ok };
  } catch (err) {
    console.error("cancelReportAction failed:", err);
    return { ok: false };
  }
}

// Onboarding asks for this after a resume upload or GitHub connect, so its
// suggestions reflect evidence gathered mid-wizard. The resume id comes
// from the client; findActiveResumePayload scopes it to this user.
export async function getEvidenceSnapshotAction(resumeEvidenceId: string | null): Promise<EvidenceSnapshot> {
  const userId = await requireUserId();
  return getEvidenceSnapshot(userId, resumeEvidenceId);
}
```

- [ ] **Step 8: Create the search route**

Create `app/api/skills/search/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { getCatalog } from "@/lib/skill-catalog";
import { rankSkills, suggestSimilarIn, type SkillSearchResponse } from "@/lib/skill-catalog-core";
import { MAX_SKILL_NAME_LENGTH } from "@/lib/skill-normalize";

// GET /api/skills/search?q= -- the picker's type-ahead. "Did you mean"
// suggestions are only computed when nothing matched.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, MAX_SKILL_NAME_LENGTH);
  if (!q) {
    return NextResponse.json({ results: [], didYouMean: [] } satisfies SkillSearchResponse);
  }

  const catalog = await getCatalog();
  const results = rankSkills(catalog, q, 10);
  const body: SkillSearchResponse = {
    results,
    didYouMean: results.length === 0 ? suggestSimilarIn(catalog, q, 3) : [],
  };
  return NextResponse.json(body);
}
```

- [ ] **Step 9: Create the popular route**

Create `app/api/skills/popular/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { getCatalog } from "@/lib/skill-catalog";
import { isSkillCategory, popularIn } from "@/lib/skill-catalog-core";

// GET /api/skills/popular?category=LANGUAGE -- the picker's browse panel.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const category = request.nextUrl.searchParams.get("category") ?? "";
  if (!isSkillCategory(category)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }

  return NextResponse.json({ results: popularIn(await getCatalog(), category, 12) });
}
```

- [ ] **Step 10: Run tests, typecheck and lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass.

- [ ] **Step 11: Commit**

```bash
git add lib/skill-report-input.ts lib/user-skills.ts lib/skill-requests.ts app/skills/actions.ts app/api/skills tests/skill-report-input.test.ts
git commit -m "Add skill reports, user skill actions and skill search API" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: SkillPicker and the /profile/skills page

**Files:**
- Create: `app/ui/skill-picker/use-skill-editor.ts`
- Create: `app/ui/skill-picker/SkillRatingRow.tsx`
- Create: `app/ui/skill-picker/ReportSkillForm.tsx`
- Create: `app/ui/skill-picker/SkillSearch.tsx`
- Create: `app/ui/skill-picker/SuggestionStrip.tsx`
- Create: `app/ui/skill-picker/CategoryBrowser.tsx`
- Create: `app/ui/skill-picker/SkillPicker.tsx`
- Create: `app/(protected)/profile/skills/page.tsx`
- Modify: `app/(protected)/profile/page.tsx` (Edit skills link and empty-state copy)

**Interfaces:**
- Consumes: the Task 5 actions; `rankSuggestions`, `EvidenceSnapshot` (Task 4); `SkillSearchResponse`, `SkillSearchResult`, `SKILL_CATEGORIES`, `SKILL_CATEGORY_LABELS`, `SKILL_CATEGORY_TAGS` (Tasks 2–3); `OpenReport`, `ReportResult`, `MAX_REPORT_NOTE_LENGTH` (Task 5); `getUserSkills`, `listOpenReports`, `getEvidenceSnapshot`.
- Produces:
  - `type SkillEditorState = { skills: UserSkillEntry[]; reports: OpenReport[] }`
  - `useSkillEditor(initial, onChange?)`
  - `<SkillPicker initial={SkillEditorState} evidence={EvidenceSnapshot | null} onChange?={(s: SkillEditorState) => void} />`
  - `type ReportHandler = (input: { rawName: string; level: SkillRatingLevel; note: string }) => Promise<ReportResult>`

UI has no unit tests in this project. Verification is `tsc`, lint and the manual checks in Step 11.

- [ ] **Step 1: Create the editor hook**

Create `app/ui/skill-picker/use-skill-editor.ts`:

```ts
"use client";

import { useRef, useState } from "react";

import {
  addUserSkillAction,
  cancelReportAction,
  removeUserSkillAction,
  reportSkillAction,
  setUserSkillLevelAction,
} from "@/app/skills/actions";
import type { OpenReport, ReportResult } from "@/lib/skill-report-input";
import { DEFAULT_SKILL_LEVEL, type SkillRatingLevel, type UserSkillEntry } from "@/lib/skills";

export type SkillEditorState = { skills: UserSkillEntry[]; reports: OpenReport[] };

const GENERIC_ERROR = "Something went wrong. Please try again.";

// Optimistic editing of the user's skills: the list changes immediately,
// the server action runs, and a failure puts the old value back with a
// short message. State lives in a ref as well as React state so several
// in-flight changes always build on the latest list, not a stale closure.
//
// `busy` holds the slugs/report ids with a request in flight; their rows
// disable remove/cancel so an add can't race a remove of the same skill.
export function useSkillEditor(initial: SkillEditorState, onChange?: (state: SkillEditorState) => void) {
  const [state, setState] = useState(initial);
  const stateRef = useRef(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  function commit(update: (prev: SkillEditorState) => SkillEditorState) {
    const next = update(stateRef.current);
    stateRef.current = next;
    setState(next);
    onChange?.(next);
  }

  function markBusy(id: string, on: boolean) {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function guarded<T>(id: string, run: () => Promise<T>, fallback: T): Promise<T> {
    markBusy(id, true);
    try {
      return await run();
    } catch (err) {
      console.error(err);
      return fallback;
    } finally {
      markBusy(id, false);
    }
  }

  async function add(skill: { slug: string; name: string }, level: SkillRatingLevel = DEFAULT_SKILL_LEVEL) {
    if (stateRef.current.skills.some((s) => s.slug === skill.slug)) return;
    setError(null);
    commit((s) => ({ ...s, skills: [...s.skills, { slug: skill.slug, name: skill.name, level }] }));
    const res = await guarded(skill.slug, () => addUserSkillAction(skill.slug, level), {
      ok: false as const,
      error: GENERIC_ERROR,
    });
    if (res.ok) {
      commit((s) => ({ ...s, skills: s.skills.map((x) => (x.slug === skill.slug ? res.skill : x)) }));
    } else {
      commit((s) => ({ ...s, skills: s.skills.filter((x) => x.slug !== skill.slug) }));
      setError(res.error);
    }
  }

  async function addMany(skills: { slug: string; name: string }[]) {
    await Promise.all(skills.map((s) => add(s)));
  }

  async function setLevel(slug: string, level: SkillRatingLevel) {
    const previous = stateRef.current.skills.find((s) => s.slug === slug);
    if (!previous || previous.level === level) return;
    setError(null);
    commit((s) => ({ ...s, skills: s.skills.map((x) => (x.slug === slug ? { ...x, level } : x)) }));
    const res = await guarded(slug, () => setUserSkillLevelAction(slug, level), { ok: false as const, error: GENERIC_ERROR });
    if (!res.ok) {
      commit((s) => ({ ...s, skills: s.skills.map((x) => (x.slug === slug ? previous : x)) }));
      setError(res.error);
    }
  }

  async function remove(slug: string) {
    const index = stateRef.current.skills.findIndex((s) => s.slug === slug);
    if (index === -1) return;
    const previous = stateRef.current.skills[index];
    setError(null);
    commit((s) => ({ ...s, skills: s.skills.filter((x) => x.slug !== slug) }));
    const res = await guarded(slug, () => removeUserSkillAction(slug), { ok: false as const, error: GENERIC_ERROR });
    if (!res.ok) {
      commit((s) => {
        const skills = [...s.skills];
        skills.splice(Math.min(index, skills.length), 0, previous);
        return { ...s, skills };
      });
      setError(res.error);
    }
  }

  async function report(input: { rawName: string; level: SkillRatingLevel; note: string }): Promise<ReportResult> {
    setError(null);
    let res: ReportResult;
    try {
      res = await reportSkillAction(input);
    } catch (err) {
      console.error(err);
      res = { status: "error", error: GENERIC_ERROR };
    }
    if (res.status === "reported") {
      const created = res.report;
      commit((s) => ({ ...s, reports: [...s.reports, created] }));
    } else if (res.status === "exists") {
      const skill = res.skill;
      commit((s) => (s.skills.some((x) => x.slug === skill.slug) ? s : { ...s, skills: [...s.skills, skill] }));
    }
    return res;
  }

  async function cancelReport(id: string) {
    const index = stateRef.current.reports.findIndex((r) => r.id === id);
    if (index === -1) return;
    const previous = stateRef.current.reports[index];
    setError(null);
    commit((s) => ({ ...s, reports: s.reports.filter((r) => r.id !== id) }));
    const res = await guarded(id, () => cancelReportAction(id), { ok: false });
    if (!res.ok) {
      commit((s) => {
        const reports = [...s.reports];
        reports.splice(Math.min(index, reports.length), 0, previous);
        return { ...s, reports };
      });
      setError(GENERIC_ERROR);
    }
  }

  return {
    skills: state.skills,
    reports: state.reports,
    error,
    dismissError: () => setError(null),
    busy,
    add,
    addMany,
    setLevel,
    remove,
    report,
    cancelReport,
  };
}
```

- [ ] **Step 2: Create the rating row**

Create `app/ui/skill-picker/SkillRatingRow.tsx`:

```tsx
"use client";

import { useId, useRef, useState } from "react";

import { SKILL_RATING_LABELS, SKILL_RATING_LEVELS, type SkillRatingLevel } from "@/lib/skills";

// The amber three-cell comfort selector, moved here from the old onboarding
// SkillsStep. Removing a skill is now its own button, so clicking the
// chosen level again no longer clears it.

export function LevelKey() {
  return (
    <span
      aria-hidden="true"
      className="hidden items-center gap-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted sm:flex"
    >
      {SKILL_RATING_LEVELS.map((level, i) => (
        <span key={level} className="flex items-center gap-1.5">
          <span className="flex gap-[2px]">
            {[0, 1, 2].map((c) => (
              <span key={c} className={`h-2 w-2 rounded-[2px] ${c <= i ? "bg-warm" : "bg-cell-0"}`} />
            ))}
          </span>
          {SKILL_RATING_LABELS[level]}
        </span>
      ))}
    </span>
  );
}

export function SkillRatingRow({
  label,
  level,
  onSelect,
  onRemove,
  busy = false,
}: {
  label: string;
  level: SkillRatingLevel;
  onSelect: (level: SkillRatingLevel) => void;
  onRemove: () => void;
  busy?: boolean;
}) {
  const labelId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [hover, setHover] = useState<number | null>(null);

  const chosen = SKILL_RATING_LEVELS.indexOf(level);
  const shown = hover ?? chosen;

  // Radio-group keyboard pattern: arrows move and select.
  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let target: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") target = Math.min(index + 1, SKILL_RATING_LEVELS.length - 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") target = Math.max(index - 1, 0);
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = SKILL_RATING_LEVELS.length - 1;
    if (target === null) return;
    e.preventDefault();
    buttons.current[target]?.focus();
    if (SKILL_RATING_LEVELS[target] !== level) onSelect(SKILL_RATING_LEVELS[target]);
  }

  return (
    <li className="flex items-center justify-between gap-3 bg-warm/[0.04] px-4 py-2.5">
      <div className="min-w-0">
        <p id={labelId} className="truncate text-sm font-medium">
          {label}
        </p>
        <p
          aria-hidden="true"
          className={`mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
            hover !== null ? "text-ink-muted" : "text-warm-strong"
          }`}
        >
          {SKILL_RATING_LABELS[SKILL_RATING_LEVELS[shown]]}
        </p>
      </div>

      <div className="flex shrink-0 items-center">
        <div role="radiogroup" aria-labelledby={labelId} className="flex" onMouseLeave={() => setHover(null)}>
          {SKILL_RATING_LEVELS.map((lvl, i) => {
            const checked = level === lvl;
            const filled = i <= shown;
            const previewing = hover !== null;
            return (
              <button
                key={lvl}
                ref={(el) => {
                  buttons.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={SKILL_RATING_LABELS[lvl]}
                title={SKILL_RATING_LABELS[lvl]}
                tabIndex={checked ? 0 : -1}
                onClick={() => {
                  if (!checked) onSelect(lvl);
                }}
                onKeyDown={(e) => onKeyDown(e, i)}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") setHover(i);
                }}
                className="grid h-10 w-9 place-items-center rounded-theme-sm"
              >
                <span
                  aria-hidden="true"
                  className={`h-6 w-6 rounded-[5px] border transition-colors duration-150 ${
                    filled
                      ? previewing
                        ? "border-warm/70 bg-warm/45"
                        : "border-warm bg-warm"
                      : "border-border-strong bg-cell-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          aria-label={`Remove ${label}`}
          title={`Remove ${label}`}
          className="ml-1 grid h-9 w-9 place-items-center rounded-theme-sm text-ink-muted transition hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>
    </li>
  );
}
```

- [ ] **Step 3: Create the report form**

Create `app/ui/skill-picker/ReportSkillForm.tsx`:

```tsx
"use client";

import { useState } from "react";

import { PrimaryButton, SecondaryButton } from "@/app/ui/primitives";
import { MAX_REPORT_NOTE_LENGTH, type ReportResult } from "@/lib/skill-report-input";
import { DEFAULT_SKILL_LEVEL, SKILL_RATING_LABELS, SKILL_RATING_LEVELS, type SkillRatingLevel } from "@/lib/skills";

export type ReportHandler = (input: { rawName: string; level: SkillRatingLevel; note: string }) => Promise<ReportResult>;

// Shown only after search and "did you mean" both came up empty. Nothing
// is added to the catalog from here -- an admin reviews it first.
export function ReportSkillForm({
  rawName,
  onReport,
  onDone,
  onCancel,
}: {
  rawName: string;
  onReport: ReportHandler;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [level, setLevel] = useState<SkillRatingLevel>(DEFAULT_SKILL_LEVEL);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await onReport({ rawName, level, note });
    setSubmitting(false);
    if (res.status === "error") setError(res.error);
    else onDone();
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
      <p className="text-xs text-ink-muted">
        We&apos;ll check &ldquo;{rawName}&rdquo; and add it to the catalog. Until then it shows as pending on your
        profile.
      </p>
      <fieldset>
        <legend className="text-xs font-medium text-ink">Your comfort level</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {SKILL_RATING_LEVELS.map((l) => (
            <label
              key={l}
              className={`cursor-pointer rounded-theme-sm border px-2.5 py-1 text-xs font-medium transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-trust ${
                level === l ? "border-warm bg-warm/10 text-warm-strong" : "border-border-strong text-ink-muted hover:text-ink"
              }`}
            >
              <input
                type="radio"
                name="report-level"
                value={l}
                checked={level === l}
                onChange={() => setLevel(l)}
                className="sr-only"
              />
              {SKILL_RATING_LABELS[l]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-xs font-medium text-ink">
        Note (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={MAX_REPORT_NOTE_LENGTH}
          rows={2}
          placeholder="What is it? A link helps."
          className="rounded-theme-sm border border-border-strong bg-surface px-2.5 py-1.5 text-sm font-normal text-ink placeholder:text-ink-muted/70 focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/25"
        />
      </label>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Report skill"}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={onCancel}>
          Cancel
        </SecondaryButton>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Create the search combobox**

Create `app/ui/skill-picker/SkillSearch.tsx`:

```tsx
"use client";

import { useEffect, useId, useState } from "react";

import { SKILL_CATEGORY_TAGS, type SkillSearchResponse, type SkillSearchResult } from "@/lib/skill-catalog-core";
import { MAX_SKILL_NAME_LENGTH } from "@/lib/skill-normalize";

import { ReportSkillForm, type ReportHandler } from "./ReportSkillForm";

const DEBOUNCE_MS = 150;

// Type-ahead over the catalog (ARIA combobox, list rendered inline so it
// works at phone width without a floating layer). When nothing matches it
// offers typo fixes first and only then "report it".
export function SkillSearch({
  ownedSlugs,
  onAdd,
  onReport,
}: {
  ownedSlugs: ReadonlySet<string>;
  onAdd: (skill: { slug: string; name: string }) => void;
  onReport: ReportHandler;
}) {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<(SkillSearchResponse & { query: string }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [reporting, setReporting] = useState(false);

  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/skills/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (res.ok) setData({ ...((await res.json()) as SkillSearchResponse), query: trimmed });
      } catch {
        // Aborted by the next keystroke, or offline: keep what's shown.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  const current = trimmed && data?.query === trimmed ? data : null;
  const results = current?.results ?? [];
  const didYouMean = current?.didYouMean ?? [];
  const noMatch = current !== null && !loading && results.length === 0;

  function reset() {
    setQuery("");
    setData(null);
    setActive(0);
    setReporting(false);
  }

  function choose(skill: SkillSearchResult) {
    if (ownedSlugs.has(skill.slug)) return;
    onAdd(skill);
    reset();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && results.length > 0) {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp" && results.length > 0) {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) choose(results[active]);
    } else if (e.key === "Escape") {
      reset();
    }
  }

  return (
    <div>
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        Search skills
      </label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={query}
        maxLength={MAX_SKILL_NAME_LENGTH}
        placeholder="e.g. Rust, Django, Figma"
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setReporting(false);
        }}
        onKeyDown={onKeyDown}
        className="mt-1.5 w-full rounded-theme-md border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted/70 focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/25"
      />

      <ul
        id={listId}
        role="listbox"
        aria-label="Matching skills"
        className={results.length > 0 ? "mt-1 overflow-hidden rounded-theme-md border border-border bg-surface" : "hidden"}
      >
        {results.map((r, i) => {
          const owned = ownedSlugs.has(r.slug);
          return (
            <li
              key={r.slug}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              aria-disabled={owned}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(r)}
              onMouseEnter={() => setActive(i)}
              className={`flex items-center justify-between gap-3 px-3.5 py-2 text-sm ${
                i === active ? "bg-surface-alt" : ""
              } ${owned ? "cursor-default opacity-50" : "cursor-pointer"}`}
            >
              <span className="min-w-0 truncate">
                <span className="font-medium text-ink">{r.name}</span>
                {r.matchedAlias && <span className="ml-2 text-xs text-ink-muted">matches &ldquo;{r.matchedAlias}&rdquo;</span>}
              </span>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                {owned ? "Added" : SKILL_CATEGORY_TAGS[r.category]}
              </span>
            </li>
          );
        })}
      </ul>

      <div aria-live="polite">
        {noMatch && (
          <div className="mt-2 rounded-theme-md border border-dashed border-border-strong bg-surface-alt/40 p-3.5">
            <p className="text-sm text-ink">No skill called &ldquo;{trimmed}&rdquo; in the catalog.</p>
            {didYouMean.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-ink-muted">Did you mean</span>
                {didYouMean.map((s) => (
                  <button
                    key={s.slug}
                    type="button"
                    disabled={ownedSlugs.has(s.slug)}
                    onClick={() => choose(s)}
                    className="rounded-theme-sm border border-border-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink transition hover:border-ink disabled:cursor-default disabled:opacity-45"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            {reporting ? (
              <ReportSkillForm rawName={trimmed} onReport={onReport} onDone={reset} onCancel={() => setReporting(false)} />
            ) : (
              <button
                type="button"
                onClick={() => setReporting(true)}
                className="mt-3 rounded-theme-sm text-xs font-semibold text-trust underline underline-offset-4 hover:text-trust-strong"
              >
                Can&apos;t find it? Report &ldquo;{trimmed}&rdquo;
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create the suggestion strip**

Create `app/ui/skill-picker/SuggestionStrip.tsx`:

```tsx
"use client";

import { useId } from "react";

import type { SkillSuggestion } from "@/lib/skill-suggestions";

const SOURCE_LABEL = { github: "GitHub", resume: "Resume" } as const;

// Skills the user's resume or GitHub already show, one click from being
// added. Drawn in the evidence (trust) colour because that's where they
// came from -- once added they become self-ratings like any other.
export function SuggestionStrip({
  suggestions,
  onAdd,
  onAddAll,
}: {
  suggestions: SkillSuggestion[];
  onAdd: (skill: SkillSuggestion) => void;
  onAddAll: () => void;
}) {
  const headingId = useId();
  if (suggestions.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="rounded-theme-md border border-trust/25 bg-trust/[0.04] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-trust-strong">
          Found in your evidence
        </h3>
        <button
          type="button"
          onClick={onAddAll}
          className="rounded-theme-sm text-xs font-semibold text-trust underline underline-offset-4 hover:text-trust-strong"
        >
          Add all {suggestions.length}
        </button>
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-1.5">
        {suggestions.map((s) => {
          const sources = s.sources.map((src) => SOURCE_LABEL[src]).join(" · ");
          return (
            <li key={s.slug}>
              <button
                type="button"
                onClick={() => onAdd(s)}
                aria-label={`Add ${s.name}, found on your ${sources}`}
                className="inline-flex items-center gap-1.5 rounded-theme-sm border border-trust/25 bg-surface py-1 pl-2 pr-2.5 text-xs font-medium text-ink transition hover:border-trust hover:bg-trust/10"
              >
                <span aria-hidden="true" className="text-trust">
                  +
                </span>
                {s.name}
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">{sources}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 6: Create the category browser**

Create `app/ui/skill-picker/CategoryBrowser.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import {
  SKILL_CATEGORIES,
  SKILL_CATEGORY_LABELS,
  type SkillCategoryName,
  type SkillSearchResult,
} from "@/lib/skill-catalog-core";

const BROWSE_CATEGORIES = SKILL_CATEGORIES.filter((c) => c !== "OTHER");

// For people who don't know what to type: popular skills per category,
// fetched once per category the first time its tab is opened.
export function CategoryBrowser({
  ownedSlugs,
  onAdd,
}: {
  ownedSlugs: ReadonlySet<string>;
  onAdd: (skill: SkillSearchResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<SkillCategoryName>("LANGUAGE");
  const [loaded, setLoaded] = useState<Partial<Record<SkillCategoryName, SkillSearchResult[]>>>({});

  useEffect(() => {
    if (!open || loaded[category]) return;
    let cancelled = false;
    fetch(`/api/skills/popular?category=${category}`)
      .then((res) => (res.ok ? res.json() : { results: [] }))
      .then((body: { results: SkillSearchResult[] }) => {
        if (!cancelled) setLoaded((prev) => ({ ...prev, [category]: body.results }));
      })
      .catch(() => {
        if (!cancelled) setLoaded((prev) => ({ ...prev, [category]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [open, category, loaded]);

  const skills = loaded[category];

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="rounded-theme-md border border-border bg-surface"
    >
      <summary className="cursor-pointer px-3.5 py-2.5 text-sm font-medium text-ink">Browse by category</summary>
      <div className="border-t border-border px-3.5 py-3">
        <div role="tablist" aria-label="Skill categories" className="flex flex-wrap gap-1">
          {BROWSE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={c === category}
              onClick={() => setCategory(c)}
              className={`rounded-theme-sm px-2.5 py-1 text-xs font-medium transition ${
                c === category ? "bg-ink text-bg" : "text-ink-muted hover:bg-surface-alt hover:text-ink"
              }`}
            >
              {SKILL_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="mt-3">
          {!skills ? (
            <p className="text-xs text-ink-muted">Loading…</p>
          ) : skills.length === 0 ? (
            <p className="text-xs text-ink-muted">Nothing here yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {skills.map((s) => {
                const owned = ownedSlugs.has(s.slug);
                return (
                  <li key={s.slug}>
                    <button
                      type="button"
                      disabled={owned}
                      onClick={() => onAdd(s)}
                      className="rounded-theme-sm border border-border-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink transition hover:border-ink disabled:cursor-default disabled:opacity-45"
                    >
                      {owned ? `✓ ${s.name}` : s.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
}
```

- [ ] **Step 7: Create the picker**

Create `app/ui/skill-picker/SkillPicker.tsx`:

```tsx
"use client";

import { useMemo } from "react";

import { Pill } from "@/app/ui/primitives";
import type { OpenReport } from "@/lib/skill-report-input";
import { rankSuggestions, type EvidenceSnapshot } from "@/lib/skill-suggestions";

import { CategoryBrowser } from "./CategoryBrowser";
import { SkillRatingRow, LevelKey } from "./SkillRatingRow";
import { SkillSearch } from "./SkillSearch";
import { SuggestionStrip } from "./SuggestionStrip";
import { useSkillEditor, type SkillEditorState } from "./use-skill-editor";

// Spec section 5.1. One component for onboarding and /profile/skills;
// every change saves immediately through app/skills/actions.ts.
export function SkillPicker({
  initial,
  evidence,
  onChange,
}: {
  initial: SkillEditorState;
  evidence: EvidenceSnapshot | null;
  onChange?: (state: SkillEditorState) => void;
}) {
  const editor = useSkillEditor(initial, onChange);
  const owned = useMemo(() => new Set(editor.skills.map((s) => s.slug)), [editor.skills]);
  const suggestions = useMemo(() => (evidence ? rankSuggestions(evidence, owned) : []), [evidence, owned]);

  return (
    <div className="flex flex-col gap-4">
      <SuggestionStrip
        suggestions={suggestions}
        onAdd={(s) => editor.add(s)}
        onAddAll={() => editor.addMany(suggestions)}
      />
      <SkillSearch ownedSlugs={owned} onAdd={(s) => editor.add(s)} onReport={editor.report} />
      <CategoryBrowser ownedSlugs={owned} onAdd={(s) => editor.add(s)} />

      {editor.error && (
        <p
          role="alert"
          className="flex items-start justify-between gap-3 rounded-theme-md border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger"
        >
          {editor.error}
          <button type="button" onClick={editor.dismissError} className="shrink-0 text-xs font-semibold underline">
            Dismiss
          </button>
        </p>
      )}

      <section aria-label="Your skills" className="overflow-hidden rounded-theme-md border border-border">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-surface-alt/50 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Pill tone="warm">Self-reported</Pill>
            <LevelKey />
          </div>
          <p aria-live="polite" className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
            <span className="tabular-nums text-ink">{editor.skills.length}</span>{" "}
            {editor.skills.length === 1 ? "skill" : "skills"}
          </p>
        </div>
        {editor.skills.length === 0 && editor.reports.length === 0 ? (
          <p className="bg-surface px-4 py-6 text-sm text-ink-muted">No skills yet. Search above or add a suggestion.</p>
        ) : (
          <ul className="divide-y divide-border">
            {editor.skills.map((s) => (
              <SkillRatingRow
                key={s.slug}
                label={s.name}
                level={s.level}
                busy={editor.busy.has(s.slug)}
                onSelect={(level) => editor.setLevel(s.slug, level)}
                onRemove={() => editor.remove(s.slug)}
              />
            ))}
            {editor.reports.map((r) => (
              <ReportRow
                key={r.id}
                report={r}
                busy={editor.busy.has(r.id)}
                onCancel={() => editor.cancelReport(r.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ReportRow({ report, busy, onCancel }: { report: OpenReport; busy: boolean; onCancel: () => void }) {
  const pending = report.status === "PENDING";
  return (
    <li className="flex items-center justify-between gap-3 bg-surface-alt/40 px-4 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink-muted">{report.rawName}</p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted/80">
          {pending ? "Pending review" : "Not added"}
        </p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded-theme-sm text-xs font-semibold text-ink-muted underline decoration-border-strong underline-offset-4 transition hover:text-ink disabled:opacity-40"
      >
        {pending ? "Cancel" : "Dismiss"}
      </button>
    </li>
  );
}
```

- [ ] **Step 8: Create the /profile/skills page**

Create `app/(protected)/profile/skills/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEvidenceSnapshot } from "@/lib/evidence";
import { listOpenReports } from "@/lib/skill-requests";
import { getUserSkills } from "@/lib/user-skills";
import { Eyebrow } from "@/app/ui/primitives";
import { SkillPicker } from "@/app/ui/skill-picker/SkillPicker";

export const metadata: Metadata = {
  title: "SkillGrid – Your skills",
};

// Post-onboarding skill editing (spec 5.3) -- the same picker onboarding
// uses, so GitHub or resume evidence gathered later turns into one-click
// suggestions here.
export default async function ProfileSkillsPage() {
  // The (protected) layout already guarantees a signed-in, onboarded user.
  const session = (await auth())!;
  const userId = session.user!.id!;

  const profile = await prisma.profile.findUnique({ where: { userId }, select: { activeResumeId: true } });
  const [skills, reports, evidence] = await Promise.all([
    getUserSkills(userId),
    listOpenReports(userId),
    getEvidenceSnapshot(userId, profile?.activeResumeId ?? null),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-12">
      <header>
        <Link
          href="/profile"
          className="rounded-theme-sm text-xs font-semibold text-ink-muted underline decoration-border-strong underline-offset-4 hover:text-ink"
        >
          ← Back to profile
        </Link>
        <Eyebrow className="mt-5">Skills</Eyebrow>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">Your skills</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Add anything you know and rate how comfortable you are. Changes save as you go.
        </p>
      </header>
      <SkillPicker initial={{ skills, reports }} evidence={evidence} />
    </main>
  );
}
```

- [ ] **Step 9: Link it from the profile page**

In `app/(protected)/profile/page.tsx`, in the "Skills × evidence" section header, replace:

```tsx
            {grid.rows.length > 0 && (
              <span className="font-mono text-xs text-ink-muted tabular-nums">
                {grid.backedCount} of {grid.rows.length} backed by evidence
              </span>
            )}
```

with:

```tsx
            <div className="flex items-center gap-3">
              {grid.rows.length > 0 && (
                <span className="font-mono text-xs text-ink-muted tabular-nums">
                  {grid.backedCount} of {grid.rows.length} backed by evidence
                </span>
              )}
              <Link
                href="/profile/skills"
                className="rounded-theme-sm text-xs font-semibold text-trust underline underline-offset-4 hover:text-trust-strong"
              >
                Edit skills
              </Link>
            </div>
```

In the same file, change the empty-state message to:

```tsx
              <Empty message="No skills yet. Add some, upload a resume or connect GitHub and they'll appear here." />
```

- [ ] **Step 10: Typecheck, lint and test**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass. If `react-hooks` lint flags `setLoading(true)` or `setData` in `SkillSearch`'s effect, they're inside the `setTimeout` callback (asynchronous), which the rule allows. If it still flags them, move the callback body into a named `async function runSearch()` declared inside the effect and call it from `setTimeout`.

- [ ] **Step 11: Manual check (needs a signed-in user; ask the user to run it if you can't sign in)**

Run `npm run dev`, sign in with an onboarded account and open `/profile/skills`:
- Type `raect`. Expect "No skill called…", a "Did you mean React" chip, and the Report link.
- Type `react`. Press Enter. React is added at Comfortable. Change it to Confident, reload, and it's still Confident.
- **Review Focus 1:** add Kotlin and immediately click its remove ×. The × is disabled until the add finishes. Remove it, reload: the list matches what was shown.
- Report `SomeFakeSkill`. It appears as "Pending review". Cancel removes it.
- Open "Browse by category" → Databases. Chips load; clicking one adds it.
- At 375 px wide, nothing scrolls horizontally.

- [ ] **Step 12: Commit**

```bash
git add app/ui/skill-picker "app/(protected)/profile/skills/page.tsx" "app/(protected)/profile/page.tsx"
git commit -m "Add the SkillPicker and a /profile/skills page to edit skills" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Onboarding on the new skill model

**Files:**
- Modify: `app/onboarding/page.tsx`
- Modify: `app/onboarding/OnboardingWizard.tsx`
- Modify: `app/onboarding/steps/SkillsStep.tsx` (rewrite)
- Modify: `app/onboarding/steps/ReviewStep.tsx` (rewrite)
- Modify: `app/onboarding/steps/ResumeStep.tsx` (type only)
- Modify: `app/onboarding/actions.ts`

**Interfaces:**
- Consumes: `SkillPicker`, `SkillEditorState` (Task 6); `getEvidenceSnapshotAction` (Task 5); `getUserSkills`, `listOpenReports`, `countSkillsAndPendingReports` (Tasks 4–5); `buildSkillGrid` (Task 4).
- Produces:
  - `OnboardingWizard` props `{ userId: string; initialSkills: SkillEditorState }`.
  - `SubmitPayload` without `skillRatings`.
  - `ResumeCheckState` with `extractedSkills: string[]`.

- [ ] **Step 1: Load existing skills on the onboarding page**

In `app/onboarding/page.tsx`, add imports:

```ts
import { listOpenReports } from "@/lib/skill-requests";
import { getUserSkills } from "@/lib/user-skills";
```

After the `if (profile?.onboardingCompletedAt) { redirect("/dashboard"); }` block add:

```ts
  // Skills save as they're picked (spec 5.2), so a returning user who
  // abandoned onboarding gets their earlier picks back.
  const [skills, reports] = await Promise.all([getUserSkills(session.user.id), listOpenReports(session.user.id)]);
```

Change `<OnboardingWizard userId={session.user.id} />` to:

```tsx
        <OnboardingWizard userId={session.user.id} initialSkills={{ skills, reports }} />
```

- [ ] **Step 2: Rewrite `SkillsStep.tsx`**

Replace `app/onboarding/steps/SkillsStep.tsx` with:

```tsx
"use client";

import { SkillPicker } from "@/app/ui/skill-picker/SkillPicker";
import type { SkillEditorState } from "@/app/ui/skill-picker/use-skill-editor";
import type { EvidenceSnapshot } from "@/lib/skill-suggestions";

import { StepShell } from "./StepShell";

// Spec section 5.2: the same picker as /profile/skills, saving as the user
// goes. `value` seeds the picker when the step mounts and drives Continue;
// the picker reports every change back through onChange.
export function SkillsStep({
  value,
  evidence,
  onChange,
  onContinue,
  onBack,
}: {
  value: SkillEditorState;
  evidence: EvidenceSnapshot | null;
  onChange: (next: SkillEditorState) => void;
  onContinue: () => void;
  onBack?: () => void;
}) {
  const count = value.skills.length + value.reports.filter((r) => r.status === "PENDING").length;

  return (
    <StepShell
      title="Add your skills"
      description="Search for anything you know and rate how comfortable you are. Skills found on your resume or GitHub show up as suggestions."
      onContinue={onContinue}
      onBack={onBack}
      continueDisabled={count === 0}
      disabledHint="Add at least one skill to continue."
    >
      <SkillPicker initial={value} evidence={evidence} onChange={onChange} />
    </StepShell>
  );
}
```

- [ ] **Step 3: Rewrite `ReviewStep.tsx`**

Replace `app/onboarding/steps/ReviewStep.tsx` with:

```tsx
"use client";

import { AVAILABILITY_LABELS, type AvailabilityOption } from "@/lib/onboarding-options";
import { buildSkillGrid } from "@/lib/skill-grid";
import type { OpenReport } from "@/lib/skill-report-input";
import type { EvidenceSnapshot } from "@/lib/skill-suggestions";
import { SKILL_RATING_LABELS, type UserSkillEntry } from "@/lib/skills";
import { Empty, Eyebrow, Pill, PrimaryButton, TrustBadge } from "@/app/ui/primitives";
import { EvidenceGrid, GridLegend } from "@/app/ui/EvidenceGrid";
import type { StepKey } from "../Stepper";

import { ArrowRight, StepCard, StepFooter, StepHeading } from "./StepShell";

// Spec section 5.2: a summary of everything collected so far. Skills are
// already saved (the picker writes as you go), so this only previews them
// on the grid beside what the resume and GitHub found. Detected skills are
// evidence, not ratings -- nothing is reconciled into ratings here.
export function ReviewStep({
  hasResume,
  resumeUsedOcr,
  skills,
  reports,
  evidence,
  interestTags,
  availability,
  projectLinks,
  githubUsername,
  onEditStep,
  onBack,
  onSubmit,
  isSubmitting,
  error,
}: {
  hasResume: boolean;
  resumeUsedOcr: boolean;
  skills: UserSkillEntry[];
  reports: OpenReport[];
  evidence: EvidenceSnapshot | null;
  interestTags: string[];
  availability: AvailabilityOption | null;
  projectLinks: string[];
  githubUsername: string | null;
  onEditStep: (step: StepKey) => void;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  const names = new Map(Object.entries(evidence?.names ?? {}));
  const grid = buildSkillGrid({
    userSkills: skills,
    resumeSkills: evidence?.resume ?? [],
    githubSkills: evidence?.github ?? [],
    skillNames: names,
  });
  const pendingReports = reports.filter((r) => r.status === "PENDING");
  const resumeSkillNames = (evidence?.resume ?? []).flatMap((slug) => names.get(slug) ?? []);

  return (
    <StepCard>
      <StepHeading title="Review and submit" description="Check everything below, then submit your profile." />

      <div className="flex flex-col gap-4 px-5 pb-6 sm:px-7">
        <ReviewRow label="Your grid so far" onEdit={() => onEditStep("skills")} editLabel="Edit skills">
          {grid.rows.length > 0 ? (
            <div className="flex flex-col gap-4">
              <EvidenceGrid
                columns={grid.columns}
                rows={grid.rows}
                selfColumn={grid.selfColumn}
                size="md"
                caption="Preview of your skill grid: your rating next to resume and GitHub evidence for each skill"
              />
              <GridLegend />
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <Pill key={s.slug} tone="warm">
                      {s.name} · {SKILL_RATING_LABELS[s.level]}
                    </Pill>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Empty message="No skills yet. Add a few so your grid has something on it." />
          )}
          {pendingReports.length > 0 && (
            <p className="mt-3 text-xs text-ink-muted">
              Waiting for review: {pendingReports.map((r) => r.rawName).join(", ")}. They join your grid once approved.
            </p>
          )}
        </ReviewRow>

        {hasResume && (
          <ReviewRow
            label={resumeUsedOcr ? "From your resume (scanned with OCR)" : "From your resume"}
            aside={<TrustBadge>Evidence</TrustBadge>}
          >
            {evidence === null ? (
              <Empty message="Loading…" />
            ) : resumeSkillNames.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {resumeSkillNames.map((name) => (
                  <Pill key={name} tone="trust">
                    {name}
                  </Pill>
                ))}
              </div>
            ) : (
              <Empty message="No skills found on your resume. Add them yourself in the skills step." />
            )}
          </ReviewRow>
        )}

        <ReviewRow label="Interests" onEdit={() => onEditStep("interests")}>
          {interestTags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {interestTags.map((tag) => (
                <Pill key={tag}>{tag}</Pill>
              ))}
            </div>
          ) : (
            <Empty message="None selected" />
          )}
        </ReviewRow>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ReviewRow label="Availability" onEdit={() => onEditStep("availability")}>
            {availability ? (
              <span className="text-sm font-medium">{AVAILABILITY_LABELS[availability]}</span>
            ) : (
              <Empty message="Not set" />
            )}
          </ReviewRow>

          <ReviewRow label="GitHub" onEdit={() => onEditStep("github")}>
            {githubUsername ? (
              <TrustBadge>Connected as @{githubUsername}</TrustBadge>
            ) : (
              <Empty message="Not connected" />
            )}
          </ReviewRow>
        </div>

        <ReviewRow label="Projects" onEdit={() => onEditStep("projects")}>
          {projectLinks.filter(Boolean).length > 0 ? (
            <ul className="flex flex-col gap-1.5 text-sm">
              {projectLinks.filter(Boolean).map((link) => (
                <li key={link} className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-[2px] bg-ink-muted" />
                  <span className="truncate font-mono text-xs">{link}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty message="None added" />
          )}
        </ReviewRow>

        {error && (
          <p role="alert" className="rounded-theme-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      <StepFooter
        onBack={onBack}
        actions={
          <PrimaryButton type="button" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit profile"}
            {!isSubmitting && <ArrowRight />}
          </PrimaryButton>
        }
      />
    </StepCard>
  );
}

function ReviewRow({
  label,
  onEdit,
  editLabel = "Edit",
  aside,
  children,
}: {
  label: string;
  onEdit?: () => void;
  editLabel?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-theme-md border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Eyebrow>{label}</Eyebrow>
        {aside}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`${editLabel}: ${label}`}
            className="rounded-theme-sm text-xs font-semibold text-ink-muted underline decoration-border-strong underline-offset-4 transition hover:text-ink hover:decoration-ink"
          >
            {editLabel}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
```

- [ ] **Step 4: Update the wizard**

In `app/onboarding/OnboardingWizard.tsx`:

1. Replace `import type { SkillRatings, SkillSlug } from "@/lib/skills";` with:
   ```ts
   import type { SkillEditorState } from "@/app/ui/skill-picker/use-skill-editor";
   import type { EvidenceSnapshot } from "@/lib/skill-suggestions";
   ```
2. Replace `import { submitOnboardingAction } from "./actions";` with:
   ```ts
   import { getEvidenceSnapshotAction } from "@/app/skills/actions";

   import { submitOnboardingAction } from "./actions";
   ```
3. Change the storage key to v2:
   ```ts
   return `skillgrid_onboarding_wizard_v2:${userId}`;
   ```
   Add a line to the comment above it: `// v2: skills moved to the database (saved as picked), so drafts no longer carry them.`
4. In `type WizardState`, change `resumeSkills: SkillSlug[];` to `resumeSkills: string[];` and delete `skillRatings: SkillRatings;`. In `INITIAL_STATE`, delete `skillRatings: {},`.
5. Change the component signature and add state below the existing `useState` calls:
   ```tsx
   export function OnboardingWizard({ userId, initialSkills }: { userId: string; initialSkills: SkillEditorState }) {
   ```
   ```tsx
     // Skills live in the database, not the sessionStorage draft; this just
     // mirrors the picker's list for Continue and the Review preview.
     const [skillState, setSkillState] = useState<SkillEditorState>(initialSkills);
     const [evidence, setEvidence] = useState<EvidenceSnapshot | null>(null);
   ```
6. After the `const currentKey = steps[state.stepIndex];` line add:
   ```tsx
     // Suggestions and the Review preview read the user's evidence, which
     // changes mid-wizard (resume upload, GitHub connect) -- refetch it
     // whenever one of the two screens that show it opens.
     useEffect(() => {
       if (currentKey !== "skills" && currentKey !== "review") return;
       let cancelled = false;
       getEvidenceSnapshotAction(state.resumeEvidenceId)
         .then((snapshot) => {
           if (!cancelled) setEvidence(snapshot);
         })
         .catch((err) => console.error("Loading evidence failed:", err));
       return () => {
         cancelled = true;
       };
     }, [currentKey, state.resumeEvidenceId, state.githubEvidenceId]);
   ```
7. In `handleSubmit`, delete the "Reconcile resume-extracted tags…" comment and the `merged` block. Then remove the `skillRatings: merged,` line from the `submitOnboardingAction({...})` call.
8. Replace the `SkillsStep` element with:
   ```tsx
                 <SkillsStep
                   value={skillState}
                   evidence={evidence}
                   onChange={setSkillState}
                   onContinue={next}
                   onBack={state.path === "A" ? back : undefined}
                 />
   ```
9. Replace the `ReviewStep` element's skill props
   (`resumeSkills=…`, `onResumeSkillsChange=…`, `skillRatings=…`) with:
   ```tsx
                   skills={skillState.skills}
                   reports={skillState.reports}
                   evidence={evidence}
   ```
   Keep every other `ReviewStep` prop.

- [ ] **Step 5: Update `ResumeStep.tsx` types**

In `app/onboarding/steps/ResumeStep.tsx`, delete `import type { SkillSlug } from "@/lib/skills";` and change `extractedSkills: SkillSlug[];` in the `onPassed` prop type to `extractedSkills: string[];`.

- [ ] **Step 6: Update the onboarding actions**

In `app/onboarding/actions.ts`:

1. Replace the `import { … } from "@/lib/skills";` block with:
   ```ts
   import { countSkillsAndPendingReports } from "@/lib/user-skills";
   ```
2. In `ResumeCheckState`, change `extractedSkills: SkillSlug[];` to `extractedSkills: string[];`.
3. In `SubmitPayload`, delete `skillRatings: SkillRatings;`.
4. In `submitOnboardingAction`, replace the block from `const skillRatings: SkillRatings = {};` through the closing `}` of `if (Object.keys(skillRatings).length === 0) { … }` with:
   ```ts
   // Skills are saved as they're picked (app/skills/actions.ts), so just
   // confirm the user has at least one -- or one waiting for review.
   const { skills, pendingReports } = await countSkillsAndPendingReports(userId);
   if (skills + pendingReports === 0) {
     return { error: "Please add at least one skill." };
   }
   ```
5. Replace the comment block above the resume ownership check with:
   ```ts
   // resumeEvidenceId/githubEvidenceId come from client state -- verify
   // they're actually this user's own records before trusting them, the
   // same check selectResumeAction makes
   // (app/(protected)/profile/resume/actions.ts). Detected skills are
   // evidence only; nothing is folded into self-ratings here.
   ```
6. Replace the block from `let finalSkillRatings = skillRatings;` to the end of its `if (payload.githubEvidenceId) { … }` with:
   ```ts
   if (payload.githubEvidenceId) {
     const record = await prisma.evidenceRecord.findUnique({ where: { id: payload.githubEvidenceId } });
     if (!record || record.userId !== userId || record.source !== "GITHUB") {
       return { error: "Invalid GitHub connection." };
     }
   }
   ```
7. In the `prisma.profile.upsert` call, delete `skillRatings: finalSkillRatings,` from both `create` and `update`.

- [ ] **Step 7: Typecheck, lint and test**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass. The `useEffect` dependency on `state.githubEvidenceId` is deliberate (refetch after connecting GitHub); `exhaustive-deps` allows extra reactive dependencies.

- [ ] **Step 8: Manual check (ask the user if you can't sign in)**

With a fresh account (or after deleting its `profiles` row), go through `/onboarding`:
- **Path B:** add two skills, continue, connect GitHub, return to Skills via Review → Edit skills. GitHub suggestions appear. Submit, and the dashboard grid shows them.
- **Path A:** upload a resume. The Skills step shows "Found in your evidence" with resume skills. Review lists "From your resume" as evidence.
- Continue is disabled with zero skills and zero pending reports, and enabled with only a pending report.

- [ ] **Step 9: Commit**

```bash
git add app/onboarding
git commit -m "Move onboarding to the skill picker and UserSkill rows" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Catalog-wide resume matching

**Files:**
- Create: `lib/resume-matcher.ts`
- Modify: `lib/resume-parser.ts`
- Modify: `lib/resume-upload.ts`
- Modify: `app/(protected)/profile/resume/actions.ts`
- Modify: `app/page.tsx` (copy)
- Test: `tests/resume-matcher.test.ts`

**Interfaces:**
- Consumes: `CatalogSkill` (Task 2), `getCatalog` (Task 3).
- Produces:
  - `type MatchableSkill = Pick<CatalogSkill, "slug" | "name" | "aliases" | "strictMatch">`
  - `skillsSectionText(text: string): string`
  - `matchSkillsInText(text: string, catalog: readonly MatchableSkill[]): string[]`
  - `extractSkillsFromResumeText(text): Promise<string[]>` (now async)
  - `ResumeUploadResult.extractedSkills: string[]`

- [ ] **Step 1: Write the failing test**

Create `tests/resume-matcher.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { matchSkillsInText, skillsSectionText, type MatchableSkill } from "@/lib/resume-matcher";

function skill(slug: string, name: string, aliases: string[] = [], strictMatch = false): MatchableSkill {
  return { slug, name, aliases, strictMatch };
}

const CATALOG: MatchableSkill[] = [
  skill("javascript", "JavaScript", ["JS"]),
  skill("typescript", "TypeScript", ["TS"]),
  skill("java", "Java"),
  skill("git", "Git", ["GitHub"]),
  skill("cpp", "C++", ["CPP"]),
  skill("csharp", "C#"),
  skill("c", "C", [], true),
  skill("r", "R", [], true),
  skill("go", "Go", ["Golang", "golang"], true),
  skill("nodejs", "Node.js", ["Node"]),
  skill("react", "React", ["ReactJS"], true),
  skill("sql", "SQL"),
  skill("mysql", "MySQL"),
  skill("dotnet", ".NET", [".NET Core"]),
  skill("aspnet", "ASP.NET", ["ASP.NET Core"]),
  skill("python", "Python"),
  skill("uiux", "UI/UX Design", ["UI/UX"]),
  skill("weird", "A+ (cert)?"),
];

const match = (text: string) => matchSkillsInText(text, CATALOG).sort();

describe("matchSkillsInText", () => {
  it("matches punctuation-heavy names", () => {
    expect(match("Built with React, Node.js and C++.")).toEqual(["cpp", "nodejs", "react"]);
  });

  it("does not read the .js suffix of a framework as JavaScript", () => {
    expect(match("Frontend in Vue.js")).toEqual([]);
  });

  it("does not match inside other words", () => {
    expect(match("Led projects in digital marketing")).toEqual([]);
    expect(match("JavaScript developer")).toEqual(["javascript"]);
    expect(match("Databases: MySQL")).toEqual(["mysql"]);
  });

  it("is case-sensitive for strictMatch skills", () => {
    expect(match("Wrote services in Go and Python")).toEqual(["go", "python"]);
    expect(match("ready to go the extra mile")).toEqual([]);
    expect(match("I react quickly to feedback")).toEqual([]);
  });

  it("only counts single-letter skills inside a Skills section", () => {
    expect(match("Grade: C in Chemistry\nSKILLS\nPython, R\nEducation\nC programming course")).toEqual(["python", "r"]);
  });

  it("reads inline Skills: lines and keeps C, C++ and C# apart", () => {
    expect(match("Technical Skills: C, C#")).toEqual(["c", "csharp"]);
  });

  it("does not see .NET inside ASP.NET", () => {
    expect(match("APIs with ASP.NET Core")).toEqual(["aspnet"]);
    expect(match("Desktop apps on .NET")).toEqual(["dotnet"]);
  });

  it("handles regex metacharacters in names without throwing", () => {
    expect(match("Certified A+ (cert)? holder, UI/UX work")).toEqual(["uiux", "weird"]);
  });
});

describe("skillsSectionText", () => {
  it("returns only the lines between a Skills heading and the next section", () => {
    expect(skillsSectionText("Summary\nhi\nSkills\nPython\nGo\nProjects\nX").trim()).toBe("Python\nGo");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/resume-matcher.test.ts`
Expected: FAIL, cannot resolve `@/lib/resume-matcher`.

- [ ] **Step 3: Create `lib/resume-matcher.ts`**

```ts
// Matches resume text against the whole skill catalog (spec 4.2). Pure:
// lib/resume-parser.ts passes in the cached catalog.

import type { CatalogSkill } from "@/lib/skill-catalog-core";

export type MatchableSkill = Pick<CatalogSkill, "slug" | "name" | "aliases" | "strictMatch">;

// Lines that end a Skills section. Kept separate from the integrity
// check's SECTION_HEADERS (lib/resume-parser.ts) so widening this list
// doesn't make the "is this a resume?" check easier to pass.
const SECTION_END_HEADERS = [
  "experience",
  "work experience",
  "education",
  "projects",
  "summary",
  "objective",
  "certifications",
  "achievements",
  "awards",
  "publications",
  "interests",
  "hobbies",
  "extracurricular activities",
  "positions of responsibility",
  "relevant coursework",
  "coursework",
];

const SKILLS_HEADING = /^\s*(technical\s+)?skills\b\s*:?/i;

/** The text under any "Skills" / "Technical Skills" heading (including an inline "Skills: a, b"). */
export function skillsSectionText(text: string): string {
  const out: string[] = [];
  let inSection = false;
  for (const line of text.split(/\r?\n/)) {
    const heading = line.trim().toLowerCase().replace(/[:\s]+$/, "");
    if (SKILLS_HEADING.test(line)) {
      inSection = true;
      out.push(line.replace(SKILLS_HEADING, ""));
      continue;
    }
    if (inSection && SECTION_END_HEADERS.includes(heading)) {
      inSection = false;
      continue;
    }
    if (inSection) out.push(line);
  }
  return out.join("\n");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Boundaries: not preceded by a letter/digit or ".", not followed by a
// letter/digit or + or # -- so "java" misses "javascript", "git" misses
// "digital", "JS" misses "Node.js", "C" misses "C++"/"C#", and ".NET"
// misses "ASP.NET". Built with new RegExp because lookbehind needs ES2018
// and tsconfig targets ES2017.
function termPattern(term: string, caseSensitive: boolean): RegExp {
  return new RegExp(`(?<![A-Za-z0-9.])${escapeRegExp(term)}(?![A-Za-z0-9+#])`, caseSensitive ? "" : "i");
}

export function matchSkillsInText(text: string, catalog: readonly MatchableSkill[]): string[] {
  const skillsSection = skillsSectionText(text);
  const found: string[] = [];
  for (const skill of catalog) {
    const hit = [skill.name, ...skill.aliases].some((raw) => {
      const term = raw.trim();
      if (!term) return false;
      // A lone letter ("C", "R") is only trusted in a list of skills.
      const haystack = term.length === 1 ? skillsSection : text;
      return termPattern(term, skill.strictMatch).test(haystack);
    });
    if (hit) found.push(skill.slug);
  }
  return found;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/resume-matcher.test.ts`
Expected: PASS.

- [ ] **Step 5: Point the resume parser at the catalog**

In `lib/resume-parser.ts`:

1. Replace `import { SKILL_KEYWORDS, type SkillSlug } from "@/lib/skills";` with:
   ```ts
   import { matchSkillsInText } from "@/lib/resume-matcher";
   import { getCatalog } from "@/lib/skill-catalog";
   ```
2. Replace everything from the comment `// The "slow full parse" from section 4.1:` to the end of the file with:
   ```ts
   // The "slow full parse" from section 4.1: match the extracted text
   // (pdf-parse's text layer, or OCR for scanned resumes -- see
   // extractResumeText above) against the whole skill catalog. Kept as a
   // separate step from the integrity check to preserve the
   // fast-check/full-parse split. Matching rules live in lib/resume-matcher.ts.
   export async function extractSkillsFromResumeText(text: string): Promise<string[]> {
     return matchSkillsInText(text, await getCatalog());
   }
   ```

- [ ] **Step 6: Update `lib/resume-upload.ts`**

1. Delete `import type { SkillSlug } from "@/lib/skills";`.
2. In `ResumeUploadResult`, change `extractedSkills: SkillSlug[];` to `extractedSkills: string[];`.
3. Change `const extractedSkills = extractSkillsFromResumeText(text);` to `const extractedSkills = await extractSkillsFromResumeText(text);`.
4. In the comment above `processResumeUpload`, change `(create an EvidenceRecord, update Profile.skillRatings, etc)` to `(create an EvidenceRecord, make it the active resume, etc)`.

- [ ] **Step 7: Stop resume actions writing ratings**

Replace `app/(protected)/profile/resume/actions.ts` with:

```ts
"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { processResumeUpload } from "@/lib/resume-upload";

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Not signed in");
  }
  return userId;
}

export type ReuploadState = { error: string } | null;

// Uploads a new resume, adds it to the user's evidence history and makes
// it the active one. Its extracted skills are evidence (the grid's Resume
// column) and picker suggestions -- they no longer touch self-ratings.
export async function reuploadResumeAction(
  _prevState: ReuploadState,
  formData: FormData,
): Promise<ReuploadState> {
  const userId = await requireUserId();
  const file = formData.get("resume");
  if (!(file instanceof File)) {
    return { error: "Please choose a resume to upload." };
  }

  const result = await processResumeUpload(userId, file);
  if (!result.ok) {
    return { error: result.reason };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const record = await tx.evidenceRecord.create({
        data: {
          userId,
          source: "RESUME",
          payload: {
            fileUrl: result.fileUrl,
            filename: result.filename,
            status: "parsed",
            extractedSkills: result.extractedSkills,
            usedOcr: result.usedOcr,
          },
        },
      });
      await tx.profile.update({
        where: { userId },
        data: { activeResumeId: record.id },
      });
    });
  } catch (err) {
    console.error("reuploadResumeAction save failed:", err);
    return { error: "Something went wrong saving your resume. Please try again." };
  }

  revalidatePath("/profile/resume");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/profile/skills");
  return null;
}

// Switches back to a previously-uploaded resume without re-uploading it.
export async function selectResumeAction(evidenceId: string): Promise<ReuploadState> {
  const userId = await requireUserId();

  const record = await prisma.evidenceRecord.findUnique({ where: { id: evidenceId } });
  if (!record || record.userId !== userId || record.source !== "RESUME") {
    return { error: "That resume could not be found." };
  }

  try {
    await prisma.profile.update({
      where: { userId },
      data: { activeResumeId: evidenceId },
    });
  } catch (err) {
    console.error("selectResumeAction failed:", err);
    return { error: "Something went wrong switching resumes. Please try again." };
  }

  revalidatePath("/profile/resume");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/profile/skills");
  return null;
}
```

- [ ] **Step 8: Update the landing copy**

In `app/page.tsx`, in the `SOURCES` entry with `column: "Resume"`, change its `body` to:

```ts
    body: "Upload your resume as a PDF and we match it against a catalog of hundreds of languages, frameworks and tools. Skills it names fill this column.",
```

- [ ] **Step 9: Run tests, typecheck and lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass. Any remaining caller that used `extractSkillsFromResumeText` synchronously shows up as a type error here; there should be none besides `lib/resume-upload.ts`.

- [ ] **Step 10: Commit**

```bash
git add lib/resume-matcher.ts lib/resume-parser.ts lib/resume-upload.ts "app/(protected)/profile/resume/actions.ts" app/page.tsx tests/resume-matcher.test.ts
git commit -m "Match resumes against the whole skill catalog" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: GitHub languages and topics as evidence

**Files:**
- Create: `lib/github-skills.ts`
- Modify: `lib/github.ts`
- Modify: `app/api/github/callback/route.ts`
- Modify: `app/(protected)/dashboard/page.tsx` (copy)
- Modify: `app/(protected)/profile/page.tsx` (repo count field)
- Modify: `app/onboarding/steps/GithubStep.tsx` (copy)
- Test: `tests/github-skills.test.ts`

**Interfaces:**
- Consumes: `GithubSkillLevel` (Task 4); `resolveGithubLanguage`, `getCatalog` (Task 3); `findInCatalog` (Task 3).
- Produces:
  - `lib/github-skills.ts`:
    - `MAX_REPOS_FOR_LANGUAGES = 30`, `IGNORED_LANGUAGES`
    - `type RepoSummary = { name: string; pushedAt: string; topics: string[] }`
    - `type RepoLanguageBytes = Record<string, number>`
    - `type LanguageStat = { language: string; bytes: number; repos: number }`
    - `recentRepos(repos, limit?)`
    - `qualifyLanguages(perRepo): LanguageStat[]`
    - `countTopics(repos): Map<string, number>`
    - `type GithubSkill = { slug; level: GithubSkillLevel; bytes?: number; repos: number; via: ("language" | "topic")[] }`
    - `githubSkillLevels({ languages, topics }): GithubSkill[]`
  - `lib/github.ts`:
    - `fetchOwnedRepos`, `fetchRepoLanguages`
    - `scanGithubSkills(username, token): Promise<{ skills: GithubSkill[]; reposScanned: number }>`
    - `type GithubEvidencePayload` (v2)

- [ ] **Step 1: Write the failing test**

Create `tests/github-skills.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { countTopics, githubSkillLevels, qualifyLanguages, recentRepos } from "@/lib/github-skills";

describe("qualifyLanguages", () => {
  it("keeps languages at >= 1% of a repo or in >= 2 repos, and ignores build noise", () => {
    expect(
      qualifyLanguages([
        { TypeScript: 9000, CSS: 50, Makefile: 900 },
        { Python: 1000 },
        { Shell: 5, Python: 995 },
      ]),
    ).toEqual([
      { language: "TypeScript", bytes: 9000, repos: 1 },
      { language: "Python", bytes: 1995, repos: 2 },
    ]);
  });

  it("keeps a language that is small everywhere but in two repos", () => {
    expect(qualifyLanguages([{ Go: 10000, Shell: 5 }, { Rust: 10000, Shell: 5 }]).map((l) => l.language)).toContain("Shell");
  });

  it("handles no repos and empty repos (Review Focus 2)", () => {
    expect(qualifyLanguages([])).toEqual([]);
    expect(qualifyLanguages([{}, {}])).toEqual([]);
  });
});

describe("githubSkillLevels", () => {
  it("scores languages by share and repo count, topics by repo count, and merges both", () => {
    const skills = githubSkillLevels({
      languages: [
        { language: "TypeScript", slug: "typescript", bytes: 9000, repos: 1 },
        { language: "Python", slug: "python", bytes: 700, repos: 2 },
        { language: "HTML", slug: "html", bytes: 300, repos: 3 },
        { language: "Go", slug: "go", bytes: 30, repos: 1 },
      ],
      topics: [
        { slug: "react", repos: 2 },
        { slug: "docker", repos: 1 },
        { slug: "python", repos: 1 },
      ],
    });
    expect(skills.map((s) => [s.slug, s.level])).toEqual([
      ["typescript", 4],
      ["python", 3],
      ["html", 3],
      ["react", 3],
      ["go", 2],
      ["docker", 2],
    ]);
    expect(skills.find((s) => s.slug === "python")?.via).toEqual(["language", "topic"]);
  });

  it("gives every language at >= 25% of all bytes the top level", () => {
    const skills = githubSkillLevels({
      languages: [
        { language: "A", slug: "a", bytes: 600, repos: 1 },
        { language: "B", slug: "b", bytes: 400, repos: 1 },
      ],
      topics: [],
    });
    expect(skills.map((s) => s.level)).toEqual([4, 4]);
  });

  it("returns nothing for an account with no evidence (Review Focus 2)", () => {
    expect(githubSkillLevels({ languages: [], topics: [] })).toEqual([]);
  });
});

describe("recentRepos", () => {
  it("keeps the most recently pushed repos", () => {
    const repos = [
      { name: "old", pushedAt: "2024-01-01T00:00:00Z", topics: [] },
      { name: "new", pushedAt: "2026-01-01T00:00:00Z", topics: [] },
      { name: "mid", pushedAt: "2025-01-01T00:00:00Z", topics: [] },
    ];
    expect(recentRepos(repos, 2).map((r) => r.name)).toEqual(["new", "mid"]);
  });
});

describe("countTopics", () => {
  it("counts each topic once per repo, case-folded", () => {
    expect(
      countTopics([
        { name: "a", pushedAt: "", topics: ["React", "react", "docker"] },
        { name: "b", pushedAt: "", topics: ["react"] },
      ]),
    ).toEqual(
      new Map([
        ["react", 2],
        ["docker", 1],
      ]),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/github-skills.test.ts`
Expected: FAIL, cannot resolve `@/lib/github-skills`.

- [ ] **Step 3: Create `lib/github-skills.ts`**

```ts
// Turns a GitHub account's repos into skill evidence (spec 4.1). Pure --
// lib/github.ts does the API calls and catalog lookups around it.

import type { GithubSkillLevel } from "@/lib/skill-grid";

export const MAX_REPOS_FOR_LANGUAGES = 30;

// Build/config files linguist reports as languages but nobody lists as a
// skill. CMake and Dockerfile stay: both map to real skills.
export const IGNORED_LANGUAGES: ReadonlySet<string> = new Set(["Makefile", "Batchfile", "Procfile", "Roff"]);

// A language must be at least this share of some repo's code, or appear
// in two or more repos, so one stray script doesn't become a skill.
const MIN_REPO_SHARE = 0.01;

export type RepoSummary = { name: string; pushedAt: string; topics: string[] };
export type RepoLanguageBytes = Record<string, number>;
export type LanguageStat = { language: string; bytes: number; repos: number };

export function recentRepos(repos: readonly RepoSummary[], limit = MAX_REPOS_FOR_LANGUAGES): RepoSummary[] {
  return [...repos].sort((a, b) => b.pushedAt.localeCompare(a.pushedAt)).slice(0, limit);
}

export function qualifyLanguages(perRepo: readonly RepoLanguageBytes[]): LanguageStat[] {
  const stats = new Map<string, { bytes: number; repos: number; bigSomewhere: boolean }>();
  for (const repo of perRepo) {
    const total = Object.values(repo).reduce((sum, bytes) => sum + bytes, 0);
    if (total <= 0) continue;
    for (const [language, bytes] of Object.entries(repo)) {
      if (IGNORED_LANGUAGES.has(language) || bytes <= 0) continue;
      const s = stats.get(language) ?? { bytes: 0, repos: 0, bigSomewhere: false };
      s.bytes += bytes;
      s.repos += 1;
      if (bytes / total >= MIN_REPO_SHARE) s.bigSomewhere = true;
      stats.set(language, s);
    }
  }
  return [...stats.entries()]
    .filter(([, s]) => s.bigSomewhere || s.repos >= 2)
    .map(([language, s]) => ({ language, bytes: s.bytes, repos: s.repos }))
    .sort((a, b) => b.bytes - a.bytes || a.language.localeCompare(b.language));
}

/** Topic -> number of repos tagged with it (each repo counted once per topic). */
export function countTopics(repos: readonly RepoSummary[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const repo of repos) {
    for (const topic of new Set(repo.topics.map((t) => t.toLowerCase()))) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }
  return counts;
}

export type GithubSkill = {
  slug: string;
  level: GithubSkillLevel;
  bytes?: number;
  repos: number;
  via: ("language" | "topic")[];
};

export function githubSkillLevels({
  languages,
  topics,
}: {
  languages: readonly (LanguageStat & { slug: string })[];
  topics: readonly { slug: string; repos: number }[];
}): GithubSkill[] {
  const totalBytes = languages.reduce((sum, l) => sum + l.bytes, 0);
  const topBytes = Math.max(0, ...languages.map((l) => l.bytes));
  const bySlug = new Map<string, GithubSkill>();

  function merge(next: GithubSkill) {
    const prev = bySlug.get(next.slug);
    if (!prev) {
      bySlug.set(next.slug, next);
      return;
    }
    prev.level = Math.max(prev.level, next.level) as GithubSkillLevel;
    if (next.bytes !== undefined) prev.bytes = (prev.bytes ?? 0) + next.bytes;
    prev.repos = Math.max(prev.repos, next.repos);
    for (const via of next.via) if (!prev.via.includes(via)) prev.via.push(via);
  }

  for (const l of languages) {
    const share = totalBytes > 0 ? l.bytes / totalBytes : 0;
    const level: GithubSkillLevel =
      l.bytes === topBytes || share >= 0.25 ? 4 : share >= 0.05 || l.repos >= 3 ? 3 : 2;
    merge({ slug: l.slug, level, bytes: l.bytes, repos: l.repos, via: ["language"] });
  }
  for (const t of topics) {
    merge({ slug: t.slug, level: t.repos >= 2 ? 3 : 2, repos: t.repos, via: ["topic"] });
  }

  return [...bySlug.values()].sort(
    (a, b) => b.level - a.level || (b.bytes ?? 0) - (a.bytes ?? 0) || b.repos - a.repos || a.slug.localeCompare(b.slug),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/github-skills.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite the scanning half of `lib/github.ts`**

In `lib/github.ts`:

1. Replace `import { mapGithubLanguageToSkill, type SkillSlug } from "@/lib/skills";` with:
   ```ts
   import {
     countTopics,
     githubSkillLevels,
     qualifyLanguages,
     recentRepos,
     type GithubSkill,
     type RepoLanguageBytes,
     type RepoSummary,
   } from "@/lib/github-skills";
   import { findInCatalog } from "@/lib/skill-catalog-core";
   import { getCatalog, resolveGithubLanguage } from "@/lib/skill-catalog";
   ```
2. Delete everything from `const MAX_REPOS_SCANNED = 100;` to the end of the file: `fetchPublicRepoLanguages`, `deriveSkillsFromLanguages` and the old `GithubEvidencePayload`. Append:

```ts
const MAX_REPOS_LISTED = 100;
const LANGUAGE_FETCH_CONCURRENCY = 5;

// The user's own (non-fork) public repos. Forks are excluded so a forked
// repo doesn't misrepresent the user's own work. `topics` comes back in
// this listing for free.
export async function fetchOwnedRepos(username: string, accessToken: string): Promise<RepoSummary[]> {
  const url = new URL(`https://api.github.com/users/${encodeURIComponent(username)}/repos`);
  url.searchParams.set("per_page", String(MAX_REPOS_LISTED));
  url.searchParams.set("type", "owner");
  url.searchParams.set("sort", "pushed");

  const res = await fetch(url, { headers: githubApiHeaders(accessToken) });
  if (!res.ok) {
    throw new Error(`GitHub repo listing failed with status ${res.status}`);
  }
  const repos = (await res.json()) as { name: string; fork: boolean; pushed_at: string | null; topics?: string[] }[];
  return repos
    .filter((r) => !r.fork)
    .map((r) => ({ name: r.name, pushedAt: r.pushed_at ?? "", topics: r.topics ?? [] }));
}

/** Bytes of code per language in one repo (every language, not just the primary one). */
export async function fetchRepoLanguages(owner: string, repo: string, accessToken: string): Promise<RepoLanguageBytes> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`;
  const res = await fetch(url, { headers: githubApiHeaders(accessToken) });
  if (!res.ok) {
    throw new Error(`GitHub languages for ${repo} failed with status ${res.status}`);
  }
  return (await res.json()) as RepoLanguageBytes;
}

// Runs fn over items, `limit` at a time. A failure skips that item (null)
// instead of failing the whole scan -- one private-turned or rate-limited
// repo shouldn't block connecting GitHub.
async function mapSettled<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i]);
      } catch (err) {
        console.error("GitHub scan skipped a repo:", err);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Languages (by bytes, across the 30 most recently pushed repos) and topics
 * (across all owned repos) -> scored skills. Languages may add catalog
 * entries (resolveGithubLanguage); topics only count when they match one.
 */
export async function scanGithubSkills(
  username: string,
  accessToken: string,
): Promise<{ skills: GithubSkill[]; reposScanned: number }> {
  const repos = await fetchOwnedRepos(username, accessToken);
  const recent = recentRepos(repos);
  const perRepo = (
    await mapSettled(recent, LANGUAGE_FETCH_CONCURRENCY, (r) => fetchRepoLanguages(username, r.name, accessToken))
  ).filter((bytes): bytes is RepoLanguageBytes => bytes !== null);

  const languages: (ReturnType<typeof qualifyLanguages>[number] & { slug: string })[] = [];
  for (const stat of qualifyLanguages(perRepo)) {
    const skill = await resolveGithubLanguage(stat.language);
    languages.push({ ...stat, slug: skill.slug });
  }

  const catalog = await getCatalog();
  const topics: { slug: string; repos: number }[] = [];
  for (const [topic, count] of countTopics(repos)) {
    const skill = findInCatalog(catalog, topic);
    if (skill) topics.push({ slug: skill.slug, repos: count });
  }

  return { skills: githubSkillLevels({ languages, topics }), reposScanned: recent.length };
}

// EvidenceRecord.payload shape for source: "GITHUB" (spec 4.1). v1 payloads
// (languages: slug[]) are still read by lib/skill-grid.ts.
export type GithubEvidencePayload = {
  version: 2;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  verified: true;
  connectedAt: string;
  reposScanned: number;
  skills: GithubSkill[];
};
```

- [ ] **Step 6: Update the OAuth callback**

In `app/api/github/callback/route.ts`:

1. Delete `import { mergeSkillRatings, parseSkillRatings } from "@/lib/skills";`.
2. In the `@/lib/github` import list, replace `deriveSkillsFromLanguages,` and `fetchPublicRepoLanguages,` with `scanGithubSkills,`.
3. In the header comment, change "pulls public repo languages" to "scans public repo languages and topics".
4. Replace the body of the `try { … }` block up to (not including) `return finish("connected", …)` with:

```ts
    const accessToken = await exchangeCodeForToken(code);
    const githubUser = await fetchGithubUser(accessToken);
    const { skills, reposScanned } = await scanGithubSkills(githubUser.login, accessToken);

    const payload: GithubEvidencePayload = {
      version: 2,
      username: githubUser.login,
      name: githubUser.name,
      avatarUrl: githubUser.avatarUrl,
      verified: true,
      connectedAt: new Date().toISOString(),
      reposScanned,
      skills,
    };

    // Detected skills are evidence and picker suggestions only -- they no
    // longer touch self-ratings, so there's no read-merge-write race left.
    const record = await prisma.$transaction(async (tx) => {
      // Replace rather than accumulate -- one connected GitHub account per
      // user (also clears out the old unverified-URL placeholder record).
      await tx.evidenceRecord.deleteMany({ where: { userId, source: "GITHUB" } });
      const created = await tx.evidenceRecord.create({ data: { userId, source: "GITHUB", payload } });
      await tx.profile.upsert({
        where: { userId },
        create: { userId, githubUsername: githubUser.login },
        update: { githubUsername: githubUser.login },
      });
      return created;
    });
```

- [ ] **Step 7: Update GitHub copy and the repo count field**

In `app/(protected)/dashboard/page.tsx`, replace the two GitHub `SourceNote` strings with:

```tsx
                      ? `${grid.github.skillCount} ${grid.github.skillCount === 1 ? "skill" : "skills"} from @${grid.github.username}'s public repos.`
                      : `Connected as @${grid.github.username}. No skills detected in the public repos yet.`
```

In `app/(protected)/profile/page.tsx`:

1. Change `const githubPayload = githubRecord?.payload as { repoCount?: number } | undefined;` to:
   ```ts
   const githubPayload = githubRecord?.payload as { repoCount?: number; reposScanned?: number } | undefined;
   const reposScanned = githubPayload?.reposScanned ?? githubPayload?.repoCount;
   ```
2. Replace the two lines that use `githubPayload?.repoCount` / `githubPayload.repoCount` with:
   ```tsx
                     {typeof reposScanned === "number" &&
                       ` · ${reposScanned} ${reposScanned === 1 ? "repo" : "repos"} scanned`}
   ```
3. Change `"Connect GitHub and the languages in your own repositories count as evidence."` to `"Connect GitHub and the languages and topics in your own repositories count as evidence."`.

In `app/onboarding/steps/GithubStep.tsx`, change `"Optional. Connecting pulls your public repo languages in as evidence."` to `"Optional. Connecting pulls your public repo languages and topics in as evidence."`. Change `"Your repo languages will show up as evidence on your grid."` to `"Skills from your repos will show up as evidence on your grid."`.

- [ ] **Step 8: Run tests, typecheck and lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass.

- [ ] **Step 9: Manual check (ask the user if you can't complete GitHub OAuth)**

From `/profile`, connect a GitHub account that has repos in a language outside the old list (e.g. Kotlin or Shell).
- The profile shows "N repos scanned · M skills matched".
- The grid's GitHub column includes that language.
- `/profile/skills` lists it under "Found in your evidence".

- [ ] **Step 10: Commit**

```bash
git add lib/github-skills.ts lib/github.ts app/api/github/callback/route.ts "app/(protected)/dashboard/page.tsx" "app/(protected)/profile/page.tsx" app/onboarding/steps/GithubStep.tsx tests/github-skills.test.ts
git commit -m "Detect skills from every GitHub repo language and topic" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Admin review of skill reports

**Files:**
- Create: `lib/admin-emails.ts`
- Create: `lib/admin.ts`
- Create: `lib/skill-review-core.ts`
- Create: `lib/skill-review.ts`
- Create: `app/admin/layout.tsx`
- Create: `app/admin/skill-requests/page.tsx`
- Create: `app/admin/skill-requests/actions.ts`
- Create: `app/admin/skill-requests/ReviewGroupCard.tsx`
- Modify: `.env.example`
- Test: `tests/admin.test.ts`, `tests/skill-review-core.test.ts`

**Interfaces:**
- Consumes: `validateSkillName`, `skillKey`, `toSlug` (Task 1); `computeKeys`, `isSkillCategory`, `SKILL_CATEGORIES`, `SKILL_CATEGORY_TAGS`, `suggestSimilarIn`, `SkillSearchResult` (Tasks 2–3); `getCatalog`, `invalidateCatalog`, `isUniqueViolation`, `Db` (Task 3).
- Produces:
  - `lib/admin-emails.ts` (pure): `isAdminEmail(email, list): boolean`.
  - `lib/admin.ts`: `getAdminUser(): Promise<{ id: string; email: string } | null>`.
  - `lib/skill-review-core.ts`:
    - `type RequestRow`, `type ReviewGroup`
    - `groupRequests(rows): ReviewGroup[]`
    - `pickDisplayName(group): string`
    - `type ApprovalInput`, `type ParsedApproval`
    - `parseApproval(input)`
  - `lib/skill-review.ts`:
    - `type QueueGroup` (serialisable)
    - `listReviewQueue(): Promise<QueueGroup[]>`
    - `type ReviewResult = { ok: true; message: string } | { ok: false; error: string }`
    - `approveGroup(key, input): Promise<ReviewResult>`
    - `mergeGroup(key, targetSlug, addAlias): Promise<ReviewResult>`
    - `rejectGroup(key): Promise<ReviewResult>`

- [ ] **Step 1: Write the failing tests**

Create `tests/admin.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { isAdminEmail } from "@/lib/admin-emails";

describe("isAdminEmail", () => {
  const LIST = " Admin@Thapar.edu , second@thapar.edu,,";

  it("matches case-insensitively and ignores spacing and blanks", () => {
    expect(isAdminEmail("admin@thapar.edu", LIST)).toBe(true);
    expect(isAdminEmail("SECOND@thapar.edu", LIST)).toBe(true);
  });

  it("rejects everyone else, and everyone when unset", () => {
    expect(isAdminEmail("student@thapar.edu", LIST)).toBe(false);
    expect(isAdminEmail("", LIST)).toBe(false);
    expect(isAdminEmail(null, LIST)).toBe(false);
    expect(isAdminEmail("admin@thapar.edu", undefined)).toBe(false);
  });
});
```

Create `tests/skill-review-core.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { groupRequests, parseApproval, pickDisplayName, type RequestRow } from "@/lib/skill-review-core";

const at = (day: number) => new Date(Date.UTC(2026, 9, day));

const ROWS: RequestRow[] = [
  { id: "1", userId: "u1", rawName: "SvelteKit", key: "sveltekit", note: "https://kit.svelte.dev", createdAt: at(3) },
  { id: "2", userId: "u2", rawName: "Svelte Kit", key: "sveltekit", note: null, createdAt: at(1) },
  { id: "3", userId: "u3", rawName: "SvelteKit", key: "sveltekit", note: null, createdAt: at(2) },
  { id: "4", userId: "u1", rawName: "Hono", key: "hono", note: null, createdAt: at(4) },
];

describe("groupRequests", () => {
  it("groups by key, most reporters first, spellings by frequency", () => {
    const [svelte, hono] = groupRequests(ROWS);
    expect(svelte).toMatchObject({
      key: "sveltekit",
      reporters: 3,
      spellings: [
        { rawName: "SvelteKit", count: 2 },
        { rawName: "Svelte Kit", count: 1 },
      ],
      notes: ["https://kit.svelte.dev"],
      oldest: at(1),
      requestIds: ["1", "2", "3"],
    });
    expect(hono.key).toBe("hono");
    expect(pickDisplayName(svelte)).toBe("SvelteKit");
  });
});

describe("parseApproval", () => {
  it("accepts a clean approval and splits aliases", () => {
    expect(
      parseApproval({ name: "SvelteKit", slug: "sveltekit", category: "FRAMEWORK", aliases: "Svelte Kit, , Kit", strictMatch: false }),
    ).toEqual({
      ok: true,
      value: { name: "SvelteKit", slug: "sveltekit", category: "FRAMEWORK", aliases: ["Svelte Kit", "Kit"], strictMatch: false },
    });
  });

  it.each([
    [{ name: "", slug: "x", category: "TOOL", aliases: "", strictMatch: false }],
    [{ name: "X", slug: "Bad Slug", category: "TOOL", aliases: "", strictMatch: false }],
    [{ name: "X", slug: "x", category: "NOPE", aliases: "", strictMatch: false }],
    [{ name: "X", slug: "x", category: "TOOL", aliases: "https://x.dev", strictMatch: false }],
  ])("rejects %j", (input) => {
    expect(parseApproval(input).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/admin.test.ts tests/skill-review-core.test.ts`
Expected: FAIL, the modules don't exist.

- [ ] **Step 3: Create `lib/admin-emails.ts` and `lib/admin.ts`**

Create `lib/admin-emails.ts` (kept apart from `lib/admin.ts` so tests don't load NextAuth):

```ts
// Admins are listed in ADMIN_EMAILS (comma-separated) rather than a roles
// table -- a handful of maintainers, managed in the Vercel env settings.
export function isAdminEmail(email: string | null | undefined, list: string | undefined): boolean {
  if (!email || !list) return false;
  const admins = list
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}
```

Create `lib/admin.ts`:

```ts
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin-emails";

/** The signed-in admin, or null. Every admin page and action checks this itself. */
export async function getAdminUser(): Promise<{ id: string; email: string } | null> {
  const session = await auth();
  const id = session?.user?.id;
  const email = session?.user?.email;
  if (!id || !email || !isAdminEmail(email, process.env.ADMIN_EMAILS)) return null;
  return { id, email };
}
```

- [ ] **Step 4: Create `lib/skill-review-core.ts`**

```ts
// Pure helpers for the admin review queue (spec 3.2).

import { isSkillCategory, type SkillCategoryName } from "@/lib/skill-catalog-core";
import { validateSkillName } from "@/lib/skill-normalize";

export type RequestRow = {
  id: string;
  userId: string;
  rawName: string;
  key: string;
  note: string | null;
  createdAt: Date;
};

export type ReviewGroup = {
  key: string;
  spellings: { rawName: string; count: number }[];
  reporters: number;
  notes: string[];
  oldest: Date;
  requestIds: string[];
};

/** Pending reports grouped by normalised key -- ten people reporting "SvelteKit" is one decision. */
export function groupRequests(rows: readonly RequestRow[]): ReviewGroup[] {
  const groups = new Map<string, RequestRow[]>();
  for (const row of rows) groups.set(row.key, [...(groups.get(row.key) ?? []), row]);

  return [...groups.entries()]
    .map(([key, items]) => {
      const counts = new Map<string, number>();
      for (const item of items) counts.set(item.rawName, (counts.get(item.rawName) ?? 0) + 1);
      return {
        key,
        spellings: [...counts.entries()]
          .map(([rawName, count]) => ({ rawName, count }))
          .sort((a, b) => b.count - a.count || a.rawName.localeCompare(b.rawName)),
        reporters: new Set(items.map((i) => i.userId)).size,
        notes: items.flatMap((i) => (i.note ? [i.note] : [])),
        oldest: new Date(Math.min(...items.map((i) => i.createdAt.getTime()))),
        requestIds: items.map((i) => i.id).sort(),
      };
    })
    .sort((a, b) => b.reporters - a.reporters || a.oldest.getTime() - b.oldest.getTime());
}

/** The most common spelling -- the default name when approving, and the alias when merging. */
export function pickDisplayName(group: Pick<ReviewGroup, "spellings">): string {
  return group.spellings[0]?.rawName ?? "";
}

export type ApprovalInput = { name: string; slug: string; category: string; aliases: string; strictMatch: boolean };
export type ParsedApproval = {
  name: string;
  slug: string;
  category: SkillCategoryName;
  aliases: string[];
  strictMatch: boolean;
};

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function parseApproval(input: ApprovalInput): { ok: true; value: ParsedApproval } | { ok: false; error: string } {
  const name = validateSkillName(input.name);
  if (!name.ok) return { ok: false, error: `Name: ${name.reason}` };
  const slug = input.slug.trim();
  if (!SLUG_PATTERN.test(slug)) {
    return { ok: false, error: "Slug must be lowercase letters and digits separated by single hyphens." };
  }
  if (!isSkillCategory(input.category)) return { ok: false, error: "Pick a category." };

  const aliases: string[] = [];
  for (const raw of input.aliases.split(",")) {
    if (!raw.trim()) continue;
    const alias = validateSkillName(raw);
    if (!alias.ok) return { ok: false, error: `Alias "${raw.trim()}": ${alias.reason}` };
    if (!aliases.includes(alias.name)) aliases.push(alias.name);
  }

  return { ok: true, value: { name: name.name, slug, category: input.category, aliases, strictMatch: input.strictMatch } };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/admin.test.ts tests/skill-review-core.test.ts`
Expected: PASS.

- [ ] **Step 6: Create `lib/skill-review.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { getCatalog, invalidateCatalog, isUniqueViolation, type Db } from "@/lib/skill-catalog";
import { computeKeys, suggestSimilarIn, type SkillSearchResult } from "@/lib/skill-catalog-core";
import { skillKey } from "@/lib/skill-normalize";
import { groupRequests, parseApproval, pickDisplayName, type ApprovalInput } from "@/lib/skill-review-core";

// Admin side of skill reports (spec 3.2). Each decision is one
// transaction that re-reads the still-pending rows, so a double-click or
// two admins acting at once resolve each report exactly once.

export type QueueGroup = {
  key: string;
  displayName: string;
  spellings: { rawName: string; count: number }[];
  reporters: number;
  notes: string[];
  oldest: string;
  similar: SkillSearchResult[];
};

export async function listReviewQueue(): Promise<QueueGroup[]> {
  const rows = await prisma.skillRequest.findMany({
    where: { status: "PENDING" },
    select: { id: true, userId: true, rawName: true, key: true, note: true, createdAt: true },
  });
  const catalog = await getCatalog();
  return groupRequests(rows).map((g) => ({
    key: g.key,
    displayName: pickDisplayName(g),
    spellings: g.spellings,
    reporters: g.reporters,
    notes: g.notes,
    oldest: g.oldest.toISOString(),
    similar: suggestSimilarIn(catalog, g.key, 3),
  }));
}

export type ReviewResult = { ok: true; message: string } | { ok: false; error: string };

const NOTHING_PENDING: ReviewResult = { ok: true, message: "Nothing pending for this skill any more." };

function people(n: number) {
  return `${n} ${n === 1 ? "person" : "people"}`;
}

// Marks a group's pending reports resolved and gives every reporter the
// skill at the level they asked for (skipping anyone who already has it).
async function resolveGroup(db: Db, key: string, status: "APPROVED" | "MERGED", skillId: string): Promise<number> {
  const pending = await db.skillRequest.findMany({
    where: { key, status: "PENDING" },
    select: { id: true, userId: true, requestedLevel: true },
  });
  if (pending.length === 0) return 0;
  await db.skillRequest.updateMany({
    where: { id: { in: pending.map((p) => p.id) } },
    data: { status, resolvedSkillId: skillId, reviewedAt: new Date() },
  });
  await db.userSkill.createMany({
    data: pending.map((p) => ({ userId: p.userId, skillId, level: p.requestedLevel })),
    skipDuplicates: true,
  });
  return new Set(pending.map((p) => p.userId)).size;
}

export async function approveGroup(key: string, input: ApprovalInput): Promise<ReviewResult> {
  const parsed = parseApproval(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const { name, slug, category, aliases, strictMatch } = parsed.value;
  const keys = [...new Set([...computeKeys(slug, name, aliases), key])];

  try {
    const result = await prisma.$transaction(async (tx): Promise<ReviewResult> => {
      if ((await tx.skillRequest.count({ where: { key, status: "PENDING" } })) === 0) return NOTHING_PENDING;
      if (await tx.skill.findUnique({ where: { slug }, select: { id: true } })) {
        return { ok: false, error: `The slug "${slug}" is taken. Use Merge into instead.` };
      }
      const clash = await tx.skill.findFirst({ where: { keys: { hasSome: keys } }, select: { name: true } });
      if (clash) return { ok: false, error: `This overlaps with "${clash.name}". Use Merge into instead.` };

      const skill = await tx.skill.create({
        data: { slug, name, aliases, keys, category, strictMatch, origin: "REQUESTED" },
        select: { id: true },
      });
      const n = await resolveGroup(tx, key, "APPROVED", skill.id);
      return { ok: true, message: `Added ${name} for ${people(n)}.` };
    });
    if (result.ok) invalidateCatalog();
    return result;
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "That skill was just created. Use Merge into instead." };
    console.error("approveGroup failed:", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function mergeGroup(key: string, targetSlug: string, addAlias: boolean): Promise<ReviewResult> {
  try {
    const result = await prisma.$transaction(async (tx): Promise<ReviewResult> => {
      const pending = await tx.skillRequest.findMany({
        where: { key, status: "PENDING" },
        select: { userId: true, rawName: true, key: true, note: true, id: true, createdAt: true },
      });
      if (pending.length === 0) return NOTHING_PENDING;
      const target = await tx.skill.findUnique({
        where: { slug: targetSlug.trim() },
        select: { id: true, name: true, aliases: true, keys: true },
      });
      if (!target) return { ok: false, error: `No skill with the slug "${targetSlug.trim()}".` };

      if (addAlias) {
        const alias = pickDisplayName(groupRequests(pending)[0]);
        const aliasKey = skillKey(alias);
        const owner = await tx.skill.findFirst({
          where: { keys: { has: aliasKey }, NOT: { id: target.id } },
          select: { name: true },
        });
        if (owner) return { ok: false, error: `"${alias}" already belongs to ${owner.name}. Merge without the alias.` };
        if (!target.keys.includes(aliasKey)) {
          await tx.skill.update({
            where: { id: target.id },
            data: { aliases: [...target.aliases, alias], keys: [...target.keys, aliasKey] },
          });
        }
      }

      const n = await resolveGroup(tx, key, "MERGED", target.id);
      return { ok: true, message: `Merged into ${target.name} for ${people(n)}.` };
    });
    if (result.ok) invalidateCatalog();
    return result;
  } catch (err) {
    console.error("mergeGroup failed:", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function rejectGroup(key: string): Promise<ReviewResult> {
  const { count } = await prisma.skillRequest.updateMany({
    where: { key, status: "PENDING" },
    data: { status: "REJECTED", reviewedAt: new Date() },
  });
  return count === 0 ? NOTHING_PENDING : { ok: true, message: `Rejected ${count} ${count === 1 ? "report" : "reports"}.` };
}
```

- [ ] **Step 7: Create the admin layout**

Create `app/admin/layout.tsx`:

```tsx
import { notFound } from "next/navigation";

import { getAdminUser } from "@/lib/admin";

// Admin pages 404 for everyone not in ADMIN_EMAILS -- not a redirect, so
// the route's existence isn't advertised.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await getAdminUser())) notFound();
  return <div className="bg-graph flex min-h-full flex-1 flex-col">{children}</div>;
}
```

- [ ] **Step 8: Create the admin actions**

Create `app/admin/skill-requests/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/admin";
import { approveGroup, mergeGroup, rejectGroup, type ReviewResult } from "@/lib/skill-review";

export type ReviewActionState = { ok: boolean; message: string } | null;

function toState(result: ReviewResult): ReviewActionState {
  revalidatePath("/admin/skill-requests");
  return result.ok ? { ok: true, message: result.message } : { ok: false, message: result.error };
}

const NOT_ALLOWED: ReviewActionState = { ok: false, message: "Not allowed." };

export async function approveAction(_prev: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  if (!(await getAdminUser())) return NOT_ALLOWED;
  return toState(
    await approveGroup(String(formData.get("key") ?? ""), {
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      category: String(formData.get("category") ?? ""),
      aliases: String(formData.get("aliases") ?? ""),
      strictMatch: formData.get("strictMatch") === "on",
    }),
  );
}

export async function mergeAction(_prev: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  if (!(await getAdminUser())) return NOT_ALLOWED;
  return toState(
    await mergeGroup(
      String(formData.get("key") ?? ""),
      String(formData.get("target") ?? ""),
      formData.get("addAlias") === "on",
    ),
  );
}

export async function rejectAction(_prev: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  if (!(await getAdminUser())) return NOT_ALLOWED;
  return toState(await rejectGroup(String(formData.get("key") ?? "")));
}
```

- [ ] **Step 9: Create the review card**

Create `app/admin/skill-requests/ReviewGroupCard.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";

import { Pill, PrimaryButton, SecondaryButton } from "@/app/ui/primitives";
import { SKILL_CATEGORIES, SKILL_CATEGORY_TAGS } from "@/lib/skill-catalog-core";
import { toSlug } from "@/lib/skill-normalize";
import type { QueueGroup } from "@/lib/skill-review";

import { approveAction, mergeAction, rejectAction, type ReviewActionState } from "./actions";

const inputClass =
  "rounded-theme-sm border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/25";

export function ReviewGroupCard({ group }: { group: QueueGroup }) {
  const [approveState, approve, approving] = useActionState<ReviewActionState, FormData>(approveAction, null);
  const [mergeState, merge, merging] = useActionState<ReviewActionState, FormData>(mergeAction, null);
  const [rejectState, reject, rejecting] = useActionState<ReviewActionState, FormData>(rejectAction, null);
  const [target, setTarget] = useState(group.similar[0]?.slug ?? "");
  const state = approveState ?? mergeState ?? rejectState;
  const otherSpellings = group.spellings.slice(1).map((s) => s.rawName).join(", ");

  return (
    <article className="rounded-theme-lg border border-border bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
        <h2 className="text-lg font-semibold text-ink">{group.displayName}</h2>
        <p className="font-mono text-xs text-ink-muted">
          {group.reporters} {group.reporters === 1 ? "reporter" : "reporters"} · since{" "}
          {new Date(group.oldest).toLocaleDateString()}
        </p>
      </header>

      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="flex flex-wrap gap-1.5">
          {group.spellings.map((s) => (
            <Pill key={s.rawName}>
              {s.rawName} ×{s.count}
            </Pill>
          ))}
        </div>
        {group.notes.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-ink-muted">
            {group.notes.map((note, i) => (
              <li key={i} className="break-words">
                {note}
              </li>
            ))}
          </ul>
        )}

        {state && (
          <p role="status" className={`text-sm ${state.ok ? "text-trust-strong" : "text-danger"}`}>
            {state.message}
          </p>
        )}

        <form action={approve} className="flex flex-col gap-2 rounded-theme-md border border-border p-3">
          <input type="hidden" name="key" value={group.key} />
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">Approve as a new skill</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium">
              Name
              <input name="name" defaultValue={group.displayName} className={inputClass} required />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Slug
              <input name="slug" defaultValue={toSlug(group.displayName)} className={inputClass} required />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Category
              <select name="category" defaultValue="OTHER" className={inputClass}>
                {SKILL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {SKILL_CATEGORY_TAGS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Aliases (comma-separated)
              <input name="aliases" defaultValue={otherSpellings} className={inputClass} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="strictMatch" />
            Case-sensitive resume matching (the name is an ordinary word or very short)
          </label>
          <PrimaryButton type="submit" disabled={approving} className="self-start">
            {approving ? "Approving…" : "Approve"}
          </PrimaryButton>
        </form>

        <form action={merge} className="flex flex-col gap-2 rounded-theme-md border border-border p-3">
          <input type="hidden" name="key" value={group.key} />
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">Merge into an existing skill</p>
          {group.similar.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
              Closest:
              {group.similar.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => setTarget(s.slug)}
                  className="rounded-theme-sm border border-border-strong px-2 py-0.5 font-medium text-ink hover:border-ink"
                >
                  {s.name} ({s.slug})
                </button>
              ))}
            </div>
          )}
          <label className="flex flex-col gap-1 text-xs font-medium">
            Target skill slug
            <input name="target" value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass} required />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="addAlias" defaultChecked />
            Also add &ldquo;{group.displayName}&rdquo; as an alias
          </label>
          <SecondaryButton type="submit" disabled={merging} className="self-start">
            {merging ? "Merging…" : "Merge"}
          </SecondaryButton>
        </form>

        <form action={reject}>
          <input type="hidden" name="key" value={group.key} />
          <button
            type="submit"
            disabled={rejecting}
            className="rounded-theme-sm text-xs font-semibold text-danger underline underline-offset-4 disabled:opacity-40"
          >
            {rejecting ? "Rejecting…" : "Reject all reports for this skill"}
          </button>
        </form>
      </div>
    </article>
  );
}
```

- [ ] **Step 10: Create the admin page**

Create `app/admin/skill-requests/page.tsx`:

```tsx
import type { Metadata } from "next";

import { Empty, Eyebrow } from "@/app/ui/primitives";
import { listReviewQueue } from "@/lib/skill-review";

import { ReviewGroupCard } from "./ReviewGroupCard";

export const metadata: Metadata = {
  title: "SkillGrid – Skill reports",
};

// Access is enforced by app/admin/layout.tsx (404 for non-admins) and
// re-checked in every action.
export default async function SkillRequestsPage() {
  const groups = await listReviewQueue();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header>
        <Eyebrow>Admin</Eyebrow>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">Skill reports</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {groups.length} {groups.length === 1 ? "skill" : "skills"} waiting for review. Approving or merging adds the
          skill to everyone who reported it.
        </p>
      </header>
      {groups.length === 0 ? (
        <Empty message="Nothing to review." />
      ) : (
        <ul className="flex flex-col gap-4">
          {groups.map((group) => (
            <li key={group.key}>
              <ReviewGroupCard group={group} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 11: Document the env var**

Append to `.env.example`:

```bash

# Comma-separated emails allowed into /admin (skill report review). Leave
# empty and the admin pages 404 for everyone.
ADMIN_EMAILS=""
```

- [ ] **Step 12: Run tests, typecheck and lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass.

- [ ] **Step 13: Manual check (ask the user; it needs two accounts or a test report)**

Set `ADMIN_EMAILS` in `.env` to your own email and restart `npm run dev`.
- As any user, report `SvelteKit` from `/profile/skills`.
- At `/admin/skill-requests`, the group shows. Approve it with category Framework. The reporter's `/profile/skills` now lists SvelteKit at the level they chose, and searching "svelte kit" finds it.
- Report `Raect` and merge into `react` with the alias. The report resolves, and searching "raect" now finds React.
- Report another skill and reject it. The reporter sees "Not added" and can dismiss it.
- Click Approve twice quickly on one group. The second shows "Nothing pending…".
- Remove your email from `ADMIN_EMAILS`, restart: `/admin/skill-requests` returns 404.

- [ ] **Step 14: Commit**

```bash
git add lib/admin-emails.ts lib/admin.ts lib/skill-review-core.ts lib/skill-review.ts app/admin .env.example tests/admin.test.ts tests/skill-review-core.test.ts
git commit -m "Add the admin review queue for reported skills" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Remove the old fixed list

**Files:**
- Modify: `lib/skills.ts` (strip legacy exports)
- Modify: `lib/onboarding-options.ts` (stale comment)
- Modify: `prisma/schema.prisma` (mark `skillRatings` deprecated; it is **not** dropped in this branch)

**Interfaces:**
- Produces: final `lib/skills.ts` exports: `SKILL_RATING_LEVELS`, `SkillRatingLevel`, `SKILL_RATING_LABELS`, `isSkillRatingLevel`, `DEFAULT_SKILL_LEVEL`, `UserSkillEntry`.

Why the column stays: `prisma migrate deploy` applies every pending migration at once. If this branch also dropped `profiles."skillRatings"`, there would be no point on production where `prisma/scripts/verify-skill-migration.ts` could confirm the copy before the old data is gone. Nothing reads or writes the column after this task, so dropping it is a one-line follow-up once production is verified (Step 7).

- [ ] **Step 1: Confirm nothing still uses the legacy exports**

Run:

```bash
grep -rnE "SKILLS|SkillSlug|isSkillSlug|skillLabel|SkillRatings|parseSkillRatings|mergeSkillRatings|SKILL_KEYWORDS|mapGithubLanguageToSkill|skillRatings" app lib --include=*.ts --include=*.tsx
```

Expected: matches only inside `lib/skills.ts` itself. Fix any other match first by moving it to the new APIs from Tasks 4–9.

- [ ] **Step 2: Replace `lib/skills.ts`**

```ts
// Per-skill comfort ratings. The skills themselves live in the database
// catalog (Skill model, lib/skill-catalog.ts) -- this file holds only the
// rating scale and the shape a user's rated skill takes in the UI.

export const SKILL_RATING_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export type SkillRatingLevel = (typeof SKILL_RATING_LEVELS)[number];

// Distinct wording from the old profile-wide ComfortLevel labels -- the
// per-skill selector reads "Just starting / Comfortable / Confident".
export const SKILL_RATING_LABELS: Record<SkillRatingLevel, string> = {
  BEGINNER: "Just starting",
  INTERMEDIATE: "Comfortable",
  ADVANCED: "Confident",
};

export function isSkillRatingLevel(value: string): value is SkillRatingLevel {
  return (SKILL_RATING_LEVELS as readonly string[]).includes(value);
}

// A newly added skill starts at "Comfortable" -- the user chose to add it,
// so it isn't a cold start, and one click on the rating changes it.
export const DEFAULT_SKILL_LEVEL: SkillRatingLevel = "INTERMEDIATE";

/** One of the user's self-rated skills, as the UI shows it (from the UserSkill table). */
export type UserSkillEntry = { slug: string; name: string; level: SkillRatingLevel };
```

- [ ] **Step 3: Fix the stale comment**

In `lib/onboarding-options.ts`, change the comment line `// Per-skill comfort ratings (lib/skills.ts SkillRatings) replaced the old` to `// Per-skill comfort ratings (UserSkill rows; lib/user-skills.ts) replaced the old`.

- [ ] **Step 4: Mark the column deprecated**

In `prisma/schema.prisma`, replace the comment block above `skillRatings Json @default("{}")` in `model Profile` with:

```prisma
  // DEPRECATED -- copied into user_skills by the open_skill_catalog
  // migration and no longer read or written. Drop it once
  // prisma/scripts/verify-skill-migration.ts has passed on production.
```

Run: `npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid". No migration is needed (only a comment changed).

- [ ] **Step 5: Full verification**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass; `next build` completes.

- [ ] **Step 6: Commit**

```bash
git add lib/skills.ts lib/onboarding-options.ts prisma/schema.prisma
git commit -m "Remove the fixed skill list now that skills live in the catalog" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Hand the user the deployment checklist**

Report to the user (do not run these against production yourself):
1. On the production database, in order:
   - `npx prisma migrate deploy`
   - `npx prisma db seed`
   - `npx tsx prisma/scripts/verify-skill-migration.ts` (must print `OK`)
2. Set `ADMIN_EMAILS` in the Vercel project's environment variables.
3. Run the manual checks from Tasks 6, 7, 9 and 10 on the preview deployment.
4. Follow-up, once step 1 printed `OK` on production:
   - Delete the `skillRatings` field from `model Profile`.
   - Run `npx prisma migrate dev --name drop_profile_skill_ratings`.
   - Delete `prisma/scripts/verify-skill-migration.ts`.
   - Commit, then `npx prisma migrate deploy` on production.
