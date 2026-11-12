import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  cancelInviteAction,
  inviteToTeamAction,
  requestToJoinAction,
  respondToInviteAction,
} from "@/app/(protected)/invites/actions";
import { prisma } from "@/lib/prisma";
import { countPendingForUser, createTeam, listInvitesForUser, myLeadTeams } from "@/lib/teams";
import { createUser, resetDb, signInAs } from "./helpers";

beforeEach(async () => {
  await resetDb();
  signInAs(null);
});
afterAll(async () => {
  await prisma.$disconnect();
});

const DAY = 24 * 60 * 60 * 1000;
type U = Awaited<ReturnType<typeof createUser>>;

async function makeHackathon(opts: { teamSizeMax?: number; slug?: string; ended?: boolean } = {}) {
  const admin = await createUser();
  return prisma.hackathon.create({
    data: {
      slug: opts.slug ?? "hack-1",
      name: opts.slug ?? "Hack one",
      startsAt: new Date(Date.now() - 2 * DAY),
      endsAt: new Date(Date.now() + (opts.ended ? -DAY : DAY)),
      teamSizeMax: opts.teamSizeMax ?? 4,
      createdById: admin.id,
    },
  });
}

const user = () => createUser({ onboarded: true });

async function teamOf(lead: U, hackathonId: string, name = "Team") {
  const res = await createTeam(lead.id, hackathonId, { name, lookingFor: [] });
  if (!res.ok) throw new Error(res.error);
  return res.teamId;
}

async function invite(lead: U, teamId: string, target: U) {
  signInAs(lead);
  const res = await inviteToTeamAction(teamId, target.id);
  expect(res).toEqual({ ok: true });
  return prisma.teamInvite.findFirstOrThrow({ where: { teamId, userId: target.id, status: "PENDING" } });
}

async function request(joiner: U, teamId: string) {
  signInAs(joiner);
  const res = await requestToJoinAction(teamId);
  expect(res).toEqual({ ok: true });
  return prisma.teamInvite.findFirstOrThrow({ where: { teamId, userId: joiner.id, status: "PENDING" } });
}

const statusOf = async (id: string) => (await prisma.teamInvite.findUniqueOrThrow({ where: { id } })).status;
const memberOf = (teamId: string, userId: string) =>
  prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });

describe("inviteToTeamAction", () => {
  it("lets the lead invite, recording the actor as creator", async () => {
    const h = await makeHackathon();
    const lead = await user();
    const target = await user();
    const teamId = await teamOf(lead, h.id);

    const row = await invite(lead, teamId, target);
    expect(row).toMatchObject({ kind: "INVITE", createdById: lead.id, hackathonId: h.id, status: "PENDING" });
  });

  it("refuses a non-lead, including a team member who is not the lead", async () => {
    const h = await makeHackathon();
    const lead = await user();
    const member = await user();
    const outsider = await user();
    const target = await user();
    const teamId = await teamOf(lead, h.id);
    const inv = await invite(lead, teamId, member);
    signInAs(member);
    expect(await respondToInviteAction(inv.id, true)).toEqual({ ok: true });

    for (const actor of [member, outsider]) {
      signInAs(actor);
      expect(await inviteToTeamAction(teamId, target.id)).toEqual({
        ok: false,
        error: "Only the team lead can invite people.",
      });
    }
    expect(await prisma.teamInvite.count({ where: { userId: target.id } })).toBe(0);
  });

  it("refuses a duplicate pending invite, and an invite while a request is pending", async () => {
    const h = await makeHackathon();
    const lead = await user();
    const target = await user();
    const requester = await user();
    const teamId = await teamOf(lead, h.id);
    await invite(lead, teamId, target);
    await request(requester, teamId);

    signInAs(lead);
    const dupe = { ok: false, error: "There is already a pending invite for that person." };
    expect(await inviteToTeamAction(teamId, target.id)).toEqual(dupe);
    expect(await inviteToTeamAction(teamId, requester.id)).toEqual(dupe);
    expect(await prisma.teamInvite.count({ where: { teamId, status: "PENDING" } })).toBe(2);
  });

  it("refuses someone who has not finished onboarding, and a signed-out caller", async () => {
    const h = await makeHackathon();
    const lead = await user();
    const fresh = await createUser({ onboarded: false });
    const teamId = await teamOf(lead, h.id);

    signInAs(lead);
    expect(await inviteToTeamAction(teamId, fresh.id)).toEqual({
      ok: false,
      error: "You can only invite people who have finished setting up their profile.",
    });
    expect(await inviteToTeamAction(teamId, "no-such-user")).toMatchObject({ ok: false });
    signInAs(null);
    expect(await inviteToTeamAction(teamId, (await user()).id)).toEqual({ ok: false, error: "Please sign in again." });
    expect(await prisma.teamInvite.count()).toBe(0);
  });

  it("refuses inviting someone already in a team in this hackathon", async () => {
    const h = await makeHackathon();
    const lead = await user();
    const otherLead = await user();
    const teamId = await teamOf(lead, h.id, "One");
    await teamOf(otherLead, h.id, "Two");
    signInAs(lead);
    expect(await inviteToTeamAction(teamId, otherLead.id)).toEqual({
      ok: false,
      error: "That person is already in a team for this hackathon.",
    });
  });
});

describe("respondToInviteAction", () => {
  it("lets the invitee accept and join as MEMBER; the lead cannot accept for them", async () => {
    const h = await makeHackathon();
    const lead = await user();
    const target = await user();
    const teamId = await teamOf(lead, h.id);
    const inv = await invite(lead, teamId, target);

    signInAs(lead);
    expect(await respondToInviteAction(inv.id, true)).toEqual({ ok: false, error: "You can't respond to this one." });
    expect(await memberOf(teamId, target.id)).toBeNull();

    signInAs(target);
    expect(await respondToInviteAction(inv.id, true)).toEqual({ ok: true });
    expect(await memberOf(teamId, target.id)).toMatchObject({ role: "MEMBER", hackathonId: h.id });
    expect(await statusOf(inv.id)).toBe("ACCEPTED");
  });

  it("lets the lead accept a request; the requester cannot accept their own", async () => {
    const h = await makeHackathon();
    const lead = await user();
    const joiner = await user();
    const teamId = await teamOf(lead, h.id);
    const req = await request(joiner, teamId);
    expect(req).toMatchObject({ kind: "REQUEST", createdById: joiner.id });

    signInAs(joiner);
    expect(await respondToInviteAction(req.id, true)).toEqual({ ok: false, error: "You can't respond to this one." });
    expect(await memberOf(teamId, joiner.id)).toBeNull();

    signInAs(lead);
    expect(await respondToInviteAction(req.id, true)).toEqual({ ok: true });
    expect(await memberOf(teamId, joiner.id)).toMatchObject({ role: "MEMBER" });
  });

  it("refuses a decline by the wrong party and lets the right party decline", async () => {
    const h = await makeHackathon();
    const lead = await user();
    const target = await user();
    const joiner = await user();
    const outsider = await user();
    const teamId = await teamOf(lead, h.id);
    const inv = await invite(lead, teamId, target);
    const req = await request(joiner, teamId);
    const denied = { ok: false, error: "You can't respond to this one." };

    for (const actor of [lead, outsider]) {
      signInAs(actor);
      expect(await respondToInviteAction(inv.id, false)).toEqual(denied);
    }
    for (const actor of [joiner, outsider]) {
      signInAs(actor);
      expect(await respondToInviteAction(req.id, false)).toEqual(denied);
    }
    expect(await statusOf(inv.id)).toBe("PENDING");
    expect(await statusOf(req.id)).toBe("PENDING");

    signInAs(target);
    expect(await respondToInviteAction(inv.id, false)).toEqual({ ok: true });
    signInAs(lead);
    expect(await respondToInviteAction(req.id, false)).toEqual({ ok: true });
    const declined = await prisma.teamInvite.findUniqueOrThrow({ where: { id: inv.id } });
    expect(declined.status).toBe("DECLINED");
    expect(declined.respondedAt).not.toBeNull();
    expect(await statusOf(req.id)).toBe("DECLINED");

    // A second answer to the same row is refused.
    signInAs(target);
    expect(await respondToInviteAction(inv.id, true)).toMatchObject({ ok: false });
    expect(await memberOf(teamId, target.id)).toBeNull();
  });

  it("with teamSizeMax 2: B accepts, C's accept fails as full, B's other request is cancelled", async () => {
    const h = await makeHackathon({ teamSizeMax: 2 });
    const lead = await user();
    const b = await user();
    const c = await user();
    const otherLead = await user();
    const teamId = await teamOf(lead, h.id, "One");
    const otherTeam = await teamOf(otherLead, h.id, "Two");

    const invB = await invite(lead, teamId, b);
    const invC = await invite(lead, teamId, c);
    const bRequest = await request(b, otherTeam);

    signInAs(b);
    expect(await respondToInviteAction(invB.id, true)).toEqual({ ok: true });
    signInAs(c);
    expect(await respondToInviteAction(invC.id, true)).toEqual({ ok: false, error: "This team is full." });

    expect(await prisma.teamMember.count({ where: { teamId } })).toBe(2);
    expect(await memberOf(teamId, c.id)).toBeNull();
    expect(await statusOf(invC.id)).toBe("PENDING");
    expect(await statusOf(bRequest.id)).toBe("CANCELLED");

    // B's page shows the cancelled request in "Sent by you".
    const lists = await listInvitesForUser(b.id);
    expect(lists.sent).toEqual([
      expect.objectContaining({ id: bRequest.id, status: "CANCELLED", teamName: "Two", otherName: expect.any(String) }),
    ]);
  });
});

describe("cancelInviteAction", () => {
  it("lets only the creator cancel a pending invite or request", async () => {
    const h = await makeHackathon();
    const lead = await user();
    const target = await user();
    const joiner = await user();
    const teamId = await teamOf(lead, h.id);
    const inv = await invite(lead, teamId, target);
    const req = await request(joiner, teamId);
    const denied = { ok: false, error: "Only the person who sent this can cancel it." };

    signInAs(target);
    expect(await cancelInviteAction(inv.id)).toEqual(denied);
    signInAs(lead);
    expect(await cancelInviteAction(req.id)).toEqual(denied);
    expect(await statusOf(inv.id)).toBe("PENDING");
    expect(await statusOf(req.id)).toBe("PENDING");

    expect(await cancelInviteAction(inv.id)).toEqual({ ok: true });
    signInAs(joiner);
    expect(await cancelInviteAction(req.id)).toEqual({ ok: true });
    expect(await statusOf(inv.id)).toBe("CANCELLED");
    expect(await statusOf(req.id)).toBe("CANCELLED");

    // Cancelling again, or accepting a cancelled invite, is refused.
    signInAs(lead);
    expect(await cancelInviteAction(inv.id)).toEqual({ ok: false, error: "This invite is no longer open." });
    signInAs(target);
    expect(await respondToInviteAction(inv.id, true)).toMatchObject({ ok: false });
  });
});

describe("requestToJoinAction", () => {
  it("refuses a duplicate request, a request while invited, and a member of another team", async () => {
    const h = await makeHackathon();
    const lead = await user();
    const joiner = await user();
    const invited = await user();
    const otherLead = await user();
    const teamId = await teamOf(lead, h.id, "One");
    await teamOf(otherLead, h.id, "Two");
    await request(joiner, teamId);
    await invite(lead, teamId, invited);

    signInAs(joiner);
    const dupe = { ok: false, error: "You already have a pending request to this team." };
    expect(await requestToJoinAction(teamId)).toEqual(dupe);
    signInAs(invited);
    expect(await requestToJoinAction(teamId)).toEqual(dupe);
    signInAs(otherLead);
    expect(await requestToJoinAction(teamId)).toEqual({
      ok: false,
      error: "You're already in a team for this hackathon.",
    });
  });
});

describe("countPendingForUser and myLeadTeams", () => {
  it("counts invites to the user plus requests to teams they lead, and nothing answered", async () => {
    const h = await makeHackathon();
    const h2 = await makeHackathon({ slug: "hack-2" });
    const lead = await user();
    const other = await user();
    const r1 = await user();
    const r2 = await user();
    const myTeam = await teamOf(lead, h.id, "Mine");
    const otherTeam = await teamOf(other, h2.id, "Theirs");

    await request(r1, myTeam);
    const req2 = await request(r2, myTeam);
    await invite(other, otherTeam, lead); // an invite to the lead, in another hackathon
    await invite(other, otherTeam, r1); // not the lead's business

    expect(await countPendingForUser(lead.id)).toBe(3);
    expect(await countPendingForUser(other.id)).toBe(0);
    expect(await countPendingForUser(r1.id)).toBe(1);

    signInAs(lead);
    expect(await respondToInviteAction(req2.id, false)).toEqual({ ok: true });
    expect(await countPendingForUser(lead.id)).toBe(2);

    const lists = await listInvitesForUser(lead.id);
    expect(lists.toMe).toHaveLength(1);
    expect(lists.toMyTeams).toHaveLength(1);
    expect(lists.toMe[0]).toMatchObject({ teamName: "Theirs", hackathonSlug: "hack-2", otherName: other.email.split("@")[0] });
    for (const row of [...lists.toMe, ...lists.toMyTeams, ...lists.sent]) {
      expect(row.otherName).not.toContain("@");
    }
  });

  it("lists only the teams the user leads in hackathons that have not ended", async () => {
    const open = await makeHackathon();
    const ended = await makeHackathon({ slug: "old", ended: true });
    const lead = await user();
    const teamId = await teamOf(lead, open.id, "Open team");
    await prisma.team.create({
      data: {
        hackathonId: ended.id,
        name: "Old team",
        createdById: lead.id,
        members: { create: { userId: lead.id, hackathonId: ended.id, role: "LEAD" } },
      },
    });
    const member = await user();
    const inv = await invite(lead, teamId, member);
    signInAs(member);
    await respondToInviteAction(inv.id, true);

    expect(await myLeadTeams(lead.id)).toEqual([{ id: teamId, name: "Open team", hackathonName: "Hack one" }]);
    expect(await myLeadTeams(member.id)).toEqual([]);
  });
});
