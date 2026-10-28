import { prisma } from "@/lib/prisma";
import { isUniqueViolation } from "@/lib/skill-catalog";
import { findActiveResumePayload, findGithubPayload, findPeerPayload } from "@/lib/evidence";
import { githubSkillsFromPayload, peerSkillsFromPayload, resumeSkillsFromPayload } from "@/lib/skill-grid";
import { collectEvidence, profileScore, skillScore } from "@/lib/skill-score-core";
import { getUserSkills } from "@/lib/user-skills";

type ComputedScores = { rows: { skillId: string; score: number }[]; evidenceScore: number };

/** Computes, without storing, a user's skill scores from their current evidence. */
export async function computeUserScores(userId: string): Promise<ComputedScores> {
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { activeResumeId: true } });
  const [userSkills, resumePayload, githubPayload, peerPayload] = await Promise.all([
    getUserSkills(userId),
    findActiveResumePayload(userId, profile?.activeResumeId ?? null),
    findGithubPayload(userId),
    findPeerPayload(userId),
  ]);

  const evidence = collectEvidence({
    userSkills,
    resumeSkills: resumeSkillsFromPayload(resumePayload),
    githubSkills: githubSkillsFromPayload(githubPayload),
    peerSkills: peerSkillsFromPayload(peerPayload),
  });

  const catalog = await prisma.skill.findMany({
    where: { slug: { in: evidence.map((e) => e.slug) } },
    select: { id: true, slug: true },
  });
  const idBySlug = new Map(catalog.map((s) => [s.slug, s.id]));

  const rows = evidence
    .filter((e) => idBySlug.has(e.slug))
    .map((e) => ({ skillId: idBySlug.get(e.slug)!, score: skillScore(e) }))
    .filter((r) => r.score > 0);
  return { rows, evidenceScore: profileScore(rows.map((r) => r.score)) };
}

/**
 * Recomputes and stores a user's skill scores from their current evidence
 * (active resume, GitHub, peers, self-ratings). Replaces their SkillScore
 * rows (only scores above 0 are stored; slugs the catalog doesn't know are
 * skipped) and updates Profile.evidenceScore. A user with no Profile row
 * still gets SkillScore rows but has no evidence score to store.
 */
export async function recomputeUserScores(userId: string): Promise<{ evidenceScore: number; skills: number }> {
  // Two concurrent recomputes can both delete, then both insert and collide
  // on the (userId, skillId) key. Retry once, re-reading the evidence.
  for (let attempt = 0; ; attempt++) {
    const { rows, evidenceScore } = await computeUserScores(userId);
    try {
      await prisma.$transaction([
        prisma.skillScore.deleteMany({ where: { userId } }),
        prisma.skillScore.createMany({ data: rows.map((r) => ({ userId, ...r })) }),
        prisma.profile.updateMany({ where: { userId }, data: { evidenceScore, scoreUpdatedAt: new Date() } }),
      ]);
      return { evidenceScore, skills: rows.length };
    } catch (err) {
      if (attempt === 0 && isUniqueViolation(err)) continue;
      throw err;
    }
  }
}

/** For hook call sites: the evidence write has already committed, so a failed recompute must not fail the action. */
export async function recomputeUserScoresSafely(userId: string): Promise<void> {
  try {
    await recomputeUserScores(userId);
  } catch (err) {
    console.error("recomputeUserScores failed for", userId, err);
  }
}
