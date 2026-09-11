import { Avatar } from "@/app/ui/Avatar";
import { Pill, ProgressBar, SecondaryButton } from "@/app/ui/primitives";
import type { TeamFixture, TeammateFixture } from "@/lib/dashboard-fixtures";

export function TeammateCard({ teammate }: { teammate: TeammateFixture }) {
  return (
    <div className="flex items-center gap-4 border border-line bg-paper-raised p-4">
      <Avatar name={teammate.name} image={null} size="h-11 w-11 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="font-display truncate text-sm font-semibold">{teammate.name}</p>
        <p className="truncate text-xs text-ink-muted">{teammate.headline}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {teammate.tags.map((tag) => (
            <Pill key={tag}>{tag}</Pill>
          ))}
        </div>
      </div>
      <div className="flex w-28 shrink-0 flex-col items-end gap-1.5">
        <span className="font-display text-xs text-ink-muted">{teammate.strength}% on file</span>
        <ProgressBar fraction={teammate.strength / 100} />
        <SecondaryButton type="button" className="mt-1 w-full px-2 py-1.5 text-[11px]">
          Invite
        </SecondaryButton>
      </div>
    </div>
  );
}

export function TeamCard({ team }: { team: TeamFixture }) {
  return (
    <div className="flex flex-col gap-3 border border-line bg-paper-raised p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-sm font-semibold">{team.name}</p>
          <p className="text-xs text-ink-muted">{team.event}</p>
        </div>
        <span className="font-display shrink-0 border border-line-strong px-2 py-0.5 text-[11px]">
          {team.openSlots} open
        </span>
      </div>
      <div>
        <p className="mb-1.5 text-xs text-ink-muted">Looking for</p>
        <div className="flex flex-wrap gap-1.5">
          {team.lookingFor.map((tag) => (
            <Pill key={tag}>{tag}</Pill>
          ))}
        </div>
      </div>
      <p className="text-xs text-ink-muted">Members: {team.members.join(", ")}</p>
      <SecondaryButton type="button" className="w-full px-2 py-1.5 text-[11px]">
        Apply to join
      </SecondaryButton>
    </div>
  );
}
