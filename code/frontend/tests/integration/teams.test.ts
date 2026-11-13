import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { acceptInTransaction, createTeam, getHackathonView, leaveTeam, setLookingForTeam } from "@/lib/teams";
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
