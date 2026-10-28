import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { approveAction } from "@/app/admin/skill-requests/actions";
import { reportSkillAction } from "@/app/skills/actions";
import { prisma } from "@/lib/prisma";
import { createUser, resetDb, signInAs } from "./helpers";

beforeEach(async () => {
  await resetDb();
  signInAs(null);
});
afterAll(async () => {
  await prisma.$disconnect();
});

function approvalForm(key: string, slug: string) {
  const fd = new FormData();
  fd.set("key", key);
  fd.set("name", "Zigzag Lang");
  fd.set("slug", slug);
  fd.set("category", "LANGUAGE");
  fd.set("aliases", "");
  return fd;
}

describe("admin skill review", () => {
  it("refuses a non-admin", async () => {
    signInAs(await createUser());
    const res = await approveAction(null, approvalForm("zigzaglang", "zigzag-lang"));
    expect(res).toEqual({ ok: false, message: "Not allowed." });
    expect(await prisma.skill.count({ where: { slug: "zigzag-lang" } })).toBe(0);
  });

  it("approving a group creates the skill and the UserSkill rows of its reporters", async () => {
    const u1 = await createUser();
    const u2 = await createUser();
    signInAs(u1);
    expect((await reportSkillAction({ rawName: "Zigzag Lang", level: "ADVANCED" })).status).not.toBe("error");
    signInAs(u2);
    expect((await reportSkillAction({ rawName: "zigzag lang", level: "BEGINNER" })).status).not.toBe("error");

    const pending = await prisma.skillRequest.findMany({ where: { status: "PENDING" } });
    expect(pending).toHaveLength(2);

    signInAs(await createUser({ admin: true }));
    const res = await approveAction(null, approvalForm(pending[0].key, "zigzag-lang"));
    expect(res?.ok).toBe(true);

    const skill = await prisma.skill.findUniqueOrThrow({ where: { slug: "zigzag-lang" } });
    const rows = await prisma.userSkill.findMany({ where: { skillId: skill.id } });
    expect(rows).toHaveLength(2);
    expect(rows.find((l) => l.userId === u1.id)?.level).toBe("ADVANCED");
    expect(rows.find((l) => l.userId === u2.id)?.level).toBe("BEGINNER");
    expect(await prisma.skillRequest.count({ where: { status: "APPROVED" } })).toBe(2);
  });
});
