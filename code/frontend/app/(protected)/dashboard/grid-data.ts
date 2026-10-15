import type { GridRow } from "@/app/ui/EvidenceGrid";
import { loadSkillGrid } from "@/lib/evidence";
import { githubSkillsFromPayload, resumeSkillsFromPayload } from "@/lib/skill-grid";
import type { UserSkillEntry } from "@/lib/skills";

export { SKILL_GRID_COLUMNS as GRID_COLUMNS } from "@/lib/skill-grid";

export type DashboardSkillGrid = {
  rows: GridRow[];
  userSkills: UserSkillEntry[];
  resume: { filename: string; skillCount: number } | null;
  github: { username: string; skillCount: number } | null;
};

export async function getSkillGrid(userId: string, activeResumeId: string | null): Promise<DashboardSkillGrid> {
  const { userSkills, resumePayload, githubPayload, grid } = await loadSkillGrid(userId, activeResumeId);

  const resumeData = resumePayload as { filename?: unknown } | null;
  const githubData = githubPayload as { verified?: unknown; username?: unknown } | null;

  return {
    rows: grid.rows,
    userSkills,
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
