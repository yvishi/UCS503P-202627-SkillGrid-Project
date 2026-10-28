// Pure team rules. No DB or Prisma imports: callers load the facts and pass them in.
//
// When several rules fail at once, every check reports the first failure in this order:
// ended, then permission, then self/membership, then full, then pending.

export type RuleResult = { ok: true } | { ok: false; error: string };
export type TeamState = { size: number; max: number; endsAt: Date };

const OK: RuleResult = { ok: true };
const fail = (error: string): RuleResult => ({ ok: false, error });

const ENDED = "This hackathon has ended.";
const FULL = "This team is full.";
const ALREADY_IN_TEAM = "You're already in a team for this hackathon.";

function hasEnded(now: Date, endsAt: Date): boolean {
  return now.getTime() >= endsAt.getTime();
}

export function canCreateTeam(a: { now: Date; endsAt: Date; alreadyInTeam: boolean }): RuleResult {
  if (hasEnded(a.now, a.endsAt)) return fail(ENDED);
  if (a.alreadyInTeam) return fail(ALREADY_IN_TEAM);
  return OK;
}

export function canInvite(a: {
  now: Date;
  team: TeamState;
  actorIsLead: boolean;
  targetInTeam: boolean;
  pendingExists: boolean;
  targetIsSelf: boolean;
}): RuleResult {
  if (hasEnded(a.now, a.team.endsAt)) return fail(ENDED);
  if (!a.actorIsLead) return fail("Only the team lead can invite people.");
  if (a.targetIsSelf) return fail("You can't invite yourself.");
  if (a.targetInTeam) return fail("That person is already in a team for this hackathon.");
  if (a.team.size >= a.team.max) return fail(FULL);
  if (a.pendingExists) return fail("There is already a pending invite for that person.");
  return OK;
}

export function canRequest(a: {
  now: Date;
  team: TeamState;
  alreadyInTeam: boolean;
  pendingExists: boolean;
}): RuleResult {
  if (hasEnded(a.now, a.team.endsAt)) return fail(ENDED);
  if (a.alreadyInTeam) return fail(ALREADY_IN_TEAM);
  if (a.team.size >= a.team.max) return fail(FULL);
  if (a.pendingExists) return fail("You already have a pending request to this team.");
  return OK;
}

/**
 * `actorMayRespond` is true for an INVITE when the actor is the invitee,
 * and for a REQUEST when the actor is the lead.
 */
export function canAccept(a: {
  now: Date;
  team: TeamState;
  joinerInTeam: boolean;
  actorMayRespond: boolean;
}): RuleResult {
  if (hasEnded(a.now, a.team.endsAt)) return fail(ENDED);
  if (!a.actorMayRespond) return fail("You can't respond to this one.");
  if (a.joinerInTeam) return fail(ALREADY_IN_TEAM);
  if (a.team.size >= a.team.max) return fail(FULL);
  return OK;
}

/**
 * Who leads the team after `leavingUserId` leaves: the current lead if someone else
 * is leaving, otherwise the earliest-joined remaining member. `null` when nobody remains.
 */
export function nextLead(
  members: readonly { userId: string; role: "LEAD" | "MEMBER"; joinedAt: Date }[],
  leavingUserId: string,
): string | null {
  const remaining = members.filter((m) => m.userId !== leavingUserId);
  if (remaining.length === 0) return null;
  const lead = remaining.find((m) => m.role === "LEAD");
  if (lead) return lead.userId;
  const earliest = [...remaining].sort((x, y) => x.joinedAt.getTime() - y.joinedAt.getTime())[0];
  return earliest.userId;
}

export type HackathonPhase = "upcoming" | "running" | "ended";

/** Where `now` falls against the hackathon window. `endsAt` itself counts as ended, as in the rules above. */
export function hackathonPhase(now: Date, startsAt: Date, endsAt: Date): HackathonPhase {
  if (hasEnded(now, endsAt)) return "ended";
  return now.getTime() < startsAt.getTime() ? "upcoming" : "running";
}
