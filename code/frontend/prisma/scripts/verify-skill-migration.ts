// One-off check for the open_skill_catalog migration: every valid entry in
// the old profiles."skillRatings" JSON must have a matching user_skills row
// (the two split slugs need both rows). Checked per entry, not by totals, so
// a missing row can't be hidden by an unrelated extra one.
// Run: `npx tsx prisma/scripts/verify-skill-migration.ts`. Delete this file
// together with the skillRatings column (see README, "Deploying the open
// skill catalog").

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Old key -> new slug(s); mirrors the migration's mapping.
const MAPPING: [string, string][] = [
  ["javascript", "javascript"], ["typescript", "typescript"], ["python", "python"],
  ["java", "java"], ["cpp", "cpp"], ["go", "go"], ["react", "react"], ["nextjs", "nextjs"],
  ["nodejs", "nodejs"], ["flutter", "flutter"], ["react-native", "react-native"], ["sql", "sql"],
  ["docker", "docker"], ["kubernetes", "kubernetes"], ["aws", "aws"], ["git", "git"],
  ["figma", "figma"], ["solidity", "solidity"],
  ["pytorch-tensorflow", "pytorch"], ["pytorch-tensorflow", "tensorflow"],
  ["pandas-numpy", "pandas"], ["pandas-numpy", "numpy"],
];

async function main() {
  const oldSlugs = MAPPING.map(([o]) => o);
  const newSlugs = MAPPING.map(([, n]) => n);
  const missing = await prisma.$queryRaw<{ userId: string; key: string; slug: string }[]>`
    SELECT p."userId" AS "userId", r.key AS key, m.new_slug AS slug
    FROM "profiles" p
    CROSS JOIN LATERAL jsonb_each_text(p."skillRatings") AS r(key, value)
    JOIN unnest(${oldSlugs}::text[], ${newSlugs}::text[]) AS m(old_slug, new_slug) ON m.old_slug = r.key
    WHERE r.value IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')
      AND NOT EXISTS (
        SELECT 1 FROM "user_skills" us
        JOIN "skills" s ON s."id" = us."skillId"
        WHERE us."userId" = p."userId" AND s."slug" = m.new_slug
      )
    ORDER BY p."userId", r.key, m.new_slug`;

  if (missing.length === 0) {
    console.log("OK: every valid self-rating has its user_skills row(s).");
    return;
  }
  console.error(`${missing.length} skillRatings entr${missing.length === 1 ? "y has" : "ies have"} no user_skills row (showing up to 20):`);
  for (const row of missing.slice(0, 20)) console.error(`  userId=${row.userId} key=${row.key} -> ${row.slug}`);
  console.error("Investigate before dropping the column.");
  process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
