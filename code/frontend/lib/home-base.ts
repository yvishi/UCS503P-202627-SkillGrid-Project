import { feedbackWindow } from "@/lib/peer-feedback-core";
import { prisma } from "@/lib/prisma";
import { listInvitesForUser } from "@/lib/teams";

// Data for the dashboard once the getting-started guide has ended: what is
// waiting on this user, and the hackathons they are part of.

export type NeedsYouItem = { key: string; title: string; detail: string; href: string; action: string };

/**
 * Things waiting on this user: invites to them, join requests to teams
 * they lead, and feedback due. Feedback is due when a hackathon they were
 * on a team in has ended, its feedback window is open, they had at least
 * one teammate, and they have given none for it yet.
 */
export async function getNeedsYou(userId: string, now = new Date()): Promise<NeedsYouItem[]> {
  const [invites, endedMemberships, given] = await Promise.all([
    listInvitesForUser(userId),
    prisma.teamMember.findMany({
      where: { userId, hackathon: { endsAt: { lte: now } } },
      orderBy: { hackathon: { endsAt: "desc" } },
      select: {
        hackathon: { select: { id: true, slug: true, name: true, endsAt: true } },
        team: { select: { _count: { select: { members: true } } } },
      },
    }),
    prisma.peerFeedback.findMany({
      where: { fromUserId: userId },
      distinct: ["hackathonId"],
      select: { hackathonId: true },
    }),
  ]);
  const givenFor = new Set(given.map((g) => g.hackathonId));

  const feedbackDue = endedMemberships.filter(
    (m) =>
      feedbackWindow(m.hackathon.endsAt, now) === "open" &&
      m.team._count.members > 1 &&
      !givenFor.has(m.hackathon.id),
  );

  return [
    ...invites.toMe.map((i) => ({
      key: `invite-${i.id}`,
      title: `${i.teamName} invited you`,
      detail: i.hackathonName,
      href: "/invites",
      action: "Answer",
    })),
    ...invites.toMyTeams.map((i) => ({
      key: `request-${i.id}`,
      title: `${i.otherName} asked to join ${i.teamName}`,
      detail: i.hackathonName,
      href: "/invites",
      action: "Review",
    })),
    ...feedbackDue.map((m) => {
      const mates = m.team._count.members - 1;
      return {
        key: `feedback-${m.hackathon.id}`,
        title: `Feedback due for ${mates} ${mates === 1 ? "teammate" : "teammates"}`,
        detail: `${m.hackathon.name} has ended`,
        href: `/hackathons/${m.hackathon.slug}/feedback`,
        action: "Give feedback",
      };
    }),
  ];
}

export type MyHackathon = { slug: string; name: string; startsAt: Date; endsAt: Date; status: string };

const MY_HACKATHON_SELECT = {
  id: true,
  slug: true,
  name: true,
  startsAt: true,
  endsAt: true,
  teamSizeMax: true,
} as const;

function summary(h: { slug: string; name: string; startsAt: Date; endsAt: Date }) {
  return { slug: h.slug, name: h.name, startsAt: h.startsAt, endsAt: h.endsAt };
}

/** Hackathons this user has joined (or has a team in) that have not ended, soonest first. */
export async function getMyHackathons(userId: string, now = new Date()): Promise<MyHackathon[]> {
  const open = { endsAt: { gt: now } };
  const [memberships, participations] = await Promise.all([
    prisma.teamMember.findMany({
      where: { userId, hackathon: open },
      select: {
        hackathon: { select: MY_HACKATHON_SELECT },
        team: { select: { name: true, _count: { select: { members: true } } } },
      },
    }),
    prisma.participation.findMany({
      where: { userId, hackathon: open },
      select: { lookingForTeam: true, hackathon: { select: MY_HACKATHON_SELECT } },
    }),
  ]);

  const byId = new Map<string, MyHackathon>();
  for (const p of participations) {
    byId.set(p.hackathon.id, {
      ...summary(p.hackathon),
      status: p.lookingForTeam ? "You're looking for a team" : "Joined, not looking for a team",
    });
  }
  // A team membership says more than the participation row, so it wins.
  for (const m of memberships) {
    byId.set(m.hackathon.id, {
      ...summary(m.hackathon),
      status: `On ${m.team.name}, ${m.team._count.members} of ${m.hackathon.teamSizeMax}`,
    });
  }
  return [...byId.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
