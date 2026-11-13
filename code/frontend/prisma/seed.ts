// Upserts the curated skill catalog (prisma/seed-data/skills.ts). Safe to
// re-run: existing rows are matched by slug and refreshed, and nothing is
// deleted and admin-added aliases/keys are kept. Run after migrating: `npx prisma db seed`.

import { PrismaClient } from "@prisma/client";

import { computeKeys } from "../lib/skill-catalog-core";
import { SEED_SKILLS } from "./seed-data/skills";

const prisma = new PrismaClient();

async function main() {
  for (const skill of SEED_SKILLS) {
    const seeded = skill.aliases ?? [];
    const base = {
      name: skill.name,
      category: skill.category,
      strictMatch: skill.strictMatch ?? false,
    };
    // Aliases and keys an admin added (Merge "also add as alias", approved
    // requests) must survive a re-seed: take the union with the existing row.
    const existing = await prisma.skill.findUnique({
      where: { slug: skill.slug },
      select: { aliases: true, keys: true },
    });
    const aliases = Array.from(new Set([...(existing?.aliases ?? []), ...seeded]));
    const keys = Array.from(
      new Set([...(existing?.keys ?? []), ...computeKeys(skill.slug, skill.name, aliases)]),
    );
    await prisma.skill.upsert({
      where: { slug: skill.slug },
      create: { slug: skill.slug, origin: "CURATED", ...base, aliases, keys },
      update: { ...base, aliases, keys },
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
