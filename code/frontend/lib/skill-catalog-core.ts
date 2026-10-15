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
