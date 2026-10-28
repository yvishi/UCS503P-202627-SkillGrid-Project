import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Empty, Eyebrow } from "@/app/ui/primitives";
import { getAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

import { HackathonForm } from "./HackathonForm";

export const metadata: Metadata = {
  title: "SkillGrid – Hackathons",
};

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short",
});

// Access is enforced by app/admin/layout.tsx, re-checked here and in the action.
export default async function AdminHackathonsPage() {
  if (!(await getAdminUser())) notFound();
  const hackathons = await prisma.hackathon.findMany({
    orderBy: { startsAt: "desc" },
    include: { _count: { select: { teams: true } } },
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header>
        <Eyebrow>Admin</Eyebrow>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">Hackathons</h1>
        <p className="mt-2 text-sm text-ink-muted">Students form teams and send invitations inside a hackathon.</p>
      </header>

      <HackathonForm />

      {hackathons.length === 0 ? (
        <Empty message="No hackathons yet." />
      ) : (
        <ul className="flex flex-col gap-3">
          {hackathons.map((h) => (
            <li key={h.id} className="rounded-theme-lg border border-border bg-surface px-5 py-4">
              <h2 className="text-lg font-semibold text-ink">{h.name}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {dateFormat.format(h.startsAt)} to {dateFormat.format(h.endsAt)} IST
              </p>
              <p className="mt-1 font-mono text-xs text-ink-muted">
                Teams of {h.teamSizeMin === h.teamSizeMax ? h.teamSizeMin : `${h.teamSizeMin} to ${h.teamSizeMax}`} ·{" "}
                {h._count.teams} {h._count.teams === 1 ? "team" : "teams"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
