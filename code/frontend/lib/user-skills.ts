import { prisma } from "@/lib/prisma";
import type { SkillRatingLevel, UserSkillEntry } from "@/lib/skills";

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

/** Adds a catalog skill to the user. Already added -> keeps their existing rating. Unknown slug -> null. */
export async function addUserSkill(userId: string, slug: string, level: SkillRatingLevel): Promise<UserSkillEntry | null> {
  const skill = await prisma.skill.findUnique({ where: { slug }, select: { id: true, slug: true, name: true } });
  if (!skill) return null;
  const row = await prisma.userSkill.upsert({
    where: { userId_skillId: { userId, skillId: skill.id } },
    create: { userId, skillId: skill.id, level },
    update: {},
  });
  return { slug: skill.slug, name: skill.name, level: row.level };
}

/** Changes the rating of a skill the user already has. Not added -> null. */
export async function setUserSkillLevel(userId: string, slug: string, level: SkillRatingLevel): Promise<UserSkillEntry | null> {
  const skill = await prisma.skill.findUnique({ where: { slug }, select: { id: true, slug: true, name: true } });
  if (!skill) return null;
  const { count } = await prisma.userSkill.updateMany({ where: { userId, skillId: skill.id }, data: { level } });
  return count === 0 ? null : { slug: skill.slug, name: skill.name, level };
}

export async function removeUserSkill(userId: string, slug: string): Promise<void> {
  await prisma.userSkill.deleteMany({ where: { userId, skill: { slug } } });
}

export async function countSkillsAndPendingReports(userId: string): Promise<{ skills: number; pendingReports: number }> {
  const [skills, pendingReports] = await Promise.all([
    prisma.userSkill.count({ where: { userId } }),
    prisma.skillRequest.count({ where: { userId, status: "PENDING" } }),
  ]);
  return { skills, pendingReports };
}
