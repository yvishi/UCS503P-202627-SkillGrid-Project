import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { Reveal } from "@/app/ui/motion";
import { Empty } from "@/app/ui/primitives";
import { findTeammates } from "@/lib/discovery";
import { parseTeammateFilters } from "@/lib/discovery-core";
import { prisma } from "@/lib/prisma";
import { TeammateCard } from "../MatchCards";
import { PageHeader } from "../PageHeader";
import { Filters } from "./Filters";

export const metadata: Metadata = {
  title: "SkillGrid – Find Teammates",
};

export default async function TeammatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The (protected) layout already guarantees a signed-in, onboarded user.
  const session = (await auth())!;
  const viewerId = session.user!.id!;
  const filters = parseTeammateFilters(await searchParams);

  const [{ items, hasMore }, hackathons] = await Promise.all([
    findTeammates(viewerId, filters),
    prisma.hackathon.findMany({
      where: { endsAt: { gt: new Date() } },
      orderBy: { startsAt: "asc" },
      select: { slug: true, name: true },
    }),
  ]);

  const next = new URLSearchParams();
  for (const s of filters.skills) next.append("skill", s);
  if (filters.interest) next.set("interest", filters.interest);
  if (filters.availability) next.set("availability", filters.availability);
  if (filters.hackathon) next.set("hackathon", filters.hackathon);
  next.set("page", String(filters.page + 1));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="People"
        title="Find teammates"
        description="Students at Thapar who are building a profile, with the evidence each one has on file."
      />

      <Filters filters={filters} hackathons={hackathons} />

      {items.length === 0 ? (
        <Empty message="No one matches these filters yet." />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((teammate, i) => (
            <li key={teammate.userId}>
              <Reveal delay={Math.min(i, 8) * 0.06} className="h-full">
                <TeammateCard teammate={teammate} />
              </Reveal>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <Link
          href={`/dashboard/teammates?${next.toString()}`}
          className="w-fit font-mono text-sm text-ink-muted transition-colors hover:text-trust"
        >
          Next page →
        </Link>
      )}
    </main>
  );
}
