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
