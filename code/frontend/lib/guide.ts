import { getEvidenceStatus } from "@/lib/evidence";
import { ACK_STEPS, type GuideFacts, type GuideStepId } from "@/lib/guide-core";
import { prisma } from "@/lib/prisma";

// Loads and stores progress for the dashboard's one-time guide. The rules
// themselves are in lib/guide-core.ts.

/** What's on file for this user, as the guide's rules need it. */
export async function getGuideFacts(userId: string, profile: { guideSeenSteps: string[] }): Promise<GuideFacts> {
  const [skillCount, evidence, participation, membership, sent, responded, feedback] = await Promise.all([
    prisma.userSkill.count({ where: { userId } }),
    getEvidenceStatus(userId),
    prisma.participation.findFirst({ where: { userId }, select: { hackathonId: true } }),
    prisma.teamMember.findFirst({ where: { userId }, select: { teamId: true } }),
    prisma.teamInvite.findFirst({ where: { createdById: userId }, select: { id: true } }),
    prisma.teamInvite.findFirst({
      where: { kind: "INVITE", userId, respondedAt: { not: null } },
      select: { id: true },
    }),
    prisma.peerFeedback.findFirst({ where: { fromUserId: userId }, select: { id: true } }),
  ]);

  return {
    skillCount,
    evidenceSources: [evidence.resumeUploaded, evidence.githubConnected].filter(Boolean).length,
    joinedHackathon: participation !== null,
    onTeam: membership !== null,
    sentInviteOrRequest: sent !== null,
    respondedToInvite: responded !== null,
    gaveFeedback: feedback !== null,
    seenSteps: profile.guideSeenSteps,
  };
}

/** Ends the guide for good. The first end time is kept; later calls do nothing. */
export async function endGuide(userId: string): Promise<void> {
  await prisma.profile.updateMany({
    where: { userId, guideEndedAt: null },
    data: { guideEndedAt: new Date() },
  });
}

/** Records that the user opened an acknowledgeable step from the guide. */
export async function markGuideStepSeen(userId: string, step: GuideStepId): Promise<void> {
  if (!ACK_STEPS.includes(step)) return;
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { guideSeenSteps: true } });
  if (!profile || profile.guideSeenSteps.includes(step)) return;
  await prisma.profile.update({ where: { userId }, data: { guideSeenSteps: { push: step } } });
}
