// Derives a user's skills x evidence-sources grid (dashboard and profile)
// from real data only. Nothing here invents evidence: a cell is non-zero
// only when the corresponding record actually names that skill.

import type { CellLevel, GridRow } from "@/app/ui/EvidenceGrid";
import { isSkillSlug, parseSkillRatings, SKILLS, skillLabel, type SkillRatingLevel, type SkillSlug } from "@/lib/skills";

export const SKILL_GRID_COLUMNS = ["Self", "Resume", "GitHub", "Peers"] as const;
export const SKILL_GRID_SELF_COLUMN = 0;

const SELF_LEVEL: Record<SkillRatingLevel, CellLevel> = {
  BEGINNER: 2,
  INTERMEDIATE: 3,
  ADVANCED: 4,
};

// A resume naming a skill is a single document-level mention: "solid" (3).
const RESUME_LEVEL: CellLevel = 3;
// GitHub skills come ranked by how many of the user's own (non-fork) repos
// use that language; the most-used language gets "strong" (4), the rest
// "solid" (3). No per-language counts are stored, so no finer split.
const GITHUB_TOP_LEVEL: CellLevel = 4;
const GITHUB_LEVEL: CellLevel = 3;

/** Skill slugs from a RESUME EvidenceRecord payload (`extractedSkills`). */
export function resumeSkillsFromPayload(payload: unknown): SkillSlug[] {
  const list = (payload as { extractedSkills?: unknown } | null)?.extractedSkills;
  if (!Array.isArray(list)) return [];
  return list.filter((s): s is SkillSlug => typeof s === "string" && isSkillSlug(s));
}

/**
 * Skill slugs (ranked, most-used first) from a GITHUB EvidenceRecord
 * payload. Only a verified OAuth connection counts; the older unverified
 * URL placeholder has no `languages` and yields nothing.
 */
export function githubSkillsFromPayload(payload: unknown): SkillSlug[] {
  const p = payload as { verified?: unknown; languages?: unknown } | null;
  if (p?.verified !== true || !Array.isArray(p.languages)) return [];
  return p.languages.filter((s): s is SkillSlug => typeof s === "string" && isSkillSlug(s));
}

export type SkillGrid = {
  columns: string[];
  selfColumn: number;
  rows: GridRow[];
  /** Skills with at least one non-self (evidence-backed) cell. */
  backedCount: number;
};

export function buildSkillGrid({
  skillRatings,
  resumePayload,
  githubPayload,
}: {
  /** Profile.skillRatings as stored (Prisma Json). */
  skillRatings: unknown;
  /** Payload of the active (or latest) RESUME EvidenceRecord, if any. */
  resumePayload?: unknown;
  /** Payload of the GITHUB EvidenceRecord, if any. */
  githubPayload?: unknown;
}): SkillGrid {
  const self = parseSkillRatings(skillRatings);
  const resume = new Set(resumeSkillsFromPayload(resumePayload));
  const github = githubSkillsFromPayload(githubPayload);

  const rows = SKILLS.map(({ slug }, order) => {
    const level = self[slug];
    const githubRank = github.indexOf(slug);
    const cells: CellLevel[] = [
      level ? SELF_LEVEL[level] : 0,
      resume.has(slug) ? RESUME_LEVEL : 0,
      githubRank === -1 ? 0 : githubRank === 0 ? GITHUB_TOP_LEVEL : GITHUB_LEVEL,
      0, // Peers: peer feedback isn't built yet.
    ];
    const evidence = cells[1] + cells[2] + cells[3];
    return { slug, order, cells, evidence, total: evidence + cells[0] };
  })
    .filter((r) => r.total > 0)
    // Most evidence first, then self-rating, then the fixed list order.
    .sort((a, b) => b.evidence - a.evidence || b.total - a.total || a.order - b.order);

  return {
    columns: [...SKILL_GRID_COLUMNS],
    selfColumn: SKILL_GRID_SELF_COLUMN,
    rows: rows.map((r) => ({ label: skillLabel(r.slug), cells: r.cells })),
    backedCount: rows.filter((r) => r.evidence > 0).length,
  };
}
