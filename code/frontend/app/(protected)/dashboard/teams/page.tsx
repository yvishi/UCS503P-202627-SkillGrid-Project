import type { Metadata } from "next";
import Link from "next/link";

import { TEAM_FIXTURES } from "@/lib/dashboard-fixtures";
import { Eyebrow } from "@/app/ui/primitives";
import { TeamCard } from "../MatchCards";

export const metadata: Metadata = {
  title: "SkillGrid – Find a Team",
};

export default function TeamsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <Link
          href="/dashboard"
          className="font-display text-sm font-medium text-ink-muted transition hover:text-trust"
        >
          ← Dashboard
        </Link>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <Eyebrow>Groups</Eyebrow>
            <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight">
              Find a team
            </h1>
          </div>
          <span className="text-xs text-ink-muted">Sample listing</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TEAM_FIXTURES.map((team) => (
          <TeamCard key={team.id} team={team} />
        ))}
      </div>
    </main>
  );
}
