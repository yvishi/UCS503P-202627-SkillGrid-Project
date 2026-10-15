import { prisma } from "@/lib/prisma";
import type { UserSkillEntry } from "@/lib/skills";

// Reads and writes a user's self-rated skills (UserSkill rows). Oldest
// first, so the picker list stays in the order skills were added.

export async function getUserSkills(userId: string): Promise<UserSkillEntry[]> {
  const rows = await prisma.userSkill.findMany({
    where: { userId },
    include: { skill: { select: { slug: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ slug: r.skill.slug, name: r.skill.name, level: r.level }));
}
