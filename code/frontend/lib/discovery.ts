import type { Prisma } from "@prisma/client";

import { PAGE_SIZE, headline, type TeammateFilters } from "@/lib/discovery-core";
import { prisma } from "@/lib/prisma";

export type TeammateCardData = {
  userId: string;
  name: string;
  image: string | null;
  headline: string;
  tags: string[];
  evidenceScore: number;
};

const TAG_COUNT = 3;

const include = {
  user: {
    select: {
      id: true,
      name: true,
      image: true,
      skillScores: {
        select: { score: true, skill: { select: { slug: true, name: true } } },
      },
    },
  },
} satisfies Prisma.ProfileInclude;

type Row = Prisma.ProfileGetPayload<{ include: typeof include }>;

function toCard(row: Row): TeammateCardData {
  const skills = row.user.skillScores
    .map((s) => ({ name: s.skill.name, score: s.score }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return {
    userId: row.userId,
    name: row.user.name ?? "SkillGrid member",
    image: row.user.image,
    headline: headline(skills),
    tags: skills.slice(0, TAG_COUNT).map((s) => s.name),
    evidenceScore: row.evidenceScore,
  };
}

// Onboarded users other than the viewer, filtered by the parsed query.
// Unknown skill or hackathon slugs are dropped (not matched against) so a
// stale link shows the unfiltered list instead of an empty page.
export async function findTeammates(
  viewerId: string,
  f: TeammateFilters,
): Promise<{ items: TeammateCardData[]; hasMore: boolean }> {
  const page = Number.isFinite(f.page) ? Math.max(1, Math.floor(f.page)) : 1;

  const [knownSkills, hackathon] = await Promise.all([
    f.skills.length
      ? prisma.skill.findMany({ where: { slug: { in: f.skills } }, select: { slug: true } })
      : Promise.resolve([]),
    f.hackathon
      ? prisma.hackathon.findUnique({ where: { slug: f.hackathon }, select: { slug: true } })
      : Promise.resolve(null),
  ]);
  const slugs = knownSkills.map((s) => s.slug);

  const where: Prisma.ProfileWhereInput = {
    onboardingCompletedAt: { not: null },
    userId: { not: viewerId },
    ...(f.interest ? { interestTags: { has: f.interest } } : {}),
    ...(f.availability ? { availability: f.availability } : {}),
    user: {
      // One `some` per slug: the user must hold every filtered skill.
      AND: [
        ...slugs.map((slug) => ({ skillScores: { some: { skill: { slug } } } })),
        ...(hackathon
          ? [{ participations: { some: { hackathon: { slug: hackathon.slug }, lookingForTeam: true } } }]
          : []),
      ],
    },
  };

  if (slugs.length === 0) {
    const rows = await prisma.profile.findMany({
      where,
      include,
      orderBy: [{ evidenceScore: "desc" }, { user: { name: "asc" } }, { userId: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
    });
    return { items: rows.slice(0, PAGE_SIZE).map(toCard), hasMore: rows.length > PAGE_SIZE };
  }

  // Ranking by the sum of the matched skills' scores is not expressible in
  // Prisma, so load every match and sort here. Fine for a pilot of ~20
  // users; revisit (raw SQL with SUM + LIMIT) before the user base grows.
  const rows = await prisma.profile.findMany({ where, include });
  const ranked = rows
    .map((row) => ({
      row,
      matched: row.user.skillScores
        .filter((s) => slugs.includes(s.skill.slug))
        .reduce((sum, s) => sum + s.score, 0),
    }))
    .sort(
      (a, b) =>
        b.matched - a.matched ||
        (a.row.user.name ?? "").localeCompare(b.row.user.name ?? "") ||
        a.row.userId.localeCompare(b.row.userId),
    );
  const start = (page - 1) * PAGE_SIZE;
  return {
    items: ranked.slice(start, start + PAGE_SIZE).map((r) => toCard(r.row)),
    hasMore: ranked.length > start + PAGE_SIZE,
  };
}
