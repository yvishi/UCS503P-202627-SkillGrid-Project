"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Avatar } from "@/app/ui/Avatar";
import { EvidenceStrip } from "@/app/ui/EvidenceGrid";
import { Eyebrow, Pill, PrimaryButton, SecondaryButton, SectionCard } from "@/app/ui/primitives";
import type { HackathonPhase } from "@/lib/team-rules";
import type { TeamMemberView } from "@/lib/teams";

import {
  createTeamAction,
  leaveTeamAction,
  setTeamListingAction,
  type TeamActionState,
} from "./actions";

// Team UI shared by the hackathon page (one team) and /teams (all of them).

export const inputClass =
  "rounded-theme-sm border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/25";

export type TeamCardTeam = {
  id: string;
  name: string;
  role: "LEAD" | "MEMBER";
  description: string | null;
  lookingFor: string[]; // display names
  listed: boolean;
  members: TeamMemberView[];
  pendingRequests: number;
};

export type TeamCardHackathon = { slug: string; name: string; teamSizeMax: number; phase: HackathonPhase };

export function Status({ state }: { state: TeamActionState }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-sm ${state.ok ? "text-trust-strong" : "text-danger"}`}>
      {state.message}
    </p>
  );
}

export function Hidden({ values }: { values: Record<string, string> }) {
  return (
    <>
      {Object.entries(values).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

function LookingForFields({ description, lookingFor }: { description: string | null; lookingFor: string[] }) {
  return (
    <>
      <label className="flex flex-col gap-1 text-xs font-medium text-ink">
        What you&apos;re building (optional)
        <textarea name="description" maxLength={500} rows={3} defaultValue={description ?? ""} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-ink">
        Skills you&apos;re looking for (comma-separated, up to 5)
        <input
          name="lookingFor"
          placeholder="React, Python, Figma"
          defaultValue={lookingFor.join(", ")}
          className={inputClass}
        />
        <span className="font-normal text-ink-muted">Skills that aren&apos;t in the catalog are left out.</span>
      </label>
    </>
  );
}

/** Where the team stands in "Find a team", in one line. */
function listingNote(listed: boolean, openSeats: number): string {
  if (!listed) return "Not listed. Only people you invite can join.";
  if (openSeats === 0) return "Listed, but full, so it's hidden from Find a team until a seat opens.";
  return `Listed in Find a team with ${openSeats} open ${openSeats === 1 ? "seat" : "seats"}.`;
}

/** The lead lists the team (with what it needs), edits the listing, or takes it down. */
function ListingControls({ team, slug, openSeats }: { team: TeamCardTeam; slug: string; openSeats: number }) {
  const [state, save, saving] = useActionState<TeamActionState, FormData>(setTeamListingAction, null);
  const [unlistState, unlist, unlisting] = useActionState<TeamActionState, FormData>(setTeamListingAction, null);
  const keep = { teamId: team.id, slug, description: team.description ?? "", lookingFor: team.lookingFor.join(",") };

  const form = (
    <form action={save} className="flex flex-col gap-3">
      <Hidden values={{ teamId: team.id, slug, listed: "on" }} />
      <LookingForFields description={team.description} lookingFor={team.lookingFor} />
      <PrimaryButton type="submit" disabled={saving} className="w-fit">
        {saving ? "Saving…" : team.listed ? "Save listing" : "List team"}
      </PrimaryButton>
    </form>
  );

  return (
    <div className="flex flex-col gap-3 rounded-theme-md border border-border bg-surface-alt p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>Listing</Eyebrow>
        <Pill tone={team.listed ? "trust" : "neutral"}>{team.listed ? "Listed" : "Not listed"}</Pill>
      </div>
      <p className="text-sm text-ink-muted">{listingNote(team.listed, openSeats)}</p>
      {team.listed ? (
        <>
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-ink hover:text-trust">Edit listing</summary>
            <div className="mt-3">{form}</div>
          </details>
          <form action={unlist}>
            <Hidden values={keep} />
            <SecondaryButton type="submit" disabled={unlisting} className="w-fit">
              {unlisting ? "Saving…" : "Unlist team"}
            </SecondaryButton>
          </form>
        </>
      ) : (
        <>
          <p className="text-sm text-ink">
            List your team so people looking for one can find it and ask to join.
          </p>
          {form}
        </>
      )}
      <Status state={state ?? unlistState} />
    </div>
  );
}

/** One team the viewer is in: who is on it, where it is listed, and what they can do. */
export function MyTeamCard({
  team,
  hackathon,
  showHackathon = false,
}: {
  team: TeamCardTeam;
  hackathon: TeamCardHackathon;
  showHackathon?: boolean;
}) {
  const [state, leave, leaving] = useActionState<TeamActionState, FormData>(leaveTeamAction, null);
  const ended = hackathon.phase === "ended";
  const openSeats = Math.max(0, hackathon.teamSizeMax - team.members.length);
  const isLead = team.role === "LEAD";
  const lastMember = team.members.length === 1;
  const leaveHint = lastMember
    ? "You're the only member, so leaving deletes the team."
    : isLead
      ? "If you leave, the member who joined earliest becomes lead."
      : "You can join or start another team after leaving.";

  return (
    <SectionCard
      title={showHackathon ? hackathon.name : "Your team"}
      action={
        <span className="font-mono text-xs text-ink-muted">
          {team.members.length} of {hackathon.teamSizeMax}
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-ink">{team.name}</h2>
            {isLead && <Pill tone="trust">You lead</Pill>}
            {showHackathon && ended && <Pill>Ended</Pill>}
          </div>
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

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <Eyebrow>{lastMember ? "Just you so far" : "Teammates"}</Eyebrow>
            <EvidenceStrip
              levels={Array.from({ length: hackathon.teamSizeMax }, (_, i) => (i < team.members.length ? 4 : 0))}
              label={`${team.members.length} of ${hackathon.teamSizeMax} seats filled`}
            />
          </div>
          <ul className="flex flex-col gap-2">
            {team.members.map((m) => (
              <li key={m.userId} className="flex items-center gap-3">
                <Avatar name={m.name} image={m.image} size="h-8 w-8 text-xs" />
                <span className="text-sm text-ink">{m.name}</span>
                {m.role === "LEAD" && <Pill tone="trust">Lead</Pill>}
              </li>
            ))}
          </ul>
        </div>

        {isLead && team.pendingRequests > 0 && !ended && (
          <Link href="/invites" className="w-fit text-sm font-medium text-trust-strong hover:underline">
            {team.pendingRequests} join {team.pendingRequests === 1 ? "request" : "requests"} waiting →
          </Link>
        )}

        {isLead && !ended && (
          <>
            <ListingControls team={team} slug={hackathon.slug} openSeats={openSeats} />
            {openSeats > 0 && (
              <Link
                href={`/dashboard/teammates?hackathon=${encodeURIComponent(hackathon.slug)}`}
                className="w-fit text-sm font-medium text-ink-muted hover:text-trust"
              >
                Browse people looking for a team →
              </Link>
            )}
          </>
        )}

        {!isLead && !ended && (
          <p className="text-xs text-ink-muted">
            {team.listed ? "Your lead has listed this team." : "Your lead hasn't listed this team."}
          </p>
        )}

        {showHackathon && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <Link href={`/hackathons/${hackathon.slug}`} className="text-sm font-medium text-ink-muted hover:text-trust">
              Open hackathon →
            </Link>
            {ended && (
              <Link
                href={`/hackathons/${hackathon.slug}/feedback`}
                className="text-sm font-medium text-ink-muted hover:text-trust"
              >
                Give feedback →
              </Link>
            )}
          </div>
        )}

        {!ended && (
          <form action={leave} className="flex flex-col gap-2">
            <Hidden values={{ teamId: team.id, slug: hackathon.slug }} />
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

/**
 * Starts a team with the viewer as its only member. With one hackathon fixed (the hackathon page)
 * it posts that id; otherwise (the /teams page) the viewer picks from `hackathons`.
 */
export function CreateTeamForm({
  hackathon,
  hackathons,
}: {
  hackathon?: { id: string; slug: string };
  hackathons?: { id: string; slug: string; name: string }[];
}) {
  const [state, create, creating] = useActionState<TeamActionState, FormData>(createTeamAction, null);
  const choices = hackathons ?? [];
  return (
    <SectionCard title="Start a team">
      <form action={create} className="flex flex-col gap-3">
        {hackathon ? (
          <Hidden values={{ hackathonId: hackathon.id, slug: hackathon.slug }} />
        ) : (
          <label className="flex flex-col gap-1 text-xs font-medium text-ink">
            Hackathon
            <select name="hackathonId" required className={inputClass} defaultValue={choices[0]?.id}>
              {choices.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs font-medium text-ink">
          Team name
          <input name="name" required minLength={2} maxLength={60} className={inputClass} />
        </label>
        <LookingForFields description={null} lookingFor={[]} />
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" name="listed" defaultChecked className="mt-1 accent-[var(--trust)]" />
          <span>
            List it in Find a team now
            <span className="block text-xs text-ink-muted">
              You start as the only member. Listing lets others find the team and ask to join.
            </span>
          </span>
        </label>
        <PrimaryButton type="submit" disabled={creating} className="w-fit">
          {creating ? "Creating…" : "Create team"}
        </PrimaryButton>
        <Status state={state} />
      </form>
    </SectionCard>
  );
}
