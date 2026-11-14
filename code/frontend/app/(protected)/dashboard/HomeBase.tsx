import Link from "next/link";

import { Reveal } from "@/app/ui/motion";
import { Eyebrow, buttonBase, primaryButtonClass } from "@/app/ui/primitives";
import type { MyHackathon, NeedsYouItem } from "@/lib/home-base";

import { formatIst } from "../hackathons/format";
import { GridPanel } from "./GridPanel";
import { NavTile } from "./NavTile";
import type { DashboardSkillGrid } from "./grid-data";

// The dashboard after the getting-started guide has ended. It reports
// what is live and lets the student choose: no steps, no order. The
// accent colour appears only under "Needs you".

function SectionHeading({ id, children, count }: { id: string; children: React.ReactNode; count?: number }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id}>
        <Eyebrow>{children}</Eyebrow>
      </h2>
      {count !== undefined && <span className="font-mono text-xs tabular-nums text-ink-muted">{count}</span>}
    </div>
  );
}

export function HomeBase({
  firstName,
  grid,
  needsYou,
  hackathons,
  peopleStat,
  teamStat,
}: {
  firstName: string;
  grid: DashboardSkillGrid;
  needsYou: NeedsYouItem[];
  hackathons: MyHackathon[];
  peopleStat: string;
  teamStat: string;
}) {
  const now = new Date();

  return (
    <>
      <header>
        <Eyebrow>Dashboard</Eyebrow>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Welcome back, {firstName}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">Here&apos;s where things stand.</p>
      </header>

      <Reveal>
        <GridPanel grid={grid} variant="hero" />
      </Reveal>

      {needsYou.length > 0 && (
        <section aria-labelledby="needs-you-heading">
          <SectionHeading id="needs-you-heading" count={needsYou.length}>
            Needs you
          </SectionHeading>
          <ul className="flex flex-col gap-2">
            {needsYou.map((item) => (
              <li
                key={item.key}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-theme-lg border border-border bg-surface px-5 py-3.5"
              >
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">{item.detail}</p>
                </div>
                <Link href={item.href} className={`${buttonBase} ${primaryButtonClass} px-3 py-2`}>
                  {item.action}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="your-hackathons-heading">
        <SectionHeading id="your-hackathons-heading">Your hackathons</SectionHeading>
        {hackathons.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {hackathons.map((h) => (
              <li key={h.slug}>
                <Link
                  href={`/hackathons/${h.slug}`}
                  className="group flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-theme-lg border border-border bg-surface px-5 py-3.5 transition-colors hover:border-border-strong"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{h.name}</p>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {h.startsAt > now ? `Starts ${formatIst(h.startsAt)}` : "Running now"}. {h.status}.
                    </p>
                  </div>
                  <span aria-hidden="true" className="font-mono text-sm text-ink-muted transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">
            You haven&apos;t joined a hackathon yet.{" "}
            <Link href="/hackathons" className="text-ink underline underline-offset-4 hover:text-trust">
              Browse hackathons
            </Link>
          </p>
        )}
      </section>

      <section aria-labelledby="explore-heading">
        <SectionHeading id="explore-heading">Explore</SectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NavTile
            href="/dashboard/teammates"
            eyebrow="People"
            title="Find teammates"
            description="Browse students building a profile and looking for a team."
            stat={peopleStat}
          />
          <NavTile
            href="/dashboard/teams"
            eyebrow="Teams"
            title="Find a team"
            description="Browse teams with an open slot for a hackathon that has not ended."
            stat={teamStat}
          />
        </div>
      </section>

      <p className="text-sm text-ink-muted">
        New here or need a refresher?{" "}
        <Link href="/dashboard?guide=1" className="text-ink underline underline-offset-4 hover:text-trust">
          How SkillGrid works
        </Link>
      </p>
    </>
  );
}
