import type { Metadata } from "next";
import Link from "next/link";

import { Reveal } from "@/app/ui/motion";
import { Empty, Eyebrow, Pill } from "@/app/ui/primitives";
import { listHackathons, type HackathonSummary } from "@/lib/teams";

import { PHASE_LABEL, formatIst } from "./format";

export const metadata: Metadata = {
  title: "SkillGrid – Hackathons",
};

function HackathonRow({ hackathon }: { hackathon: HackathonSummary }) {
  return (
    <Link
      href={`/hackathons/${hackathon.slug}`}
      className="flex flex-col gap-2 rounded-theme-lg border border-border bg-surface p-5 transition-colors hover:border-trust"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink">{hackathon.name}</h2>
        <Pill tone={hackathon.phase === "running" ? "trust" : hackathon.phase === "upcoming" ? "warm" : "neutral"}>
          {PHASE_LABEL[hackathon.phase]}
        </Pill>
      </div>
      <p className="font-mono text-xs text-ink-muted">
        {formatIst(hackathon.startsAt)} to {formatIst(hackathon.endsAt)}
      </p>
      <p className="text-sm text-ink-muted">
        Teams of {hackathon.teamSizeMin} to {hackathon.teamSizeMax}
      </p>
    </Link>
  );
}

export default async function HackathonsPage() {
  const hackathons = await listHackathons();
  const open = hackathons.filter((h) => h.phase !== "ended");
  const ended = hackathons.filter((h) => h.phase === "ended");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header>
        <Eyebrow>Events</Eyebrow>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Hackathons</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">
          Pick a hackathon to start a team, or say you&apos;re looking for one.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <Eyebrow>Upcoming and running</Eyebrow>
        {open.length === 0 ? (
          <Empty message="No hackathons are open right now." />
        ) : (
          <ul className="flex flex-col gap-3">
            {open.map((h, i) => (
              <li key={h.id}>
                <Reveal delay={i * 0.05}>
                  <HackathonRow hackathon={h} />
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ended.length > 0 && (
        <section className="flex flex-col gap-3">
          <Eyebrow>Ended</Eyebrow>
          <ul className="flex flex-col gap-3">
            {ended.map((h) => (
              <li key={h.id}>
                <HackathonRow hackathon={h} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
