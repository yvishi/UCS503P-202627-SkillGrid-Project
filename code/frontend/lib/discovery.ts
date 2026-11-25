import type { Prisma } from "@prisma/client";

import { PAGE_SIZE, headline, type TeamFilters, type TeammateFilters } from "@/lib/discovery-core";
import { prisma } from "@/lib/prisma";
import { findSkillNames } from "@/lib/skill-catalog";

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

export type TeamCardData = {
  id: string;
  name: string;
  hackathonName: string;
  hackathonSlug: string;
  lookingFor: string[]; // skill display names, not slugs
  members: string[];
  openSlots: number;
};

// Teams of unended hackathons that still have a seat, newest first, never
// including a team the viewer belongs to. The seat check compares the member
// count with the hackathon's teamSizeMax, which Prisma cannot filter on, so
// candidates are loaded and filtered here before paging. Fine at pilot scale.
export async function findOpenTeams(
  viewerId: string,
  f: TeamFilters,
): Promise<{ items: TeamCardData[]; hasMore: boolean }> {
  const page = Number.isFinite(f.page) ? Math.max(1, Math.floor(f.page)) : 1;

  const rows = await prisma.team.findMany({
    where: {
      hackathon: { endsAt: { gt: new Date() }, ...(f.hackathon ? { slug: f.hackathon } : {}) },
      members: { none: { userId: viewerId } },
      ...(f.skill ? { lookingFor: { has: f.skill } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      lookingFor: true,
      hackathon: { select: { name: true, slug: true, teamSizeMax: true } },
      members: {
        orderBy: { joinedAt: "asc" },
        select: { user: { select: { name: true } } },
      },
      _count: { select: { members: true } },
    },
  });

  const open = rows.filter((t) => t._count.members < t.hackathon.teamSizeMax);
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = open.slice(start, start + PAGE_SIZE);

  const names = await findSkillNames([...new Set(pageRows.flatMap((t) => t.lookingFor))]);

  return {
    items: pageRows.map((t) => ({
      id: t.id,
      name: t.name,
      hackathonName: t.hackathon.name,
      hackathonSlug: t.hackathon.slug,
      lookingFor: t.lookingFor.flatMap((slug) => {
        const name = names.get(slug);
        return name ? [name] : [];
      }),
      members: t.members.map((m) => m.user.name ?? "SkillGrid member"),
      openSlots: t.hackathon.teamSizeMax - t._count.members,
    })),
    hasMore: open.length > start + PAGE_SIZE,
  };
}

export type IdeaTeammate = TeammateCardData & { matchedSkills: string[] };

const IDEA_MATCH_LIMIT = 12;

// Onboarded users other than the viewer who hold at least one of `slugs`,
// ranked by how many of them they cover, then by the summed score on those
// skills. Unlike findTeammates (which needs every skill), this is for an
// idea's breakdown: no one person is expected to cover a whole project.
// Cards lead with the matched skills. Loads every match and sorts here,
// like findTeammates; fine at pilot scale.
export async function findTeammatesForSkills(
  viewerId: string,
  slugs: readonly string[],
): Promise<IdeaTeammate[]> {
  if (slugs.length === 0) return [];
  const rows = await prisma.profile.findMany({
    where: {
      onboardingCompletedAt: { not: null },
      userId: { not: viewerId },
      user: { skillScores: { some: { skill: { slug: { in: [...slugs] } } } } },
    },
    include,
  });
  return rows
    .map((row) => {
      const matched = row.user.skillScores
        .filter((s) => slugs.includes(s.skill.slug))
        .sort((a, b) => b.score - a.score);
      return { row, matched, total: matched.reduce((sum, s) => sum + s.score, 0) };
    })
    .sort(
      (a, b) =>
        b.matched.length - a.matched.length ||
        b.total - a.total ||
        (a.row.user.name ?? "").localeCompare(b.row.user.name ?? "") ||
        a.row.userId.localeCompare(b.row.userId),
    )
    .slice(0, IDEA_MATCH_LIMIT)
    .map(({ row, matched }) => {
      const matchedSkills = matched.map((s) => s.skill.name);
      return { ...toCard(row), tags: matchedSkills.slice(0, TAG_COUNT + 1), matchedSkills };
    });
}
