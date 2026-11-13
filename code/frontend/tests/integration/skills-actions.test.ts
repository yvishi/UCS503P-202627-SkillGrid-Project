import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  addUserSkillAction,
  removeUserSkillAction,
  setUserSkillLevelAction,
} from "@/app/skills/actions";
import { prisma } from "@/lib/prisma";
import { createUser, resetDb, signInAs } from "./helpers";

beforeEach(async () => {
  await resetDb();
  signInAs(null);
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("skill actions", () => {
  it("adds a catalog skill with the chosen level", async () => {
    const user = await createUser();
    signInAs(user);
    const res = await addUserSkillAction("react", "ADVANCED");
    expect(res.ok).toBe(true);
    const rows = await prisma.userSkill.findMany({ where: { userId: user.id }, include: { skill: true } });
    expect(rows).toHaveLength(1);
    expect(rows[0].skill.slug).toBe("react");
    expect(rows[0].level).toBe("ADVANCED");
  });

  it("rejects an unknown slug", async () => {
    signInAs(await createUser());
    const res = await addUserSkillAction("no-such-skill-xyz", "BEGINNER");
    expect(res.ok).toBe(false);
  });

  it("rejects an invalid level", async () => {
    signInAs(await createUser());
    await addUserSkillAction("react", "BEGINNER");
    const res = await setUserSkillLevelAction("react", "EXPERT");
    expect(res.ok).toBe(false);
  });

  it("changes the level of an added skill", async () => {
    const user = await createUser();
    signInAs(user);
    await addUserSkillAction("react", "BEGINNER");
    const res = await setUserSkillLevelAction("react", "INTERMEDIATE");
    expect(res.ok).toBe(true);
    const row = await prisma.userSkill.findFirstOrThrow({ where: { userId: user.id } });
    expect(row.level).toBe("INTERMEDIATE");
  });

  it("throws when signed out", async () => {
    signInAs(null);
    await expect(addUserSkillAction("react", "BEGINNER")).rejects.toThrow("Not signed in");
    expect(await prisma.userSkill.count()).toBe(0);
  });

  it("does not let user B remove the skill of user A", async () => {
    const a = await createUser();
    const b = await createUser();
    signInAs(a);
    await addUserSkillAction("react", "ADVANCED");
    signInAs(b);
    await removeUserSkillAction("react");
    expect(await prisma.userSkill.count({ where: { userId: a.id } })).toBe(1);
    signInAs(a);
    await removeUserSkillAction("react");
    expect(await prisma.userSkill.count({ where: { userId: a.id } })).toBe(0);
  });
});
