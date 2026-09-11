// These string values must match the Prisma enum Availability exactly
// (see prisma/schema.prisma) -- there is no separate mapping layer
// between form values and DB enum values.
//
// Per-skill comfort ratings (lib/skills.ts SkillRatings) replaced the old
// single profile-wide comfort level as of onboarding v2; the Prisma
// `comfortLevel` column is kept for backward compatibility but is no
// longer read or written anywhere in the app.

export const AVAILABILITY_OPTIONS = ["WEEKDAYS", "WEEKENDS", "BOTH", "FLEXIBLE"] as const;
export type AvailabilityOption = (typeof AVAILABILITY_OPTIONS)[number];

// Fixed list, not DB-backed (see spec's Data model changes section).
export const INTEREST_TAGS = [
  "Web Dev",
  "Backend",
  "Frontend",
  "Mobile",
  "Machine Learning",
  "Data Science",
  "DevOps",
  "Cloud",
  "Security",
  "Design (UI/UX)",
  "Game Dev",
  "Blockchain",
  "Embedded/IoT",
  "Product/Business",
] as const;
export type InterestTag = (typeof INTEREST_TAGS)[number];

export function isInterestTag(value: string): value is InterestTag {
  return (INTEREST_TAGS as readonly string[]).includes(value);
}

export function labelize(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export const AVAILABILITY_LABELS: Record<AvailabilityOption, string> = {
  WEEKDAYS: "Weekdays",
  WEEKENDS: "Weekends",
  BOTH: "Weekdays & Weekends",
  FLEXIBLE: "Flexible",
};
