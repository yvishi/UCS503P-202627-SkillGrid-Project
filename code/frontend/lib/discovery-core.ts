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

export type LeadTeamOption = { id: string; name: string; hackathonName: string };

export type InviteChoice =
  | { kind: "no-team" } // the viewer leads no team in an unended hackathon
  | { kind: "done" } // every team they lead already has an open invite or request with this person
  | { kind: "one"; team: LeadTeamOption }
  | { kind: "many"; teams: LeadTeamOption[] };

/**
 * Decides what the Invite control on a teammate card shows, given the teams the viewer leads
 * and the ones that already have a pending row with the person on the card.
 */
export function inviteChoice(
  leadTeams: readonly LeadTeamOption[],
  pendingTeamIds: readonly string[],
): InviteChoice {
  if (leadTeams.length === 0) return { kind: "no-team" };
  const open = leadTeams.filter((t) => !pendingTeamIds.includes(t.id));
  if (open.length === 0) return { kind: "done" };
  if (open.length === 1) return { kind: "one", team: open[0] };
  return { kind: "many", teams: open };
}

export type JoinState = "open" | "requested" | "invited" | "in-hackathon";

/**
 * What the Request to join control on a team card shows. Being in a team for the hackathon wins,
 * since neither a request nor accepting an invite can succeed then.
 */
export function joinState(
  team: { id: string; hackathonSlug: string },
  viewer: {
    memberHackathonSlugs: readonly string[];
    requestedTeamIds: readonly string[];
    invitedTeamIds: readonly string[];
  },
): JoinState {
  if (viewer.memberHackathonSlugs.includes(team.hackathonSlug)) return "in-hackathon";
  if (viewer.invitedTeamIds.includes(team.id)) return "invited";
  if (viewer.requestedTeamIds.includes(team.id)) return "requested";
  return "open";
}
