import { prisma } from "@/lib/prisma";
import { findSkillNames } from "@/lib/skill-catalog";
import {
  buildSkillGrid,
  githubSkillsFromPayload,
  resumeSkillsFromPayload,
  type SkillGrid,
} from "@/lib/skill-grid";
import type { EvidenceSnapshot } from "@/lib/skill-suggestions";
import type { UserSkillEntry } from "@/lib/skills";
import { getUserSkills } from "@/lib/user-skills";

export type EvidenceStatus = {
  resumeUploaded: boolean;
  githubConnected: boolean;
};

// Shared by dashboard and profile pages, which both only need two booleans:
// whether a resume exists, and whether the (single, replaced-not-accumulated
// -- see app/api/github/callback) GitHub record is verified. Queried as two
// targeted lookups rather than fetching every EvidenceRecord's full payload,
// since a user can accumulate several resume records over time and their
// extracted-skills payloads aren't needed here.
export async function getEvidenceStatus(userId: string): Promise<EvidenceStatus> {
  const [resume, github] = await Promise.all([
    prisma.evidenceRecord.findFirst({
      where: { userId, source: "RESUME" },
      select: { id: true },
    }),
    prisma.evidenceRecord.findFirst({
      where: { userId, source: "GITHUB" },
      select: { payload: true },
    }),
  ]);

  return {
    resumeUploaded: resume !== null,
    githubConnected: (github?.payload as { verified?: boolean } | undefined)?.verified === true,
  };
}

// The resume a user's evidence reads from: the active one, falling back to
// the latest upload (e.g. records from before activeResumeId existed).
// Scoped to userId, so a client-supplied id can't read someone else's.
export async function findActiveResumePayload(userId: string, activeResumeId: string | null): Promise<unknown> {
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

export async function findGithubPayload(userId: string): Promise<unknown> {
  const record = await prisma.evidenceRecord.findFirst({
    where: { userId, source: "GITHUB" },
    select: { payload: true },
  });
  return record?.payload ?? null;
}

// Everything the dashboard and profile grids need, in one place.
export async function loadSkillGrid(
  userId: string,
  activeResumeId: string | null,
): Promise<{ userSkills: UserSkillEntry[]; resumePayload: unknown; githubPayload: unknown; grid: SkillGrid }> {
  const [userSkills, resumePayload, githubPayload] = await Promise.all([
    getUserSkills(userId),
    findActiveResumePayload(userId, activeResumeId),
    findGithubPayload(userId),
  ]);
  const resumeSkills = resumeSkillsFromPayload(resumePayload);
  const githubSkills = githubSkillsFromPayload(githubPayload);
  const skillNames = await findSkillNames([...new Set([...resumeSkills, ...githubSkills.map((s) => s.slug)])]);
  return {
    userSkills,
    resumePayload,
    githubPayload,
    grid: buildSkillGrid({ userSkills, resumeSkills, githubSkills, skillNames }),
  };
}

// The picker's view of a user's evidence (spec 4.3). Slugs the catalog
// doesn't know are dropped here so the client never sees a nameless skill.
export async function getEvidenceSnapshot(userId: string, resumeEvidenceId: string | null): Promise<EvidenceSnapshot> {
  const [resumePayload, githubPayload] = await Promise.all([
    findActiveResumePayload(userId, resumeEvidenceId),
    findGithubPayload(userId),
  ]);
  const resume = resumeSkillsFromPayload(resumePayload);
  const github = githubSkillsFromPayload(githubPayload);
  const names = await findSkillNames([...new Set([...resume, ...github.map((g) => g.slug)])]);
  return {
    github: github.filter((g) => names.has(g.slug)),
    resume: resume.filter((slug) => names.has(slug)),
    names: Object.fromEntries(names),
  };
}
