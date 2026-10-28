import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { Reveal } from "@/app/ui/motion";
import { Empty } from "@/app/ui/primitives";
import { findOpenTeams } from "@/lib/discovery";
import { parseTeamFilters } from "@/lib/discovery-core";
import { prisma } from "@/lib/prisma";
import { TeamCard } from "../MatchCards";
import { PageHeader } from "../PageHeader";
import { Filters } from "./Filters";

export const metadata: Metadata = {
  title: "SkillGrid – Find a Team",
};

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The (protected) layout already guarantees a signed-in, onboarded user.
  const session = (await auth())!;
  const viewerId = session.user!.id!;
  const filters = parseTeamFilters(await searchParams);

  const [{ items, hasMore }, hackathons] = await Promise.all([
    findOpenTeams(viewerId, filters),
    prisma.hackathon.findMany({
      where: { endsAt: { gt: new Date() } },
      orderBy: { startsAt: "asc" },
      select: { slug: true, name: true },
    }),
  ]);

  const next = new URLSearchParams();
  if (filters.hackathon) next.set("hackathon", filters.hackathon);
  if (filters.skill) next.set("skill", filters.skill);
  next.set("page", String(filters.page + 1));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Groups"
        title="Find a team"
        description="Teams with an open slot for a hackathon that has not ended, and the skills they still need."
      />

      <Filters filters={filters} hackathons={hackathons} />

      {items.length === 0 ? (
        <Empty message="No open teams match these filters yet." />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((team, i) => (
            <li key={team.id}>
              <Reveal delay={Math.min(i, 8) * 0.06} className="h-full">
                <TeamCard team={team} />
              </Reveal>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <Link
          href={`/dashboard/teams?${next.toString()}`}
          className="w-fit font-mono text-sm text-ink-muted transition-colors hover:text-trust"
        >
          Next page →
        </Link>
      )}
    </main>
  );
}
