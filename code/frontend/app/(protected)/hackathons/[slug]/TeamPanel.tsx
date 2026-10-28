"use client";

import { useActionState } from "react";

import { Avatar } from "@/app/ui/Avatar";
import { Empty, Pill, PrimaryButton, SecondaryButton, SectionCard } from "@/app/ui/primitives";
import type { TeamMemberView } from "@/lib/teams";

import { createTeamAction, leaveTeamAction, setLookingForTeamAction, type TeamActionState } from "./actions";

const inputClass =
  "rounded-theme-sm border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/25";

type MyTeam = {
  id: string;
  name: string;
  role: "LEAD" | "MEMBER";
  description: string | null;
  lookingFor: string[]; // display names
  members: TeamMemberView[];
};

function Status({ state }: { state: TeamActionState }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-sm ${state.ok ? "text-trust-strong" : "text-danger"}`}>
      {state.message}
    </p>
  );
}

function Hidden({ values }: { values: Record<string, string> }) {
  return (
    <>
      {Object.entries(values).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

function TeamCard({
  team,
  slug,
  teamSizeMax,
  ended,
}: {
  team: MyTeam;
  slug: string;
  teamSizeMax: number;
  ended: boolean;
}) {
  const [state, leave, leaving] = useActionState<TeamActionState, FormData>(leaveTeamAction, null);
  const lastMember = team.members.length === 1;
  const leaveHint = lastMember
    ? "You're the only member, so leaving deletes the team."
    : team.role === "LEAD"
      ? "If you leave, the member who joined earliest becomes lead."
      : "You can join or start another team after leaving.";

  return (
    <SectionCard
      title="Your team"
      action={
        <span className="font-mono text-xs text-ink-muted">
          {team.members.length} of {teamSizeMax}
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">{team.name}</h2>
          {team.description && <p className="mt-1 text-sm text-ink-muted">{team.description}</p>}
        </div>
        {team.lookingFor.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-ink-muted">Looking for</span>
            {team.lookingFor.map((name) => (
              <Pill key={name}>{name}</Pill>
            ))}
          </div>
        )}
        <ul className="flex flex-col gap-2">
          {team.members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3">
              <Avatar name={m.name} image={m.image} size="h-8 w-8 text-xs" />
              <span className="text-sm text-ink">{m.name}</span>
              {m.role === "LEAD" && <Pill tone="trust">Lead</Pill>}
            </li>
          ))}
        </ul>
        {!ended && (
          <form action={leave} className="flex flex-col gap-2">
            <Hidden values={{ teamId: team.id, slug }} />
            <p className="text-xs text-ink-muted">{leaveHint}</p>
            <SecondaryButton type="submit" disabled={leaving} className="w-fit">
              {leaving ? "Leaving…" : "Leave team"}
            </SecondaryButton>
          </form>
        )}
        <Status state={state} />
      </div>
    </SectionCard>
  );
}

function CreateTeamForm({ hackathonId, slug }: { hackathonId: string; slug: string }) {
  const [state, create, creating] = useActionState<TeamActionState, FormData>(createTeamAction, null);
  return (
    <SectionCard title="Create a team">
      <form action={create} className="flex flex-col gap-3">
        <Hidden values={{ hackathonId, slug }} />
        <label className="flex flex-col gap-1 text-xs font-medium text-ink">
          Team name
          <input name="name" required minLength={2} maxLength={60} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-ink">
          What you&apos;re building (optional)
          <textarea name="description" maxLength={500} rows={3} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-ink">
          Skills you&apos;re looking for (comma-separated, up to 5)
          <input name="lookingFor" placeholder="React, Python, Figma" className={inputClass} />
          <span className="font-normal text-ink-muted">Skills that aren&apos;t in the catalog are left out.</span>
        </label>
        <PrimaryButton type="submit" disabled={creating} className="w-fit">
          {creating ? "Creating…" : "Create team"}
        </PrimaryButton>
        <Status state={state} />
      </form>
    </SectionCard>
  );
}

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
  hackathonId,
  slug,
  teamSizeMax,
  ended,
  lookingForTeam,
  myTeam,
}: {
  hackathonId: string;
  slug: string;
  teamSizeMax: number;
  ended: boolean;
  lookingForTeam: boolean;
  myTeam: MyTeam | null;
}) {
  if (myTeam) return <TeamCard team={myTeam} slug={slug} teamSizeMax={teamSizeMax} ended={ended} />;
  if (ended) return <Empty message="This hackathon has ended, and you weren't in a team." />;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <CreateTeamForm hackathonId={hackathonId} slug={slug} />
      <LookingToggle hackathonId={hackathonId} slug={slug} looking={lookingForTeam} />
    </div>
  );
}
