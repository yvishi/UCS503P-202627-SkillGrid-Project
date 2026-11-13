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
