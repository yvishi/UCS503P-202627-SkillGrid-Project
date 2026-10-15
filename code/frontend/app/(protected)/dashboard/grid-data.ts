import { prisma } from "@/lib/prisma";
import type { GridRow } from "@/app/ui/EvidenceGrid";
import { buildSkillGrid, githubSkillsFromPayload, resumeSkillsFromPayload } from "@/lib/skill-grid";

export { SKILL_GRID_COLUMNS as GRID_COLUMNS } from "@/lib/skill-grid";

export type DashboardSkillGrid = {
  rows: GridRow[];
  resume: { filename: string; skillCount: number } | null;
  github: { username: string; skillCount: number } | null;
};

async function findResumePayload(userId: string, activeResumeId: string | null) {
  if (activeResumeId) {
    const active = await prisma.evidenceRecord.findFirst({
      where: { id: activeResumeId, userId, source: "RESUME" },
      select: { payload: true },
    });
    if (active) return active.payload;
  }
  const latest = await prisma.evidenceRecord.findFirst({
    where: { userId, source: "RESUME" },
    orderBy: { createdAt: "desc" },
    select: { payload: true },
  });
  return latest?.payload ?? null;
}

export async function getSkillGrid(
  userId: string,
  profile: { skillRatings: unknown; activeResumeId: string | null },
): Promise<DashboardSkillGrid> {
  const [resumePayload, githubRecord] = await Promise.all([
    findResumePayload(userId, profile.activeResumeId),
    prisma.evidenceRecord.findFirst({
      where: { userId, source: "GITHUB" },
      select: { payload: true },
    }),
  ]);
  const githubPayload = githubRecord?.payload ?? null;

  const { rows } = buildSkillGrid({ skillRatings: profile.skillRatings, resumePayload, githubPayload });

  const resumeData = resumePayload as { filename?: unknown } | null;
  const githubData = githubPayload as { verified?: unknown; username?: unknown } | null;

  return {
    rows,
    resume: resumeData
      ? {
          filename: typeof resumeData.filename === "string" ? resumeData.filename : "resume.pdf",
          skillCount: resumeSkillsFromPayload(resumePayload).length,
        }
      : null,
    github:
      githubData?.verified === true
        ? {
            username: typeof githubData.username === "string" ? githubData.username : "GitHub",
            skillCount: githubSkillsFromPayload(githubPayload).length,
          }
        : null,
  };
}
