import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { Eyebrow, Pill, buttonBase, secondaryButtonClass } from "@/app/ui/primitives";
import { findSkillNames } from "@/lib/skill-catalog";
import { getHackathonView } from "@/lib/teams";

import { PHASE_LABEL, formatIst } from "../format";
import { TeamPanel } from "./TeamPanel";

export const metadata: Metadata = {
  title: "SkillGrid – Hackathon",
};

export default async function HackathonPage({ params }: PageProps<"/hackathons/[slug]">) {
  const { slug } = await params;
  // The (protected) layout guarantees a signed-in, onboarded user.
  const userId = (await auth())!.user!.id!;
  const view = await getHackathonView(userId, slug);
  if (!view) notFound();

  const { hackathon, myTeam, lookingForTeam, phase } = view;
  const skillNames = myTeam ? await findSkillNames(myTeam.lookingFor) : new Map<string, string>();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-4">
        <Link
          href="/hackathons"
          className="w-fit rounded-theme-sm font-mono text-xs text-ink-muted transition-colors hover:text-trust"
        >
          ← Hackathons
        </Link>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Eyebrow>Hackathon</Eyebrow>
            <Pill tone={phase === "running" ? "trust" : phase === "upcoming" ? "warm" : "neutral"}>
              {PHASE_LABEL[phase]}
            </Pill>
          </div>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{hackathon.name}</h1>
          <p className="mt-2 font-mono text-xs text-ink-muted">
            {formatIst(hackathon.startsAt)} to {formatIst(hackathon.endsAt)}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Teams of {hackathon.teamSizeMin} to {hackathon.teamSizeMax}
          </p>
        </div>
        {phase === "ended" && myTeam && (
          <Link href={`/hackathons/${hackathon.slug}/feedback`} className={`${buttonBase} ${secondaryButtonClass} w-fit`}>
            Give feedback
          </Link>
        )}
      </header>

      <TeamPanel
        hackathonId={hackathon.id}
        slug={hackathon.slug}
        teamSizeMax={hackathon.teamSizeMax}
        ended={phase === "ended"}
        lookingForTeam={lookingForTeam}
        myTeam={myTeam && { ...myTeam, lookingFor: myTeam.lookingFor.map((s) => skillNames.get(s) ?? s) }}
      />
    </main>
  );
}
