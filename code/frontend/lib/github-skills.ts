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
