import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  acceptInTransaction,
  createTeam,
  getHackathonView,
  hackathonsWithoutTeam,
  leaveTeam,
  listMyTeams,
  requestToJoin,
  setLookingForTeam,
  setTeamListing,
} from "@/lib/teams";
import { createUser, resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

const DAY = 24 * 60 * 60 * 1000;

async function makeHackathon(opts: { teamSizeMax?: number; slug?: string } = {}) {
  const admin = await createUser();
  return prisma.hackathon.create({
    data: {
      slug: opts.slug ?? "hack-1",
      name: "Hack one",
      startsAt: new Date(Date.now() - DAY),
      endsAt: new Date(Date.now() + DAY),
      teamSizeMax: opts.teamSizeMax ?? 4,
      createdById: admin.id,
    },
  });
}

async function teamOf(userId: string, hackathonId: string, name = "Team") {
  const res = await createTeam(userId, hackathonId, { name, lookingFor: [] });
  if (!res.ok) throw new Error(res.error);
  return res.teamId;
}

async function pendingInvite(teamId: string, hackathonId: string, userId: string, createdById: string) {
  return prisma.teamInvite.create({ data: { teamId, hackathonId, userId, kind: "INVITE", createdById } });
}

async function addMember(teamId: string, hackathonId: string, userId: string, lead: string) {
  const invite = await pendingInvite(teamId, hackathonId, userId, lead);
  const res = await prisma.$transaction((tx) => acceptInTransaction(tx, invite.id, true));
  if (!res.ok) throw new Error(res.error);
}

/**
 * Runs accept(first) and holds its transaction open (uncommitted) until accept(second), in its
 * own transaction, is blocked waiting on a lock. This forces the overlap a plain Promise.all
 * rarely produces. `sawWait` is false if the second never blocked.
 */
async function secondWaitsOnFirst(firstId: string, secondId: string) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let firstDone!: () => void;
  const firstAccepted = new Promise<void>((r) => (firstDone = r));
  const p1 = prisma.$transaction(async (tx) => {
    const r = await acceptInTransaction(tx, firstId, true);
    firstDone();
    await gate;
    return r;
  });
  await firstAccepted;
  const p2 = prisma.$transaction((tx) => acceptInTransaction(tx, secondId, true));
  let sawWait = false;
  for (let i = 0; i < 100 && !sawWait; i++) {
    const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'`;
    sawWait = n > 0;
    if (!sawWait) await new Promise((r) => setTimeout(r, 20));
  }
  release();
  const [r1, r2] = await Promise.all([p1, p2]);
  return { r1, r2, sawWait };
}

describe("createTeam", () => {
  it("creates the team with the creator as lead, catalog-only lookingFor, and participation off", async () => {
    const h = await makeHackathon();
    const user = await createUser();
    await prisma.participation.create({ data: { hackathonId: h.id, userId: user.id, lookingForTeam: true } });

    const res = await createTeam(user.id, h.id, {
      name: "  Byte   Club ",
      description: "We build things",
      lookingFor: ["React", "react", "no-such-skill-xyz", "Python"],
    });
    expect(res.ok).toBe(true);

    const team = await prisma.team.findFirstOrThrow({ include: { members: true } });
    expect(team.name).toBe("Byte Club");
    expect(team.lookingFor).toEqual(["react", "python"]);
    expect(team.members).toHaveLength(1);
    expect(team.members[0]).toMatchObject({ userId: user.id, role: "LEAD", hackathonId: h.id });
    const p = await prisma.participation.findUniqueOrThrow({
      where: { hackathonId_userId: { hackathonId: h.id, userId: user.id } },
    });
    expect(p.lookingForTeam).toBe(false);

    const view = await getHackathonView(user.id, "hack-1");
    expect(view?.myTeam?.role).toBe("LEAD");
    expect(view?.phase).toBe("running");
  });

  it("refuses a second team for the same user in the same hackathon", async () => {
    const h = await makeHackathon();
    const user = await createUser();
    await teamOf(user.id, h.id, "First");
    const res = await createTeam(user.id, h.id, { name: "Second", lookingFor: [] });
    expect(res).toEqual({ ok: false, error: "You're already in a team for this hackathon." });
    expect(await prisma.team.count()).toBe(1);
  });

  it("refuses a duplicate team name in the same hackathon", async () => {
    const h = await makeHackathon();
    await teamOf((await createUser()).id, h.id, "Alpha");
    const res = await createTeam((await createUser()).id, h.id, { name: "alpha", lookingFor: [] });
    expect(res.ok).toBe(false);
  });
});

describe("team listing", () => {
  it("starts unlisted unless asked, and a team of one can be listed at creation", async () => {
    const h = await makeHackathon();
    const quiet = await createUser();
    const solo = await createUser();
    await teamOf(quiet.id, h.id, "Quiet");
    const res = await createTeam(solo.id, h.id, { name: "Solo", lookingFor: ["React"], listed: true });
    expect(res.ok).toBe(true);

    const teams = await prisma.team.findMany({ orderBy: { name: "asc" }, select: { name: true, listed: true } });
    expect(teams).toEqual([
      { name: "Quiet", listed: false },
      { name: "Solo", listed: true },
    ]);
  });

  it("lets the lead list the team and update what it needs", async () => {
    const h = await makeHackathon();
    const lead = await createUser();
    const teamId = await teamOf(lead.id, h.id);

    const res = await setTeamListing(lead.id, teamId, {
      listed: true,
      description: "  An app for study groups ",
      lookingFor: ["Python", "nope-not-a-skill"],
    });
    expect(res).toEqual({ ok: true });
    const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId } });
    expect(team).toMatchObject({ listed: true, description: "An app for study groups", lookingFor: ["python"] });

    expect(await setTeamListing(lead.id, teamId, { listed: false, lookingFor: [] })).toEqual({ ok: true });
    expect((await prisma.team.findUniqueOrThrow({ where: { id: teamId } })).listed).toBe(false);
  });

  it("refuses a member who is not the lead", async () => {
    const h = await makeHackathon();
    const lead = await createUser();
    const member = await createUser();
    const teamId = await teamOf(lead.id, h.id);
    await addMember(teamId, h.id, member.id, lead.id);

    expect(await setTeamListing(member.id, teamId, { listed: true, lookingFor: [] })).toEqual({
      ok: false,
      error: "Only the team lead can change the listing.",
    });
    expect((await prisma.team.findUniqueOrThrow({ where: { id: teamId } })).listed).toBe(false);
  });

  it("refuses join requests to an unlisted team", async () => {
    const h = await makeHackathon();
    const lead = await createUser();
    const joiner = await createUser({ onboarded: true });
    const teamId = await teamOf(lead.id, h.id);

    expect(await requestToJoin(joiner.id, teamId)).toEqual({
      ok: false,
      error: "This team isn't taking join requests.",
    });
    await setTeamListing(lead.id, teamId, { listed: true, lookingFor: [] });
    expect(await requestToJoin(joiner.id, teamId)).toEqual({ ok: true });
  });
});

describe("listMyTeams", () => {
  it("lists every team the user is in with their teammates, open hackathons first", async () => {
    const now = Date.now();
    const admin = await createUser();
    const mk = (slug: string, endsIn: number) =>
      prisma.hackathon.create({
        data: {
          slug,
          name: slug,
          startsAt: new Date(now - 10 * DAY),
          endsAt: new Date(now + endsIn * DAY),
          createdById: admin.id,
        },
      });
    const later = await mk("later", 5);
    const sooner = await mk("sooner", 2);
    const past = await mk("past", 5);

    const me = await createUser();
    const mate = await createUser();
    const requester = await createUser({ onboarded: true });
    const laterTeam = await teamOf(me.id, later.id, "Later team");
    await addMember(laterTeam, later.id, mate.id, me.id);
    const soonerTeam = await createTeam(mate.id, sooner.id, { name: "Mate's team", lookingFor: [], listed: true });
    if (!soonerTeam.ok) throw new Error(soonerTeam.error);
    await addMember(soonerTeam.teamId, sooner.id, me.id, mate.id);
    await requestToJoin(requester.id, soonerTeam.teamId);
    await teamOf(me.id, past.id, "Old team");
    await prisma.hackathon.update({ where: { id: past.id }, data: { endsAt: new Date(now - DAY) } });
    await mk("free", 3);
    const pending = await mk("pending-import", 3);
    await prisma.hackathon.update({ where: { id: pending.id }, data: { visibility: "PENDING" } });

    const teams = await listMyTeams(me.id);
    expect(teams.map((t) => [t.name, t.role, t.hackathon.phase])).toEqual([
      ["Mate's team", "MEMBER", "running"],
      ["Later team", "LEAD", "running"],
      ["Old team", "LEAD", "ended"],
    ]);
    expect(teams[0].members.map((m) => m.userId)).toEqual([mate.id, me.id]);
    expect(teams[0].listed).toBe(true);
    // Join requests are the lead's business; a member sees none.
    expect(teams[0].pendingRequests).toBe(0);
    expect((await listMyTeams(mate.id)).find((t) => t.name === "Mate's team")?.pendingRequests).toBe(1);

    expect((await hackathonsWithoutTeam(me.id)).map((h) => h.slug)).toEqual(["free"]);
  });
});

describe("leaveTeam", () => {
  it("promotes the remaining member when the lead leaves", async () => {
    const h = await makeHackathon();
    const lead = await createUser();
    const other = await createUser();
    const teamId = await teamOf(lead.id, h.id);
    await addMember(teamId, h.id, other.id, lead.id);

    expect(await leaveTeam(lead.id, teamId)).toEqual({ ok: true });
    const members = await prisma.teamMember.findMany({ where: { teamId } });
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ userId: other.id, role: "LEAD" });
  });

  it("deletes the team when the last member leaves", async () => {
    const h = await makeHackathon();
    const user = await createUser();
    const teamId = await teamOf(user.id, h.id);
    expect(await leaveTeam(user.id, teamId)).toEqual({ ok: true });
    expect(await prisma.team.count()).toBe(0);
    expect(await prisma.teamMember.count()).toBe(0);
  });

  it("refuses someone who is not in the team", async () => {
    const h = await makeHackathon();
    const teamId = await teamOf((await createUser()).id, h.id);
    const res = await leaveTeam((await createUser()).id, teamId);
    expect(res.ok).toBe(false);
    expect(await prisma.teamMember.count()).toBe(1);
  });
});

describe("setLookingForTeam", () => {
  it("toggles the participation flag on and off", async () => {
    const h = await makeHackathon();
    const user = await createUser();
    const read = async () =>
      (await prisma.participation.findUniqueOrThrow({ where: { hackathonId_userId: { hackathonId: h.id, userId: user.id } } }))
        .lookingForTeam;

    expect(await setLookingForTeam(user.id, h.id, true)).toEqual({ ok: true });
    expect(await read()).toBe(true);
    expect(await setLookingForTeam(user.id, h.id, false)).toEqual({ ok: true });
    expect(await read()).toBe(false);
    expect((await getHackathonView(user.id, "hack-1"))?.lookingForTeam).toBe(false);
  });

  it("refuses to turn it on for someone already in a team", async () => {
    const h = await makeHackathon();
    const user = await createUser();
    await teamOf(user.id, h.id);
    const res = await setLookingForTeam(user.id, h.id, true);
    expect(res).toEqual({ ok: false, error: "You're already in a team for this hackathon." });
  });
});

describe("acceptInTransaction", () => {
  it("lets exactly one of two concurrent accepts take the last slot (Review Focus 1)", async () => {
    const h = await makeHackathon({ teamSizeMax: 2 });
    const lead = await createUser();
    const a = await createUser();
    const b = await createUser();
    const teamId = await teamOf(lead.id, h.id);
    const ia = await pendingInvite(teamId, h.id, a.id, lead.id);
    const ib = await pendingInvite(teamId, h.id, b.id, lead.id);

    const results = await Promise.all([
      prisma.$transaction((tx) => acceptInTransaction(tx, ia.id, true)),
      prisma.$transaction((tx) => acceptInTransaction(tx, ib.id, true)),
    ]);

    expect(await prisma.teamMember.count({ where: { teamId } })).toBe(2);
    const failed = results.filter((r) => !r.ok);
    expect(failed).toHaveLength(1);
    expect(failed[0]).toEqual({ ok: false, error: "This team is full." });
  });

  it("makes a second accept wait for the first and then refuses it as full (Review Focus 1, forced overlap)", async () => {
    const h = await makeHackathon({ teamSizeMax: 2 });
    const lead = await createUser();
    const teamId = await teamOf(lead.id, h.id);
    const ia = await pendingInvite(teamId, h.id, (await createUser()).id, lead.id);
    const ib = await pendingInvite(teamId, h.id, (await createUser()).id, lead.id);

    const { r1, r2, sawWait } = await secondWaitsOnFirst(ia.id, ib.id);
    expect(sawWait).toBe(true);
    expect(r1).toEqual({ ok: true });
    expect(r2).toEqual({ ok: false, error: "This team is full." });
    expect(await prisma.teamMember.count({ where: { teamId } })).toBe(2);
  });

  it("lets a user join only one of two teams when both accepts race (Review Focus 2)", async () => {
    const h = await makeHackathon();
    const lead1 = await createUser();
    const lead2 = await createUser();
    const joiner = await createUser();
    const t1 = await teamOf(lead1.id, h.id, "One");
    const t2 = await teamOf(lead2.id, h.id, "Two");
    const i1 = await pendingInvite(t1, h.id, joiner.id, lead1.id);
    const i2 = await pendingInvite(t2, h.id, joiner.id, lead2.id);

    // The second accept passes the in-team precheck and must be stopped by the DB unique index.
    const { r1, r2, sawWait } = await secondWaitsOnFirst(i1.id, i2.id);
    expect(sawWait).toBe(true);
    expect(r1).toEqual({ ok: true });
    expect(r2).toEqual({ ok: false, error: "You're already in a team for this hackathon." });
    expect(await prisma.teamMember.count({ where: { userId: joiner.id } })).toBe(1);
    expect(await prisma.teamMember.count({ where: { teamId: t2 } })).toBe(1);
  });

  it("accepts, cancels the joiner's other pending invites in the hackathon, and clears lookingForTeam", async () => {
    const h = await makeHackathon();
    const other = await makeHackathon({ slug: "hack-2" });
    const lead1 = await createUser();
    const lead2 = await createUser();
    const lead3 = await createUser();
    const joiner = await createUser();
    const t1 = await teamOf(lead1.id, h.id, "One");
    const t2 = await teamOf(lead2.id, h.id, "Two");
    const t3 = await teamOf(lead3.id, other.id, "Elsewhere");
    await setLookingForTeam(joiner.id, h.id, true);

    const accepted = await pendingInvite(t1, h.id, joiner.id, lead1.id);
    const sameHackathon = await prisma.teamInvite.create({
      data: { teamId: t2, hackathonId: h.id, userId: joiner.id, kind: "REQUEST", createdById: joiner.id },
    });
    const otherHackathon = await pendingInvite(t3, other.id, joiner.id, lead3.id);

    const res = await prisma.$transaction((tx) => acceptInTransaction(tx, accepted.id, true));
    expect(res).toEqual({ ok: true });

    const status = async (id: string) => (await prisma.teamInvite.findUniqueOrThrow({ where: { id } })).status;
    expect(await status(accepted.id)).toBe("ACCEPTED");
    expect(await status(sameHackathon.id)).toBe("CANCELLED");
    expect(await status(otherHackathon.id)).toBe("PENDING");

    const member = await prisma.teamMember.findUniqueOrThrow({ where: { teamId_userId: { teamId: t1, userId: joiner.id } } });
    expect(member).toMatchObject({ role: "MEMBER", hackathonId: h.id });
    const p = await prisma.participation.findUniqueOrThrow({
      where: { hackathonId_userId: { hackathonId: h.id, userId: joiner.id } },
    });
    expect(p.lookingForTeam).toBe(false);
  });

  it("refuses when the actor may not respond, or the invite was already answered", async () => {
    const h = await makeHackathon();
    const lead = await createUser();
    const joiner = await createUser();
    const teamId = await teamOf(lead.id, h.id);
    const invite = await pendingInvite(teamId, h.id, joiner.id, lead.id);

    const denied = await prisma.$transaction((tx) => acceptInTransaction(tx, invite.id, false));
    expect(denied).toEqual({ ok: false, error: "You can't respond to this one." });

    expect((await prisma.$transaction((tx) => acceptInTransaction(tx, invite.id, true))).ok).toBe(true);
    const again = await prisma.$transaction((tx) => acceptInTransaction(tx, invite.id, true));
    expect(again.ok).toBe(false);
    expect(await prisma.teamMember.count({ where: { teamId } })).toBe(2);
  });
});
