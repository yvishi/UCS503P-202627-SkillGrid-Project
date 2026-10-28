import {
  AVAILABILITY_OPTIONS,
  isInterestTag,
  type AvailabilityOption,
  type InterestTag,
} from "@/lib/onboarding-options";

export const PAGE_SIZE = 24;
const MAX_SKILLS = 3;

type Params = Record<string, string | string[] | undefined>;

export type TeammateFilters = {
  skills: string[];
  interest: InterestTag | null;
  availability: AvailabilityOption | null;
  hackathon: string | null;
  page: number;
};

export type TeamFilters = {
  hackathon: string | null;
  skill: string | null;
  page: number;
};

function many(v: string | string[] | undefined): string[] {
  const arr = v === undefined ? [] : Array.isArray(v) ? v : [v];
  return arr.map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0);
}

function first(v: string | string[] | undefined): string | null {
  return many(v)[0] ?? null;
}

function parsePage(v: string | string[] | undefined): number {
  const raw = Array.isArray(v) ? v[0] : v;
  if (raw === undefined || !/^\d+$/.test(raw.trim())) return 1;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 1 ? n : 1;
}

export function parseTeammateFilters(params: Params): TeammateFilters {
  const interestRaw = Array.isArray(params.interest) ? params.interest[0] : params.interest;
  const interest =
    interestRaw !== undefined && isInterestTag(interestRaw) ? interestRaw : null;
  const availRaw = Array.isArray(params.availability)
    ? params.availability[0]
    : params.availability;
  const availability =
    availRaw !== undefined && (AVAILABILITY_OPTIONS as readonly string[]).includes(availRaw)
      ? (availRaw as AvailabilityOption)
      : null;
  return {
    skills: [...new Set(many(params.skill))].slice(0, MAX_SKILLS),
    interest,
    availability,
    hackathon: first(params.hackathon),
    page: parsePage(params.page),
  };
}

export function parseTeamFilters(params: Params): TeamFilters {
  return {
    hackathon: first(params.hackathon),
    skill: first(params.skill),
    page: parsePage(params.page),
  };
}

export function headline(skills: readonly { name: string; score: number }[]): string {
  if (skills.length === 0) return "New to SkillGrid";
  return skills
    .slice(0, 2)
    .map((s) => s.name)
    .join(" · ");
}
