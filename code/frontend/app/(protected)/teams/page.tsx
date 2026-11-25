import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { Reveal } from "@/app/ui/motion";
import { Empty, Eyebrow } from "@/app/ui/primitives";
import { findSkillNames } from "@/lib/skill-catalog";
import { hackathonsWithoutTeam, listMyTeams } from "@/lib/teams";

import { CreateTeamForm, MyTeamCard } from "./TeamForms";

export const metadata: Metadata = {
  title: "SkillGrid – My Teams",
};

// Every team the viewer is in, across hackathons, with their teammates.
// Leads list a team here (even a team of one) so others can ask to join it.
export default async function MyTeamsPage() {
  // The (protected) layout guarantees a signed-in, onboarded user.
  const userId = (await auth())!.user!.id!;
  const [teams, startable] = await Promise.all([listMyTeams(userId), hackathonsWithoutTeam(userId)]);
  const skillNames = await findSkillNames([...new Set(teams.flatMap((t) => t.lookingFor))]);

  const current = teams.filter((t) => t.hackathon.phase !== "ended");
  const past = teams.filter((t) => t.hackathon.phase === "ended");

  const card = (t: (typeof teams)[number]) => (
    <MyTeamCard
      showHackathon
      hackathon={t.hackathon}
      team={{ ...t, lookingFor: t.lookingFor.flatMap((s) => skillNames.get(s) ?? []) }}
    />
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header>
        <Eyebrow>Groups</Eyebrow>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">My teams</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">
          The teams you&apos;re in and who you&apos;re in them with. Start a team on your own and list it to find
          teammates.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <Eyebrow>Current</Eyebrow>
        {current.length === 0 ? (
          <Empty message="You're not in a team for any open hackathon yet." />
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {current.map((t, i) => (
              <li key={t.id}>
                <Reveal delay={Math.min(i, 6) * 0.06} className="h-full">
                  {card(t)}
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <Eyebrow>Start a team</Eyebrow>
        {startable.length === 0 ? (
          <Empty
            message={
              current.length > 0
                ? "You already have a team in every open hackathon."
                : "No hackathons are open right now."
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CreateTeamForm hackathons={startable} />
            <div className="flex flex-col gap-2 text-sm text-ink-muted">
              <p>
                You don&apos;t need teammates to start. Create the team with just you, say which skills you need,
                and list it. People browsing{" "}
                <Link href="/dashboard/teams" className="font-medium text-ink hover:text-trust">
                  Find a team
                </Link>{" "}
                can then ask to join, and their requests land in{" "}
                <Link href="/invites" className="font-medium text-ink hover:text-trust">
                  Invites
                </Link>
                .
              </p>
              <p>You can be in one team per hackathon.</p>
            </div>
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <Eyebrow>Past hackathons</Eyebrow>
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {past.map((t) => (
              <li key={t.id}>{card(t)}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
