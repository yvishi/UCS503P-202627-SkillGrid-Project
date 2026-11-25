import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Empty, Eyebrow, Pill } from "@/app/ui/primitives";
import { getAdminUser } from "@/lib/admin";
import { SOURCE_LABEL, isFeedSource } from "@/lib/hackathon-feeds-core";
import { prisma } from "@/lib/prisma";

import { publishAllPendingAction, setVisibilityAction } from "./actions";
import { HackathonForm } from "./HackathonForm";
import { SyncButton } from "./SyncButton";

export const metadata: Metadata = {
  title: "SkillGrid – Hackathons",
};

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short",
});

const smallButton =
  "rounded-theme-sm border border-border-strong bg-surface px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-ink hover:bg-surface-alt";

type Row = {
  id: string;
  slug: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  teamSizeMin: number;
  teamSizeMax: number;
  source: string | null;
  url: string | null;
  location: string | null;
  visibility: "PUBLISHED" | "PENDING" | "HIDDEN";
  _count: { teams: number };
};

function VisibilityButton({ id, to, label }: { id: string; to: Row["visibility"]; label: string }) {
  return (
    <form action={setVisibilityAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="visibility" value={to} />
      <button type="submit" className={smallButton}>
        {label}
      </button>
    </form>
  );
}

function HackathonItem({ h }: { h: Row }) {
  const source = isFeedSource(h.source) ? SOURCE_LABEL[h.source] : "Admin";
  return (
    <li className="flex flex-col gap-2 rounded-theme-lg border border-border bg-surface px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-ink">
            {h.visibility === "PENDING" ? (
              h.name
            ) : (
              <Link href={`/hackathons/${h.slug}`} className="hover:text-trust">
                {h.name}
              </Link>
            )}
          </h3>
          <Pill tone={h.source ? "warm" : "neutral"}>{source}</Pill>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {dateFormat.format(h.startsAt)} to {dateFormat.format(h.endsAt)} IST
        </p>
        <p className="mt-1 font-mono text-xs text-ink-muted">
          Teams of {h.teamSizeMin === h.teamSizeMax ? h.teamSizeMin : `${h.teamSizeMin} to ${h.teamSizeMax}`} ·{" "}
          {h._count.teams} {h._count.teams === 1 ? "team" : "teams"}
          {h.location && ` · ${h.location}`}
          {h.url && (
            <>
              {" · "}
              <a href={h.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                source ↗
              </a>
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {h.visibility === "PENDING" && <VisibilityButton id={h.id} to="PUBLISHED" label="Publish" />}
        {h.visibility !== "HIDDEN" && <VisibilityButton id={h.id} to="HIDDEN" label="Hide" />}
        {h.visibility === "HIDDEN" && <VisibilityButton id={h.id} to="PUBLISHED" label="Restore" />}
      </div>
    </li>
  );
}

function Group({
  title,
  rows,
  empty,
  action,
}: {
  title: string;
  rows: Row[];
  empty: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>
          {title} ({rows.length})
        </Eyebrow>
        {action}
      </div>
      {rows.length === 0 ? (
        <Empty message={empty} />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((h) => (
            <HackathonItem key={h.id} h={h} />
          ))}
        </ul>
      )}
    </section>
  );
}

// Access is enforced by app/admin/layout.tsx, re-checked here and in the actions.
export default async function AdminHackathonsPage() {
  if (!(await getAdminUser())) notFound();
  // Imported hackathons that have ended are only clutter here; admin-created ones stay listed.
  const hackathons: Row[] = await prisma.hackathon.findMany({
    where: { OR: [{ source: null }, { endsAt: { gt: new Date() } }] },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      startsAt: true,
      endsAt: true,
      teamSizeMin: true,
      teamSizeMax: true,
      source: true,
      url: true,
      location: true,
      visibility: true,
      _count: { select: { teams: true } },
    },
  });
  const pending = hackathons.filter((h) => h.visibility === "PENDING");
  const published = hackathons.filter((h) => h.visibility === "PUBLISHED");
  const hidden = hackathons.filter((h) => h.visibility === "HIDDEN");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header>
        <Eyebrow>Admin</Eyebrow>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">Hackathons</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Open hackathons are imported daily from Devfolio, Unstop and Devpost. Imports from auto-published sources
          go live straight away; the rest wait below for you to publish or hide. Hidden ones stay hidden on later
          syncs.
        </p>
      </header>

      <SyncButton />

      <Group
        title="Pending review"
        rows={pending}
        empty="Nothing waiting for review."
        action={
          pending.length > 0 && (
            <form action={publishAllPendingAction}>
              <button type="submit" className={smallButton}>
                Publish all {pending.length}
              </button>
            </form>
          )
        }
      />

      <Group title="Published" rows={published} empty="No hackathons are live." />

      {hidden.length > 0 && <Group title="Hidden" rows={hidden} empty="" />}

      <details className="rounded-theme-lg border border-border bg-surface">
        <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-ink">Add a hackathon by hand</summary>
        <div className="px-1 pb-1">
          <HackathonForm />
        </div>
      </details>
    </main>
  );
}
