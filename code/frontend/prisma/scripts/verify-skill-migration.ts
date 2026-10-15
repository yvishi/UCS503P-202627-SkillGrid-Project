// One-off check for the open_skill_catalog migration: every valid entry
// in the old profiles."skillRatings" JSON must have become a user_skills
// row (the two split slugs become two rows each, so >= is expected).
// Run: `npx tsx prisma/scripts/verify-skill-migration.ts`. Deleted once the
// skillRatings column is dropped (follow-up in Task 11, Step 7).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LEGACY_SLUGS = [
  "javascript", "typescript", "python", "java", "cpp", "go", "react", "nextjs", "nodejs", "flutter",
  "react-native", "sql", "docker", "kubernetes", "aws", "git", "figma", "solidity",
  "pytorch-tensorflow", "pandas-numpy",
];

async function main() {
  const [counts] = await prisma.$queryRaw<{ user_skills: number; valid_rating_entries: number }[]>`
    SELECT
      (SELECT count(*) FROM "user_skills")::int AS user_skills,
      (SELECT count(*) FROM "profiles" p, jsonb_each_text(p."skillRatings") AS r(key, value)
        WHERE r.value IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED') AND r.key = ANY(${LEGACY_SLUGS}))::int
        AS valid_rating_entries`;
  console.log(counts);
  if (counts.user_skills < counts.valid_rating_entries) {
    console.error("user_skills has fewer rows than valid skillRatings entries -- investigate before dropping the column.");
    process.exitCode = 1;
  } else {
    console.log("OK: every valid self-rating was copied.");
  }
}

main().finally(() => prisma.$disconnect());
