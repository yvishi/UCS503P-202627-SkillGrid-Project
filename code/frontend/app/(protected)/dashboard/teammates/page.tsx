import type { Metadata } from "next";

import { TEAMMATE_FIXTURES } from "@/lib/dashboard-fixtures";
import { Reveal } from "@/app/ui/motion";
import { TeammateCard } from "../MatchCards";
import { PageHeader, SampleNote } from "../PageHeader";

export const metadata: Metadata = {
  title: "SkillGrid – Find Teammates",
};

export default function TeammatesPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="People"
        title="Find teammates"
        description="Students at Thapar who are building a profile and looking for a team, with the evidence each one has on file."
      />

      <SampleNote>
        These are sample profiles. Real matches will appear here once teammate matching is live, and
        Invite doesn&apos;t send anything yet.
      </SampleNote>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEAMMATE_FIXTURES.map((teammate, i) => (
          <li key={teammate.id}>
            <Reveal delay={i * 0.06} className="h-full">
              <TeammateCard teammate={teammate} />
            </Reveal>
          </li>
        ))}
      </ul>
    </main>
  );
}
