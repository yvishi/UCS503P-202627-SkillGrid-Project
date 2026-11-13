import type { GithubEvidenceSkill } from "@/lib/skill-grid";
import type { UserSkillEntry } from "@/lib/skills";

/** Points each evidence source contributes at full strength. Sums to 100. */
export const SOURCE_WEIGHTS = { github: 45, peers: 25, resume: 20, self: 10 } as const;

type GridLevel = 0 | 2 | 3 | 4;

export type SkillEvidence = {
  slug: string;
  self: GridLevel;
  resume: boolean;
  github: GridLevel;
  peers: GridLevel;
};

const SELF_LEVEL: Record<UserSkillEntry["level"], GridLevel> = {
  BEGINNER: 2,
  INTERMEDIATE: 3,
  ADVANCED: 4,
};

/** Weighted evidence score, integer 0..100. Only the final sum is rounded. */
export function skillScore(e: SkillEvidence): number {
  const sum =
    SOURCE_WEIGHTS.github * (e.github / 4) +
    SOURCE_WEIGHTS.peers * (e.peers / 4) +
    SOURCE_WEIGHTS.resume * (e.resume ? 1 : 0) +
    SOURCE_WEIGHTS.self * (e.self / 4);
  return Math.round(sum);
}

/** Rounded mean of the top 5 skill scores, zero-padded when fewer than 5. */
export function profileScore(scores: readonly number[]): number {
  const top = [...scores].sort((a, b) => b - a).slice(0, 5);
  return Math.round(top.reduce((a, b) => a + b, 0) / 5);
}

/** One entry per slug across all sources, ordered by slug. */
export function collectEvidence(input: {
  userSkills: readonly UserSkillEntry[];
  resumeSkills: readonly string[];
  githubSkills: readonly GithubEvidenceSkill[];
  peerSkills: readonly GithubEvidenceSkill[];
}): SkillEvidence[] {
  const map = new Map<string, SkillEvidence>();
  const get = (slug: string) => {
    let e = map.get(slug);
    if (!e) {
      e = { slug, self: 0, resume: false, github: 0, peers: 0 };
      map.set(slug, e);
    }
    return e;
  };
  for (const s of input.userSkills) get(s.slug).self = SELF_LEVEL[s.level];
  for (const slug of input.resumeSkills) get(slug).resume = true;
  for (const s of input.githubSkills) get(s.slug).github = s.level;
  for (const s of input.peerSkills) get(s.slug).peers = s.level;
  return [...map.values()].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}
