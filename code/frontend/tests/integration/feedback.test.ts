import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { submitFeedbackAction } from "@/app/(protected)/hackathons/[slug]/feedback/actions";
import { peerSkillsFromPayload } from "@/lib/skill-grid";
import { prisma } from "@/lib/prisma";
import { createUser, resetDb, signInAs } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await resetDb();
  signInAs(null);
});
afterAll(async () => {
  await prisma.$disconnect();
});

async function selfRate(userId: string, slugs: string[]) {
  for (const slug of slugs) {
    const skill = await prisma.skill.findUniqueOrThrow({ where: { slug } });
    await prisma.userSkill.create({ data: { userId, skillId: skill.id, level: "INTERMEDIATE" } });
  }
}

async function setup(endsAtOffsetDays = -1) {
  const admin = await createUser({ admin: true });
  const a = await createUser({ onboarded: true });
  const b = await createUser({ onboarded: true });
  const outsider = await createUser({ onboarded: true });
  const hackathon = await prisma.hackathon.create({
    data: {
      slug: "hack",
      name: "Hack",
      startsAt: new Date(Date.now() + (endsAtOffsetDays - 1) * DAY),
      endsAt: new Date(Date.now() + endsAtOffsetDays * DAY),
      createdById: admin.id,
    },
  });
  const team = await prisma.team.create({ data: { hackathonId: hackathon.id, name: "T", createdById: a.id } });
  const other = await prisma.team.create({ data: { hackathonId: hackathon.id, name: "U", createdById: outsider.id } });
  await prisma.teamMember.createMany({
    data: [
      { teamId: team.id, userId: a.id, hackathonId: hackathon.id },
      { teamId: team.id, userId: b.id, hackathonId: hackathon.id },
      { teamId: other.id, userId: outsider.id, hackathonId: hackathon.id },
    ],
  });
  await selfRate(b.id, ["react", "python"]);
  return { a, b, outsider };
}

async function peerRecords(userId: string) {
  return prisma.evidenceRecord.findMany({ where: { userId, source: "PEER_FEEDBACK" } });
}

describe("submitFeedbackAction", () => {
  it("writes feedback back into evidence and the evidence score", async () => {
    const { a, b } = await setup();
    await prisma.profile.update({ where: { userId: b.id }, data: { evidenceScore: 0 } });
    signInAs(a);

    expect(await submitFeedbackAction("hack", { toUserId: b.id, ratings: [{ slug: "react", level: "ADVANCED" }] })).toEqual({ ok: true });

    const records = await peerRecords(b.id);
    expect(records).toHaveLength(1);
    expect(peerSkillsFromPayload(records[0].payload)).toEqual([{ slug: "react", level: 4 }]);
    const profile = await prisma.profile.findUniqueOrThrow({ where: { userId: b.id } });
    expect(profile.evidenceScore).toBeGreaterThan(0);
  });

  it("replaces earlier ratings on resubmit instead of duplicating", async () => {
    const { a, b } = await setup();
    signInAs(a);
    await submitFeedbackAction("hack", { toUserId: b.id, ratings: [{ slug: "react", level: "ADVANCED" }, { slug: "python", level: "BEGINNER" }] });
    expect(await submitFeedbackAction("hack", { toUserId: b.id, ratings: [{ slug: "react", level: "BEGINNER" }] })).toEqual({ ok: true });

    expect(await prisma.peerFeedback.count({ where: { toUserId: b.id } })).toBe(1);
    const records = await peerRecords(b.id);
    expect(records).toHaveLength(1);
    expect(peerSkillsFromPayload(records[0].payload)).toEqual([{ slug: "react", level: 2 }]);
  });

  it("refuses a target who is not a teammate", async () => {
    const { a, outsider } = await setup();
    await selfRate(outsider.id, ["react"]);
    signInAs(a);
    expect(await submitFeedbackAction("hack", { toUserId: outsider.id, ratings: [{ slug: "react", level: "ADVANCED" }] })).toEqual({
      ok: false,
      error: "You can only rate your own teammates.",
    });
    expect(await prisma.peerFeedback.count()).toBe(0);
  });

  it("refuses rating yourself", async () => {
    const { a } = await setup();
    await selfRate(a.id, ["react"]);
    signInAs(a);
    expect(await submitFeedbackAction("hack", { toUserId: a.id, ratings: [{ slug: "react", level: "ADVANCED" }] })).toEqual({
      ok: false,
      error: "You can't rate yourself.",
    });
    expect(await prisma.peerFeedback.count()).toBe(0);
  });

  it("refuses outside the window", async () => {
    const { a, b } = await setup(-20);
    signInAs(a);
    expect(await submitFeedbackAction("hack", { toUserId: b.id, ratings: [{ slug: "react", level: "ADVANCED" }] })).toEqual({
      ok: false,
      error: "The feedback window for this hackathon has closed.",
    });
    await prisma.hackathon.update({ where: { slug: "hack" }, data: { endsAt: new Date(Date.now() + 2 * DAY) } });
    const early = await submitFeedbackAction("hack", { toUserId: b.id, ratings: [{ slug: "react", level: "ADVANCED" }] });
    expect(early).toEqual({ ok: false, error: "Feedback opens when the hackathon ends." });
    expect(await prisma.peerFeedback.count()).toBe(0);
  });

  it("refuses a skill the target has not self-rated", async () => {
    const { a, b } = await setup();
    signInAs(a);
    const result = await submitFeedbackAction("hack", { toUserId: b.id, ratings: [{ slug: "sql", level: "ADVANCED" }] });
    expect(result).toEqual({ ok: false, error: "You can only rate skills your teammate has listed." });
    expect(await peerRecords(b.id)).toHaveLength(0);
  });
});
