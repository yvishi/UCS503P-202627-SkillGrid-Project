import type { Metadata } from "next";

import { TEAM_FIXTURES } from "@/lib/dashboard-fixtures";
import { Reveal } from "@/app/ui/motion";
import { TeamCard } from "../MatchCards";
import { PageHeader, SampleNote } from "../PageHeader";

export const metadata: Metadata = {
  title: "SkillGrid – Find a Team",
};

export default function TeamsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Groups"
        title="Find a team"
        description="Teams with an open slot for a hackathon or project, and the roles they still need."
      />

      <SampleNote>
        These are sample teams. Real listings will appear here once team matching is live, and Apply
        to join doesn&apos;t send anything yet.
      </SampleNote>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEAM_FIXTURES.map((team, i) => (
          <li key={team.id}>
            <Reveal delay={i * 0.06} className="h-full">
              <TeamCard team={team} />
            </Reveal>
          </li>
        ))}
      </ul>
    </main>
  );
}
