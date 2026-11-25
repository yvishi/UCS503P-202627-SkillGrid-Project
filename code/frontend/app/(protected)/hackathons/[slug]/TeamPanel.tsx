"use client";

import { useActionState } from "react";

import { Empty, SecondaryButton, SectionCard } from "@/app/ui/primitives";
import type { HackathonPhase } from "@/lib/team-rules";

import { setLookingForTeamAction, type TeamActionState } from "../../teams/actions";
import { CreateTeamForm, Hidden, MyTeamCard, Status, type TeamCardTeam } from "../../teams/TeamForms";

function LookingToggle({ hackathonId, slug, looking }: { hackathonId: string; slug: string; looking: boolean }) {
  const [state, toggle, saving] = useActionState<TeamActionState, FormData>(setLookingForTeamAction, null);
  return (
    <SectionCard title="Looking for a team">
      <form action={toggle} className="flex flex-col gap-3">
        <Hidden values={{ hackathonId, slug, looking: String(!looking) }} />
        <p className="text-sm text-ink-muted">
          {looking
            ? "You're listed as looking for a team, so team leads can find you."
            : "Let team leads know you're free to join a team."}
        </p>
        <SecondaryButton type="submit" disabled={saving} className="w-fit">
          {saving ? "Saving…" : looking ? "Stop looking" : "I'm looking for a team"}
        </SecondaryButton>
        <Status state={state} />
      </form>
    </SectionCard>
  );
}

export function TeamPanel({
  hackathon,
  lookingForTeam,
  myTeam,
}: {
  hackathon: { id: string; slug: string; name: string; teamSizeMax: number; phase: HackathonPhase };
  lookingForTeam: boolean;
  myTeam: TeamCardTeam | null;
}) {
  if (myTeam) return <MyTeamCard team={myTeam} hackathon={hackathon} />;
  if (hackathon.phase === "ended") return <Empty message="This hackathon has ended, and you weren't in a team." />;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <CreateTeamForm hackathon={hackathon} />
      <LookingToggle hackathonId={hackathon.id} slug={hackathon.slug} looking={lookingForTeam} />
    </div>
  );
}
