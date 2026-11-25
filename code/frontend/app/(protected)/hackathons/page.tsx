import type { Metadata } from "next";

import { Eyebrow } from "@/app/ui/primitives";
import { listHackathons } from "@/lib/teams";

import { HackathonBrowser, type HackathonCard } from "./HackathonBrowser";
import { PHASE_LABEL, formatIst, originLine } from "./format";

export const metadata: Metadata = {
  title: "SkillGrid – Hackathons",
};

export default async function HackathonsPage() {
  const hackathons = await listHackathons();
  // Format on the server (IST dates, feed labels) and hand the client plain strings.
  const cards: HackathonCard[] = hackathons.map((h) => ({
    id: h.id,
    slug: h.slug,
    name: h.name,
    phase: h.phase,
    phaseLabel: PHASE_LABEL[h.phase],
    dateRange: `${formatIst(h.startsAt)} to ${formatIst(h.endsAt)}`,
    teamSize: `Teams of ${h.teamSizeMin} to ${h.teamSizeMax}`,
    origin: originLine(h),
  }));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header>
        <Eyebrow>Events</Eyebrow>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Hackathons</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">
          Pick a hackathon to start a team, or say you&apos;re looking for one.
        </p>
      </header>

      <HackathonBrowser hackathons={cards} />
    </main>
  );
}
