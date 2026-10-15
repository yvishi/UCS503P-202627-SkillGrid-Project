// Upserts the curated skill catalog (prisma/seed-data/skills.ts). Safe to
// re-run: existing rows are matched by slug and refreshed, and nothing is
// deleted. Run after migrating: `npx prisma db seed`.

import { PrismaClient } from "@prisma/client";

import { computeKeys } from "../lib/skill-catalog-core";
import { SEED_SKILLS } from "./seed-data/skills";

const prisma = new PrismaClient();

async function main() {
  for (const skill of SEED_SKILLS) {
    const aliases = skill.aliases ?? [];
    const data = {
      name: skill.name,
      aliases,
      keys: computeKeys(skill.slug, skill.name, aliases),
      category: skill.category,
      strictMatch: skill.strictMatch ?? false,
    };
    await prisma.skill.upsert({
      where: { slug: skill.slug },
      create: { slug: skill.slug, origin: "CURATED", ...data },
      update: data,
    });
  }
  console.log(`Seeded ${SEED_SKILLS.length} skills.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
