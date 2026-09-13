import { prisma } from "@/lib/prisma";

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
