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
