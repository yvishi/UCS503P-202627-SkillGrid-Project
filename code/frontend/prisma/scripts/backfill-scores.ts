// Fills skill_scores and profiles.evidenceScore for every user with a profile.
// Run: `npx tsx prisma/scripts/backfill-scores.ts`
// With --check, writes nothing: compares each stored evidenceScore (and the
// stored skill_scores rows) against a fresh computation, exits 1 on mismatch.

import { prisma } from "@/lib/prisma";
import { computeUserScores, recomputeUserScores } from "@/lib/skill-score";

async function main() {
  const check = process.argv.includes("--check");
  const profiles = await prisma.profile.findMany({ select: { userId: true, evidenceScore: true } });

  if (!check) {
    let skillRows = 0;
    for (const p of profiles) skillRows += (await recomputeUserScores(p.userId)).skills;
    console.log(`users=${profiles.length} skillRows=${skillRows}`);
    return;
  }

  let mismatches = 0;
  for (const p of profiles) {
    const fresh = await computeUserScores(p.userId);
    const stored = await prisma.skillScore.findMany({ where: { userId: p.userId }, select: { skillId: true, score: true } });
    const same =
      p.evidenceScore === fresh.evidenceScore &&
      stored.length === fresh.rows.length &&
      fresh.rows.every((r) => stored.some((s) => s.skillId === r.skillId && s.score === r.score));
    if (!same) {
      mismatches++;
      console.log(`mismatch user=${p.userId} stored=${p.evidenceScore} fresh=${fresh.evidenceScore}`);
    }
  }
  console.log(`checked=${profiles.length} mismatches=${mismatches}`);
  if (mismatches > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
