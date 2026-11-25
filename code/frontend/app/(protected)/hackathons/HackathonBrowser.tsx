"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { Empty, Eyebrow, Pill, buttonBase, secondaryButtonClass } from "@/app/ui/primitives";
import type { HackathonPhase } from "@/lib/team-rules";

/** A hackathon pre-formatted on the server, so the client needs no date or feed logic. */
export type HackathonCard = {
  id: string;
  slug: string;
  name: string;
  phase: HackathonPhase;
  phaseLabel: string;
  dateRange: string;
  teamSize: string;
  origin: string | null;
};

// Each section shows this many cards until the user asks for the rest, so a
// long list of running hackathons can't push the past ones out of sight.
const COLLAPSED_COUNT = 4;

function matches(h: HackathonCard, terms: string[]): boolean {
  const haystack = `${h.name} ${h.origin ?? ""}`.toLowerCase();
  return terms.every((t) => haystack.includes(t));
}

function HackathonTile({ hackathon }: { hackathon: HackathonCard }) {
  return (
    <Link
      href={`/hackathons/${hackathon.slug}`}
      className="flex h-full flex-col gap-2 rounded-theme-lg border border-border bg-surface p-5 transition-colors hover:border-trust"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-ink">{hackathon.name}</h3>
        <Pill tone={hackathon.phase === "running" ? "trust" : hackathon.phase === "upcoming" ? "warm" : "neutral"}>
          {hackathon.phaseLabel}
        </Pill>
      </div>
      <p className="font-mono text-xs text-ink-muted">{hackathon.dateRange}</p>
      <p className="mt-auto text-sm text-ink-muted">
        {hackathon.teamSize}
        {hackathon.origin && <span> · {hackathon.origin}</span>}
      </p>
    </Link>
  );
}

function HackathonSection({
  title,
  items,
  emptyMessage,
  searching,
}: {
  title: string;
  items: HackathonCard[];
  emptyMessage: string;
  searching: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const visible = expanded ? items : items.slice(0, COLLAPSED_COUNT);
  const hidden = items.length - visible.length;

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${listId}-title`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`${listId}-title`}>
          <Eyebrow>{title}</Eyebrow>
        </h2>
        <span className="font-mono text-xs text-ink-muted">
          {items.length} {searching ? "matching" : "total"}
        </span>
      </div>

      {items.length === 0 ? (
        <Empty message={emptyMessage} />
      ) : (
        <>
          <ul id={listId} className="grid gap-3 sm:grid-cols-2">
            {visible.map((h) => (
              <li key={h.id}>
                <HackathonTile hackathon={h} />
              </li>
            ))}
          </ul>
          {items.length > COLLAPSED_COUNT && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-controls={listId}
              className={`${buttonBase} ${secondaryButtonClass} self-start`}
            >
              {expanded ? "Show fewer" : `Show all ${items.length} (${hidden} more)`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

export function HackathonBrowser({ hackathons }: { hackathons: HackathonCard[] }) {
  const [query, setQuery] = useState("");
  const inputId = useId();

  const terms = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query]);
  const searching = terms.length > 0;
  const filtered = useMemo(
    () => (searching ? hackathons.filter((h) => matches(h, terms)) : hackathons),
    [hackathons, terms, searching],
  );
  const open = filtered.filter((h) => h.phase !== "ended");
  const ended = filtered.filter((h) => h.phase === "ended");

  return (
    <div className="flex flex-col gap-8">
      <div role="search">
        <label htmlFor={inputId} className="sr-only">
          Search hackathons
        </label>
        <div className="relative">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="9" cy="9" r="6" />
            <path d="m14 14 4 4" strokeLinecap="round" />
          </svg>
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or location"
            autoComplete="off"
            className="w-full rounded-theme-md border border-border-strong bg-surface py-2.5 pl-10 pr-3.5 text-sm text-ink placeholder:text-ink-muted/70 focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/25"
          />
        </div>
        {searching && filtered.length === 0 && (
          <p className="mt-2 text-sm text-ink-muted" role="status">
            No hackathons match &ldquo;{query.trim()}&rdquo;.
          </p>
        )}
      </div>

      {/* Keyed on the query so each new search starts collapsed again. */}
      <HackathonSection
        key={`open-${query}`}
        title="Upcoming and running"
        items={open}
        searching={searching}
        emptyMessage={searching ? "No upcoming or running hackathons match." : "No hackathons are open right now."}
      />
      {(ended.length > 0 || searching) && (
        <HackathonSection
          key={`ended-${query}`}
          title="Past"
          items={ended}
          searching={searching}
          emptyMessage="No past hackathons match."
        />
      )}
    </div>
  );
}
