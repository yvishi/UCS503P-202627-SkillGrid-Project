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
