import { prisma } from "@/lib/prisma";
import { aggregatePeerEvidence } from "@/lib/peer-feedback-core";

/**
 * Rebuilds the user's single PEER_FEEDBACK EvidenceRecord from every
 * PeerFeedback row they have received, across all hackathons. Replace, not
 * append (same pattern as the GitHub callback). No rows -> the record is
 * just removed.
 */
export async function rebuildPeerEvidence(userId: string): Promise<void> {
  const rows = await prisma.peerFeedback.findMany({
    where: { toUserId: userId },
    select: { level: true, fromUserId: true, skill: { select: { slug: true } } },
  });
  const payload = aggregatePeerEvidence(rows.map((r) => ({ slug: r.skill.slug, level: r.level, fromUserId: r.fromUserId })));

  await prisma.$transaction(async (tx) => {
    await tx.evidenceRecord.deleteMany({ where: { userId, source: "PEER_FEEDBACK" } });
    if (payload.skills.length > 0) {
      await tx.evidenceRecord.create({ data: { userId, source: "PEER_FEEDBACK", payload } });
    }
  });
}
