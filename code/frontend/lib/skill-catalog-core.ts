// Pure catalog types and helpers (spec section 2.3). Shared by the seed
// script (tsx, hence relative imports only), server code, the picker's
// client components and unit tests. Anything that needs Prisma lives in
// lib/skill-catalog.ts instead.

import { editDistance, maxTypoDistance, skillKey } from "./skill-normalize";

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
