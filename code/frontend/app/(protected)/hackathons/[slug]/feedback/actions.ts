"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { canGiveFeedback, feedbackWindow, parseFeedbackInput, type RuleResult } from "@/lib/peer-feedback-core";
import { rebuildPeerEvidence } from "@/lib/peer-feedback";
import { prisma } from "@/lib/prisma";
import { recomputeUserScoresSafely } from "@/lib/skill-score";
import { getUserSkills } from "@/lib/user-skills";

export async function submitFeedbackAction(
  hackathonSlug: string,
  input: { toUserId: string; ratings: { slug: string; level: string }[] },
): Promise<RuleResult> {
  const session = await auth();
  const raterId = session?.user?.id;
  if (!raterId) return { ok: false, error: "Not signed in." };

  const hackathon = await prisma.hackathon.findUnique({
    where: { slug: hackathonSlug },
    select: { id: true, endsAt: true },
  });
  if (!hackathon) return { ok: false, error: "Hackathon not found." };

  // Team ids come from the server, never from the client.
  const members = await prisma.teamMember.findMany({
    where: { hackathonId: hackathon.id, userId: { in: [raterId, input.toUserId] } },
    select: { userId: true, teamId: true },
  });
  const teamOf = (id: string) => members.find((m) => m.userId === id)?.teamId ?? null;
  const raterTeamId = teamOf(raterId);

  const allowed = canGiveFeedback({
    window: feedbackWindow(hackathon.endsAt, new Date()),
    raterTeamId,
    targetTeamId: teamOf(input.toUserId),
    raterId,
    targetId: input.toUserId,
  });
  if (!allowed.ok) return allowed;

  const targetSkills = await getUserSkills(input.toUserId);
  const parsed = parseFeedbackInput(input, new Set(targetSkills.map((s) => s.slug)));
  if (!parsed.ok) return parsed;

  const skills = await prisma.skill.findMany({
    where: { slug: { in: parsed.value.ratings.map((r) => r.slug) } },
    select: { id: true, slug: true },
  });
  const idBySlug = new Map(skills.map((s) => [s.slug, s.id]));

  await prisma.$transaction(async (tx) => {
    await tx.peerFeedback.deleteMany({
      where: { hackathonId: hackathon.id, fromUserId: raterId, toUserId: input.toUserId },
    });
    await tx.peerFeedback.createMany({
      data: parsed.value.ratings.map((r) => ({
        hackathonId: hackathon.id,
        teamId: raterTeamId!,
        fromUserId: raterId,
        toUserId: input.toUserId,
        skillId: idBySlug.get(r.slug)!,
        level: r.level,
      })),
    });
  });

  // The ratings are committed; now write them back into the target's evidence and scores.
  await rebuildPeerEvidence(input.toUserId);
  await recomputeUserScoresSafely(input.toUserId);

  revalidatePath("/dashboard");
  revalidatePath(`/hackathons/${hackathonSlug}/feedback`);
  return { ok: true };
}
