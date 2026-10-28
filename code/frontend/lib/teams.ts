import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { findSkillByText, isUniqueViolation } from "@/lib/skill-catalog";
import {
  canAccept,
  canInvite,
  canRequest,
  canCreateTeam,
  hackathonPhase,
  nextLead,
  type HackathonPhase,
  type RuleResult,
} from "@/lib/team-rules";

// DB layer for teams and participation. The decisions live in lib/team-rules.ts;
// this module loads the facts, asks the rules, and writes inside transactions.
// Every function takes the acting user's id first; callers get it from auth().

export const MAX_LOOKING_FOR = 5;
const NAME_MIN = 2;
const NAME_MAX = 60;
const DESCRIPTION_MAX = 500;

const ALREADY_IN_TEAM = "You're already in a team for this hackathon.";
const NO_HACKATHON = "That hackathon doesn't exist.";
const NO_TEAM = "That team no longer exists.";
const ENDED = "This hackathon has ended.";

const fail = (error: string) => ({ ok: false as const, error });

type Tx = Prisma.TransactionClient;

const isOver = (endsAt: Date) => Date.now() >= endsAt.getTime();

/**
 * Locks the team row until the transaction ends, so membership changes to one team
 * (accept, leave) run one at a time. Returns null when the team is gone.
 */
async function lockTeam(tx: Tx, teamId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM teams WHERE id = ${teamId} FOR UPDATE`;
  if (rows.length === 0) return null;
  return tx.team.findUnique({
    where: { id: teamId },
    select: { id: true, hackathonId: true, hackathon: { select: { endsAt: true, teamSizeMax: true } } },
  });
}

/** Resolves free-text skills against the catalog: unknown text is dropped, duplicates removed, at most 5 kept. */
export async function resolveLookingFor(texts: readonly string[]): Promise<string[]> {
  const slugs: string[] = [];
  for (const text of texts) {
    if (slugs.length >= MAX_LOOKING_FOR) break;
    const skill = await findSkillByText(text);
    if (skill && !slugs.includes(skill.slug)) slugs.push(skill.slug);
  }
  return slugs;
}

export async function createTeam(
  userId: string,
  hackathonId: string,
  input: { name: string; description?: string; lookingFor: string[] },
): Promise<{ ok: true; teamId: string } | { ok: false; error: string }> {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    return fail(`The team name must be ${NAME_MIN} to ${NAME_MAX} characters.`);
  }
  const description = input.description?.trim() || null;
  if (description && description.length > DESCRIPTION_MAX) {
    return fail(`The description can be at most ${DESCRIPTION_MAX} characters.`);
  }
  const lookingFor = await resolveLookingFor(input.lookingFor);

  try {
    return await prisma.$transaction(async (tx) => {
      const hackathon = await tx.hackathon.findUnique({ where: { id: hackathonId }, select: { id: true, endsAt: true } });
      if (!hackathon) return fail(NO_HACKATHON);
      const existing = await tx.teamMember.findUnique({
        where: { hackathonId_userId: { hackathonId: hackathon.id, userId } },
        select: { teamId: true },
      });
      const rule = canCreateTeam({ now: new Date(), endsAt: hackathon.endsAt, alreadyInTeam: existing !== null });
      if (!rule.ok) return rule;
      const clash = await tx.team.findFirst({
        where: { hackathonId: hackathon.id, name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
      if (clash) return fail("A team with that name already exists in this hackathon.");

      const team = await tx.team.create({
        data: { hackathonId: hackathon.id, name, description, lookingFor, createdById: userId },
        select: { id: true, hackathonId: true },
      });
      // hackathonId comes from the team row just written, never from the caller.
      await tx.teamMember.create({ data: { teamId: team.id, userId, hackathonId: team.hackathonId, role: "LEAD" } });
      await tx.participation.upsert({
        where: { hackathonId_userId: { hackathonId: team.hackathonId, userId } },
        create: { hackathonId: team.hackathonId, userId, lookingForTeam: false },
        update: { lookingForTeam: false },
      });
      // Requests and invites elsewhere in this hackathon can no longer be accepted.
      await tx.teamInvite.updateMany({
        where: { hackathonId: team.hackathonId, userId, status: "PENDING" },
        data: { status: "CANCELLED", respondedAt: new Date() },
      });
      return { ok: true as const, teamId: team.id };
    });
  } catch (err) {
    // A concurrent create by the same user, or the same name, lost the race on a unique index.
    if (isUniqueViolation(err)) {
      const target = JSON.stringify((err as Prisma.PrismaClientKnownRequestError).meta?.target ?? "");
      return fail(target.includes("name") ? "A team with that name already exists in this hackathon." : ALREADY_IN_TEAM);
    }
    throw err;
  }
}

export async function setLookingForTeam(userId: string, hackathonId: string, looking: boolean): Promise<RuleResult> {
  const hackathon = await prisma.hackathon.findUnique({ where: { id: hackathonId }, select: { id: true, endsAt: true } });
  if (!hackathon) return fail(NO_HACKATHON);
  if (isOver(hackathon.endsAt)) return fail(ENDED);
  if (looking) {
    const member = await prisma.teamMember.findUnique({
      where: { hackathonId_userId: { hackathonId: hackathon.id, userId } },
      select: { teamId: true },
    });
    if (member) return fail(ALREADY_IN_TEAM);
  }
  await prisma.participation.upsert({
    where: { hackathonId_userId: { hackathonId: hackathon.id, userId } },
    create: { hackathonId: hackathon.id, userId, lookingForTeam: looking },
    update: { lookingForTeam: looking },
  });
  return { ok: true };
}

/**
 * Removes the user from the team. If the lead leaves, the earliest-joined remaining member
 * becomes lead; if the last member leaves, the team (and its invites) is deleted.
 * Refused once the hackathon has ended, so the team stays fixed for peer feedback.
 */
export async function leaveTeam(userId: string, teamId: string): Promise<RuleResult> {
  return prisma.$transaction(async (tx) => {
    const team = await lockTeam(tx, teamId);
    if (!team) return fail(NO_TEAM);
    if (isOver(team.hackathon.endsAt)) return fail(ENDED);
    const members = await tx.teamMember.findMany({
      where: { teamId },
      select: { userId: true, role: true, joinedAt: true },
    });
    if (!members.some((m) => m.userId === userId)) return fail("You're not in this team.");

    const lead = nextLead(members, userId);
    if (lead === null) {
      await tx.team.delete({ where: { id: teamId } });
      return { ok: true };
    }
    await tx.teamMember.delete({ where: { teamId_userId: { teamId, userId } } });
    if (members.find((m) => m.userId === lead)?.role !== "LEAD") {
      await tx.teamMember.update({ where: { teamId_userId: { teamId, userId: lead } }, data: { role: "LEAD" } });
    }
    return { ok: true };
  });
}

/**
 * Accepts a PENDING invite or request inside the caller's transaction: rechecks the rules,
 * adds the joiner (invite.userId) as a MEMBER, marks the invite ACCEPTED, cancels the joiner's
 * other PENDING invites and requests in the hackathon, and sets lookingForTeam=false.
 *
 * It cannot know who the actor is: the caller (B.4) decides `actorMayRespond` and must check it.
 *
 * Race safety: the team row is locked with SELECT ... FOR UPDATE before the size is counted, so two
 * accepts for the last slot are serialized and the second sees the first's member. Use it in a
 * default (READ COMMITTED) transaction, where each statement after the lock sees committed rows.
 * The one-team-per-hackathon unique index is enforced with ON CONFLICT DO NOTHING: a thrown P2002
 * would abort the caller's whole Postgres transaction, so a conflict is reported as a RuleResult.
 */
export async function acceptInTransaction(tx: Tx, inviteId: string, actorMayRespond: boolean): Promise<RuleResult> {
  const first = await tx.teamInvite.findUnique({ where: { id: inviteId }, select: { teamId: true } });
  if (!first) return fail("That invite no longer exists.");
  const team = await lockTeam(tx, first.teamId);
  if (!team) return fail(NO_TEAM);

  // Re-read after the lock: another transaction may have answered it while we waited.
  const invite = await tx.teamInvite.findUnique({ where: { id: inviteId }, select: { userId: true, status: true } });
  if (!invite) return fail("That invite no longer exists.");
  const [size, joinerRow] = await Promise.all([
    tx.teamMember.count({ where: { teamId: team.id } }),
    tx.teamMember.findUnique({
      where: { hackathonId_userId: { hackathonId: team.hackathonId, userId: invite.userId } },
      select: { teamId: true },
    }),
  ]);
  if (invite.status !== "PENDING") {
    // Usually cancelled because the joiner just joined another team; say that rather than "answered".
    return fail(joinerRow ? ALREADY_IN_TEAM : "This invite is no longer open.");
  }
  const rule = canAccept({
    now: new Date(),
    team: { size, max: team.hackathon.teamSizeMax, endsAt: team.hackathon.endsAt },
    joinerInTeam: joinerRow !== null,
    actorMayRespond,
  });
  if (!rule.ok) return rule;

  // hackathonId comes from the locked team row, never from the invite or the client.
  const inserted = await tx.$executeRaw`
    INSERT INTO team_members ("teamId", "userId", "hackathonId", "role", "joinedAt")
    VALUES (${team.id}, ${invite.userId}, ${team.hackathonId}, 'MEMBER'::"TeamRole", NOW() AT TIME ZONE 'UTC')
    ON CONFLICT DO NOTHING`;
  if (inserted === 0) return fail(ALREADY_IN_TEAM);

  const now = new Date();
  await tx.teamInvite.update({ where: { id: inviteId }, data: { status: "ACCEPTED", respondedAt: now } });
  await tx.teamInvite.updateMany({
    where: { hackathonId: team.hackathonId, userId: invite.userId, status: "PENDING", id: { not: inviteId } },
    data: { status: "CANCELLED", respondedAt: now },
  });
  await tx.participation.upsert({
    where: { hackathonId_userId: { hackathonId: team.hackathonId, userId: invite.userId } },
    create: { hackathonId: team.hackathonId, userId: invite.userId, lookingForTeam: false },
    update: { lookingForTeam: false },
  });
  return { ok: true };
}

const HACKATHON_SELECT = {
  id: true,
  slug: true,
  name: true,
  startsAt: true,
  endsAt: true,
  teamSizeMin: true,
  teamSizeMax: true,
} as const;

export type HackathonSummary = Prisma.HackathonGetPayload<{ select: typeof HACKATHON_SELECT }> & {
  phase: HackathonPhase;
};

/** Upcoming and running hackathons first (soonest start first), then ended ones (most recent first). */
export async function listHackathons(now = new Date()): Promise<HackathonSummary[]> {
  const rows = await prisma.hackathon.findMany({ select: HACKATHON_SELECT, orderBy: { startsAt: "asc" } });
  const withPhase = rows.map((h) => ({ ...h, phase: hackathonPhase(now, h.startsAt, h.endsAt) }));
  const open = withPhase.filter((h) => h.phase !== "ended");
  const ended = withPhase.filter((h) => h.phase === "ended").sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime());
  return [...open, ...ended];
}

export type TeamMemberView = { userId: string; name: string; image: string | null; role: "LEAD" | "MEMBER" };
export type HackathonView = {
  hackathon: Prisma.HackathonGetPayload<{ select: typeof HACKATHON_SELECT }>;
  myTeam: {
    id: string;
    name: string;
    role: "LEAD" | "MEMBER";
    description: string | null;
    lookingFor: string[];
    members: TeamMemberView[];
  } | null;
  lookingForTeam: boolean;
  phase: HackathonPhase;
};

/** Everything the hackathon page needs for this user, or null when the slug is unknown. */
export async function getHackathonView(userId: string, slug: string): Promise<HackathonView | null> {
  const hackathon = await prisma.hackathon.findUnique({ where: { slug }, select: HACKATHON_SELECT });
  if (!hackathon) return null;

  const [membership, participation] = await Promise.all([
    prisma.teamMember.findUnique({
      where: { hackathonId_userId: { hackathonId: hackathon.id, userId } },
      select: {
        role: true,
        team: {
          select: {
            id: true,
            name: true,
            description: true,
            lookingFor: true,
            members: {
              orderBy: { joinedAt: "asc" },
              select: { userId: true, role: true, user: { select: { name: true, image: true } } },
            },
          },
        },
      },
    }),
    prisma.participation.findUnique({
      where: { hackathonId_userId: { hackathonId: hackathon.id, userId } },
      select: { lookingForTeam: true },
    }),
  ]);

  const myTeam = membership
    ? {
        id: membership.team.id,
        name: membership.team.name,
        role: membership.role,
        description: membership.team.description,
        lookingFor: membership.team.lookingFor,
        members: membership.team.members.map((m) => ({
          userId: m.userId,
          name: m.user.name ?? "SkillGrid member",
          image: m.user.image,
          role: m.role,
        })),
      }
    : null;

  return {
    hackathon,
    myTeam,
    lookingForTeam: participation?.lookingForTeam ?? false,
    phase: hackathonPhase(new Date(), hackathon.startsAt, hackathon.endsAt),
  };
}

// ---------------------------------------------------------------------------
// Invitations and join requests (B.4)
//
// A TeamInvite row is always about the person who would join (`userId`).
//   INVITE:  the lead asked userId to join. Only userId accepts or declines.
//   REQUEST: userId asked to join.          Only the team's current lead accepts or declines.
// Only the creator (`createdById`) may cancel a PENDING row.

const NOT_OPEN = "This invite is no longer open.";
const NO_INVITE = "That invite no longer exists.";
const CANT_RESPOND = "You can't respond to this one.";

type Db = Tx | typeof prisma;
type InviteFacts = { kind: "INVITE" | "REQUEST"; userId: string; teamId: string };

async function isOnboarded(db: Db, userId: string): Promise<boolean> {
  const profile = await db.profile.findUnique({ where: { userId }, select: { onboardingCompletedAt: true } });
  return profile?.onboardingCompletedAt != null;
}

async function isLead(db: Db, teamId: string, userId: string): Promise<boolean> {
  const row = await db.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } }, select: { role: true } });
  return row?.role === "LEAD";
}

/** INVITE: only the invitee may answer. REQUEST: only the team's current lead may answer. */
async function mayRespond(db: Db, invite: InviteFacts, actorId: string): Promise<boolean> {
  if (invite.kind === "INVITE") return invite.userId === actorId;
  return isLead(db, invite.teamId, actorId);
}

/** Any PENDING row for (team, user), of either kind. */
async function pendingFor(db: Db, teamId: string, userId: string): Promise<boolean> {
  const row = await db.teamInvite.findFirst({ where: { teamId, userId, status: "PENDING" }, select: { id: true } });
  return row !== null;
}

/**
 * The team's lead invites `targetId`. The team row is locked so two invites (or an invite and a
 * request) for the same person cannot both pass the "one pending row" check.
 */
export async function inviteToTeam(actorId: string, teamId: string, targetId: string): Promise<RuleResult> {
  return prisma.$transaction(async (tx) => {
    const team = await lockTeam(tx, teamId);
    if (!team) return fail(NO_TEAM);
    const [size, actorIsLead, targetRow, pendingExists] = await Promise.all([
      tx.teamMember.count({ where: { teamId: team.id } }),
      isLead(tx, team.id, actorId),
      tx.teamMember.findUnique({
        where: { hackathonId_userId: { hackathonId: team.hackathonId, userId: targetId } },
        select: { teamId: true },
      }),
      pendingFor(tx, team.id, targetId),
    ]);
    const rule = canInvite({
      now: new Date(),
      team: { size, max: team.hackathon.teamSizeMax, endsAt: team.hackathon.endsAt },
      actorIsLead,
      targetInTeam: targetRow !== null,
      pendingExists,
      targetIsSelf: targetId === actorId,
    });
    if (!rule.ok) return rule;
    if (!(await isOnboarded(tx, targetId))) {
      return fail("You can only invite people who have finished setting up their profile.");
    }
    await tx.teamInvite.create({
      data: { teamId: team.id, hackathonId: team.hackathonId, userId: targetId, kind: "INVITE", createdById: actorId },
    });
    return { ok: true };
  });
}

/** The user asks to join the team. Locked for the same reason as inviteToTeam. */
export async function requestToJoin(userId: string, teamId: string): Promise<RuleResult> {
  return prisma.$transaction(async (tx) => {
    const team = await lockTeam(tx, teamId);
    if (!team) return fail(NO_TEAM);
    const [size, ownRow, pendingExists] = await Promise.all([
      tx.teamMember.count({ where: { teamId: team.id } }),
      tx.teamMember.findUnique({
        where: { hackathonId_userId: { hackathonId: team.hackathonId, userId } },
        select: { teamId: true },
      }),
      pendingFor(tx, team.id, userId),
    ]);
    const rule = canRequest({
      now: new Date(),
      team: { size, max: team.hackathon.teamSizeMax, endsAt: team.hackathon.endsAt },
      alreadyInTeam: ownRow !== null,
      pendingExists,
    });
    if (!rule.ok) return rule;
    if (!(await isOnboarded(tx, userId))) {
      return fail("Finish setting up your profile before asking to join a team.");
    }
    await tx.teamInvite.create({
      data: { teamId: team.id, hackathonId: team.hackathonId, userId, kind: "REQUEST", createdById: userId },
    });
    return { ok: true };
  });
}

/**
 * Accepts as `actorId`. The team row is locked before the lead is read, so a lead hand-over
 * (leaveTeam takes the same lock) cannot change who may answer a REQUEST mid-accept.
 * acceptInTransaction takes the lock again (a no-op in the same transaction) and rechecks the rules.
 */
export async function acceptInvite(actorId: string, inviteId: string): Promise<RuleResult> {
  return prisma.$transaction(async (tx) => {
    const invite = await tx.teamInvite.findUnique({
      where: { id: inviteId },
      select: { kind: true, userId: true, teamId: true },
    });
    if (!invite) return fail(NO_INVITE);
    if (!(await lockTeam(tx, invite.teamId))) return fail(NO_TEAM);
    const actorMayRespond = await mayRespond(tx, invite, actorId);
    return acceptInTransaction(tx, inviteId, actorMayRespond);
  });
}

export async function declineInvite(actorId: string, inviteId: string): Promise<RuleResult> {
  const invite = await prisma.teamInvite.findUnique({
    where: { id: inviteId },
    select: { kind: true, userId: true, teamId: true },
  });
  if (!invite) return fail(NO_INVITE);
  if (!(await mayRespond(prisma, invite, actorId))) return fail(CANT_RESPOND);
  // Conditional update: if it was answered or cancelled meanwhile, nothing changes.
  const { count } = await prisma.teamInvite.updateMany({
    where: { id: inviteId, status: "PENDING" },
    data: { status: "DECLINED", respondedAt: new Date() },
  });
  return count === 1 ? { ok: true } : fail(NOT_OPEN);
}

export async function cancelInvite(actorId: string, inviteId: string): Promise<RuleResult> {
  const invite = await prisma.teamInvite.findUnique({ where: { id: inviteId }, select: { createdById: true } });
  if (!invite) return fail(NO_INVITE);
  if (invite.createdById !== actorId) return fail("Only the person who sent this can cancel it.");
  const { count } = await prisma.teamInvite.updateMany({
    where: { id: inviteId, createdById: actorId, status: "PENDING" },
    data: { status: "CANCELLED", respondedAt: new Date() },
  });
  return count === 1 ? { ok: true } : fail(NOT_OPEN);
}

/** Slug of the hackathon a team belongs to, for revalidatePath. Null when the team is gone. */
export async function hackathonSlugForTeam(teamId: string): Promise<string | null> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { hackathon: { select: { slug: true } } } });
  return team?.hackathon.slug ?? null;
}

/** Slug of the hackathon an invite belongs to, for revalidatePath. Null when the invite is gone. */
export async function hackathonSlugForInvite(inviteId: string): Promise<string | null> {
  const invite = await prisma.teamInvite.findUnique({
    where: { id: inviteId },
    select: { hackathon: { select: { slug: true } } },
  });
  return invite?.hackathon.slug ?? null;
}

/** Things waiting on this user: INVITEs to them, plus REQUESTs to teams they lead. */
export async function countPendingForUser(userId: string): Promise<number> {
  return prisma.teamInvite.count({
    where: {
      status: "PENDING",
      OR: [
        { kind: "INVITE", userId },
        { kind: "REQUEST", team: { members: { some: { userId, role: "LEAD" } } } },
      ],
    },
  });
}

/** Teams this user leads in hackathons that have not ended, for the "Invite to…" team choice. */
export async function myLeadTeams(userId: string): Promise<{ id: string; name: string; hackathonName: string }[]> {
  const rows = await prisma.teamMember.findMany({
    where: { userId, role: "LEAD", hackathon: { endsAt: { gt: new Date() } } },
    orderBy: { joinedAt: "asc" },
    select: { team: { select: { id: true, name: true } }, hackathon: { select: { name: true } } },
  });
  return rows.map((r) => ({ id: r.team.id, name: r.team.name, hackathonName: r.hackathon.name }));
}

export type InviteListRow = {
  id: string;
  kind: "INVITE" | "REQUEST";
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  teamName: string;
  hackathonName: string;
  hackathonSlug: string;
  otherName: string; // a display name, never an email
};

const SENT_HISTORY = 20;
const FALLBACK_NAME = "SkillGrid member";

const INVITE_LIST_SELECT = {
  id: true,
  kind: true,
  status: true,
  createdById: true,
  user: { select: { name: true } },
  hackathon: { select: { name: true, slug: true } },
  team: {
    select: {
      name: true,
      members: { where: { role: "LEAD" }, select: { user: { select: { name: true } } } },
    },
  },
} satisfies Prisma.TeamInviteSelect;

type InviteListPayload = Prisma.TeamInviteGetPayload<{ select: typeof INVITE_LIST_SELECT }>;

function toListRow(i: InviteListPayload, otherName: string | null | undefined): InviteListRow {
  return {
    id: i.id,
    kind: i.kind,
    status: i.status,
    teamName: i.team.name,
    hackathonName: i.hackathon.name,
    hackathonSlug: i.hackathon.slug,
    otherName: otherName || FALLBACK_NAME,
  };
}

/**
 * Everything the /invites page shows for this user:
 * - `toMe`: pending INVITEs to the user (other person: whoever sent it)
 * - `toMyTeams`: pending REQUESTs to teams the user leads (other person: the requester)
 * - `sent`: invites and requests the user sent, pending first, then the latest answered ones
 *   (other person: the invitee for an INVITE, the team's current lead for a REQUEST)
 */
export async function listInvitesForUser(
  userId: string,
): Promise<{ toMe: InviteListRow[]; toMyTeams: InviteListRow[]; sent: InviteListRow[] }> {
  const [toMe, toMyTeams, sent] = await Promise.all([
    prisma.teamInvite.findMany({
      where: { status: "PENDING", kind: "INVITE", userId },
      orderBy: { createdAt: "desc" },
      select: INVITE_LIST_SELECT,
    }),
    prisma.teamInvite.findMany({
      where: { status: "PENDING", kind: "REQUEST", team: { members: { some: { userId, role: "LEAD" } } } },
      orderBy: { createdAt: "desc" },
      select: INVITE_LIST_SELECT,
    }),
    prisma.teamInvite.findMany({
      where: { createdById: userId },
      // PENDING is first in the enum, so pending rows come first, each group newest first.
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: SENT_HISTORY,
      select: INVITE_LIST_SELECT,
    }),
  ]);

  // The sender of an INVITE may have left the team since, so look senders up by id.
  const senderIds = [...new Set(toMe.map((i) => i.createdById))];
  const senders = await prisma.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, name: true } });
  const senderName = new Map(senders.map((u) => [u.id, u.name]));

  return {
    toMe: toMe.map((i) => toListRow(i, senderName.get(i.createdById))),
    toMyTeams: toMyTeams.map((i) => toListRow(i, i.user.name)),
    sent: sent.map((i) => toListRow(i, i.kind === "INVITE" ? i.user.name : i.team.members[0]?.user.name)),
  };
}
