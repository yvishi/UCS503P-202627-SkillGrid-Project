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
