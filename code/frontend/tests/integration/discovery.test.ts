import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { findTeammates } from "@/lib/discovery";
import { parseTeammateFilters } from "@/lib/discovery-core";
import { prisma } from "@/lib/prisma";
import { createUser, resetDb } from "./helpers";

beforeEach(resetDb);
afterAll(async () => {
  await prisma.$disconnect();
});

const filters = (q: Record<string, string | string[]> = {}) => parseTeammateFilters(q);

async function giveScores(userId: string, scores: Record<string, number>) {
  const skills = await prisma.skill.findMany({ where: { slug: { in: Object.keys(scores) } } });
  expect(skills).toHaveLength(Object.keys(scores).length);
  await prisma.skillScore.createMany({
    data: skills.map((s) => ({ userId, skillId: s.id, score: scores[s.slug] })),
  });
}

describe("findTeammates", () => {
  it("excludes the viewer", async () => {
    const viewer = await createUser({ onboarded: true });
    const other = await createUser({ onboarded: true });
    const { items } = await findTeammates(viewer.id, filters());
    expect(items.map((i) => i.userId)).toEqual([other.id]);
  });

  it("excludes users who have not finished onboarding", async () => {
    const viewer = await createUser({ onboarded: true });
    await createUser({ onboarded: false });
    const ready = await createUser({ onboarded: true });
    const { items } = await findTeammates(viewer.id, filters());
    expect(items.map((i) => i.userId)).toEqual([ready.id]);
  });

  it("ANDs two skill filters", async () => {
    const viewer = await createUser({ onboarded: true });
    const both = await createUser({ onboarded: true });
    const onlyReact = await createUser({ onboarded: true });
    await giveScores(both.id, { react: 10, python: 10 });
    await giveScores(onlyReact.id, { react: 30 });
    const { items } = await findTeammates(viewer.id, filters({ skill: ["react", "python"] }));
    expect(items.map((i) => i.userId)).toEqual([both.id]);
  });

  it("ranks by the summed scores of the filtered skills only", async () => {
    const viewer = await createUser({ onboarded: true });
    const a = await createUser({ onboarded: true });
    const b = await createUser({ onboarded: true });
    // a: filtered sum 40, plus a big unfiltered skill. b: filtered sum 50.
    await giveScores(a.id, { react: 20, python: 20, typescript: 90 });
    await giveScores(b.id, { react: 25, python: 25 });
    const { items } = await findTeammates(viewer.id, filters({ skill: ["react", "python"] }));
    expect(items.map((i) => i.userId)).toEqual([b.id, a.id]);
  });

  it("the hackathon filter keeps only users looking for a team there", async () => {
    const viewer = await createUser({ onboarded: true });
    const looking = await createUser({ onboarded: true });
    const notLooking = await createUser({ onboarded: true });
    const elsewhere = await createUser({ onboarded: true });
    const mk = (slug: string) =>
      prisma.hackathon.create({
        data: {
          slug,
          name: slug,
          startsAt: new Date(Date.now() - 86_400_000),
          endsAt: new Date(Date.now() + 86_400_000),
          createdById: viewer.id,
        },
      });
    const h1 = await mk("hack-one");
    const h2 = await mk("hack-two");
    await prisma.participation.createMany({
      data: [
        { hackathonId: h1.id, userId: looking.id, lookingForTeam: true },
        { hackathonId: h1.id, userId: notLooking.id, lookingForTeam: false },
        { hackathonId: h2.id, userId: elsewhere.id, lookingForTeam: true },
      ],
    });
    const { items } = await findTeammates(viewer.id, filters({ hackathon: "hack-one" }));
    expect(items.map((i) => i.userId)).toEqual([looking.id]);
  });

  it("junk filters do not throw", async () => {
    const viewer = await createUser({ onboarded: true });
    await createUser({ onboarded: true });
    const parsed = parseTeammateFilters({ availability: "FOO", page: "-3" });
    expect(parsed.availability).toBeNull();
    expect(parsed.page).toBe(1);
    const { items } = await findTeammates(viewer.id, parsed);
    expect(items).toHaveLength(1);
  });
});
