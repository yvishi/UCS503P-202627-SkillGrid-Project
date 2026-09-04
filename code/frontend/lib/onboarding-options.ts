// These string values must match the Prisma enums ComfortLevel and
// Availability exactly (see prisma/schema.prisma) -- there is no
// separate mapping layer between form values and DB enum values.

export const COMFORT_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export type ComfortLevelOption = (typeof COMFORT_LEVELS)[number];

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
