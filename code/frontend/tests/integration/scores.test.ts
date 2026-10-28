import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { addUserSkillAction, removeUserSkillAction } from "@/app/skills/actions";
import { prisma } from "@/lib/prisma";
import { computeUserScores, recomputeUserScores, recomputeUserScoresSafely } from "@/lib/skill-score";
import { createUser, resetDb, signInAs } from "./helpers";

beforeEach(async () => {
  await resetDb();
  signInAs(null);
});
afterAll(async () => {
  await prisma.$disconnect();
});

async function reactScore(userId: string) {
  return prisma.skillScore.findFirst({ where: { userId, skill: { slug: "react" } } });
}

describe("score recomputation", () => {
  it("scores a self-rated ADVANCED skill at 10 and updates the profile", async () => {
    const user = await createUser({ onboarded: true });
    signInAs(user);
    expect((await addUserSkillAction("react", "ADVANCED")).ok).toBe(true);
    expect((await reactScore(user.id))?.score).toBe(10);
    const profile = await prisma.profile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(profile.evidenceScore).toBeGreaterThan(0);
  });

  it("raises the score to 30 once an active resume lists the skill", async () => {
    const user = await createUser({ onboarded: true });
    signInAs(user);
    await addUserSkillAction("react", "ADVANCED");
    const resume = await prisma.evidenceRecord.create({
      data: { userId: user.id, source: "RESUME", payload: { extractedSkills: ["react"] } },
    });
    await prisma.profile.update({ where: { userId: user.id }, data: { activeResumeId: resume.id } });
    await recomputeUserScores(user.id);
    expect((await reactScore(user.id))?.score).toBe(30);
  });

  it("removing the only evidence deletes the row and zeroes the profile", async () => {
    const user = await createUser({ onboarded: true });
    signInAs(user);
    await addUserSkillAction("react", "ADVANCED");
    expect((await removeUserSkillAction("react")).ok).toBe(true);
    expect(await reactScore(user.id)).toBeNull();
    const profile = await prisma.profile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(profile.evidenceScore).toBe(0);
  });

  it("stored values agree with a fresh computation (backfill --check logic)", async () => {
    const user = await createUser({ onboarded: true });
    signInAs(user);
    await addUserSkillAction("react", "ADVANCED");
    await addUserSkillAction("python", "BEGINNER");
    await recomputeUserScores(user.id);

    const fresh = await computeUserScores(user.id);
    const stored = await prisma.skillScore.findMany({ where: { userId: user.id } });
    const profile = await prisma.profile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(profile.evidenceScore).toBe(fresh.evidenceScore);
    expect(stored).toHaveLength(fresh.rows.length);
    for (const r of fresh.rows) {
      expect(stored.find((s) => s.skillId === r.skillId)?.score).toBe(r.score);
    }

    // Drift is detectable: tamper with a stored row and the same comparison fails.
    await prisma.skillScore.updateMany({ where: { userId: user.id }, data: { score: 99 } });
    const tampered = await prisma.skillScore.findMany({ where: { userId: user.id } });
    expect(fresh.rows.every((r) => tampered.find((s) => s.skillId === r.skillId)?.score === r.score)).toBe(false);
  });

  it("concurrent recomputes leave consistent rows", async () => {
    const user = await createUser({ onboarded: true });
    const react = await prisma.skill.findUniqueOrThrow({ where: { slug: "react" } });
    await prisma.userSkill.create({ data: { userId: user.id, skillId: react.id, level: "ADVANCED" } });
    // The safe variant must never throw.
    await expect(
      Promise.all([recomputeUserScoresSafely(user.id), recomputeUserScoresSafely(user.id)]),
    ).resolves.toBeDefined();

    const rows = await prisma.skillScore.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].score).toBe(10);
    const fresh = await computeUserScores(user.id);
    const profile = await prisma.profile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(profile.evidenceScore).toBe(fresh.evidenceScore);
  });
});
