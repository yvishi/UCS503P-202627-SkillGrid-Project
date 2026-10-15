// Per-skill comfort ratings. The skills themselves live in the database
// catalog (Skill model, lib/skill-catalog.ts) -- this file holds only the
// rating scale and the shape a user's rated skill takes in the UI.

export const SKILL_RATING_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export type SkillRatingLevel = (typeof SKILL_RATING_LEVELS)[number];

// Distinct wording from the old profile-wide ComfortLevel labels -- the
// per-skill selector reads "Just starting / Comfortable / Confident".
export const SKILL_RATING_LABELS: Record<SkillRatingLevel, string> = {
  BEGINNER: "Just starting",
  INTERMEDIATE: "Comfortable",
  ADVANCED: "Confident",
};

export function isSkillRatingLevel(value: string): value is SkillRatingLevel {
  return (SKILL_RATING_LEVELS as readonly string[]).includes(value);
}

// A newly added skill starts at "Comfortable" -- the user chose to add it,
// so it isn't a cold start, and one click on the rating changes it.
export const DEFAULT_SKILL_LEVEL: SkillRatingLevel = "INTERMEDIATE";

/** One of the user's self-rated skills, as the UI shows it (from the UserSkill table). */
export type UserSkillEntry = { slug: string; name: string; level: SkillRatingLevel };
