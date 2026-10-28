// Pure rules and aggregation for post-hackathon peer feedback. No DB access.

import { isSkillRatingLevel, type SkillRatingLevel } from "@/lib/skills";

// Matches RuleResult in lib/team-rules.ts.
export type RuleResult = { ok: true } | { ok: false; error: string };

export const FEEDBACK_WINDOW_DAYS = 14;
export const MAX_SKILLS_PER_TEAMMATE = 5;

const DAY_MS = 24 * 60 * 60 * 1000;
const LEVEL_TO_GRID = { BEGINNER: 2, INTERMEDIATE: 3, ADVANCED: 4 } as const satisfies Record<SkillRatingLevel, 2 | 3 | 4>;

/** The window opens at `endsAt` and closes FEEDBACK_WINDOW_DAYS later. */
export function feedbackWindow(endsAt: Date, now: Date): "not-open" | "open" | "closed" {
  const t = now.getTime();
  const start = endsAt.getTime();
  if (t < start) return "not-open";
  if (t >= start + FEEDBACK_WINDOW_DAYS * DAY_MS) return "closed";
  return "open";
}

export function canGiveFeedback(a: {
  window: ReturnType<typeof feedbackWindow>;
  raterTeamId: string | null;
  targetTeamId: string | null;
  raterId: string;
  targetId: string;
}): RuleResult {
  if (a.raterId === a.targetId) return { ok: false, error: "You can't rate yourself." };
  if (a.window === "not-open") return { ok: false, error: "Feedback opens when the hackathon ends." };
  if (a.window === "closed") return { ok: false, error: "The feedback window for this hackathon has closed." };
  if (!a.raterTeamId || !a.targetTeamId || a.raterTeamId !== a.targetTeamId) {
    return { ok: false, error: "You can only rate your own teammates." };
  }
  return { ok: true };
}

export function parseFeedbackInput(
  input: { toUserId: string; ratings: { slug: string; level: string }[] },
  allowedSlugs: ReadonlySet<string>,
):
  | { ok: true; value: { toUserId: string; ratings: { slug: string; level: SkillRatingLevel }[] } }
  | { ok: false; error: string } {
  if (input.ratings.length === 0) return { ok: false, error: "Rate at least one skill." };
  if (input.ratings.length > MAX_SKILLS_PER_TEAMMATE) {
    return { ok: false, error: `You can rate at most ${MAX_SKILLS_PER_TEAMMATE} skills per teammate.` };
  }
  const seen = new Set<string>();
  const ratings: { slug: string; level: SkillRatingLevel }[] = [];
  for (const { slug, level } of input.ratings) {
    if (!allowedSlugs.has(slug)) return { ok: false, error: "You can only rate skills your teammate has listed." };
    if (!isSkillRatingLevel(level)) return { ok: false, error: "Pick a valid level for each skill." };
    if (seen.has(slug)) return { ok: false, error: "Each skill can be rated only once." };
    seen.add(slug);
    ratings.push({ slug, level });
  }
  return { ok: true, value: { toUserId: input.toUserId, ratings } };
}

/** Per slug (sorted): lower median of the levels (2/3/4) and the number of distinct raters. */
export function aggregatePeerEvidence(
  rows: readonly { slug: string; level: SkillRatingLevel; fromUserId: string }[],
): { version: 1; verified: true; skills: { slug: string; level: 2 | 3 | 4; raters: number }[] } {
  const bySlug = new Map<string, { levels: number[]; raters: Set<string> }>();
  for (const r of rows) {
    const entry = bySlug.get(r.slug) ?? { levels: [], raters: new Set<string>() };
    entry.levels.push(LEVEL_TO_GRID[r.level]);
    entry.raters.add(r.fromUserId);
    bySlug.set(r.slug, entry);
  }
  const skills = [...bySlug.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([slug, { levels, raters }]) => {
      const sorted = [...levels].sort((x, y) => x - y);
      return { slug, level: sorted[Math.floor((sorted.length - 1) / 2)] as 2 | 3 | 4, raters: raters.size };
    });
  return { version: 1, verified: true, skills };
}
