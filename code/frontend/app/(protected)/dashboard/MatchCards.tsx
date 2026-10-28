import { Avatar } from "@/app/ui/Avatar";
import { EvidenceStrip, type CellLevel } from "@/app/ui/EvidenceGrid";
import { Eyebrow, Pill } from "@/app/ui/primitives";
import type { TeamCardData, TeammateCardData } from "@/lib/discovery";

const STRIP_CELLS = 8;

// Turns a 0-100 evidence score into a strip of cells: one cell per
// 12.5 points, ramping up the heat scale left to right so a stronger
// profile reads as a longer, darker run.
function strengthLevels(strength: number): CellLevel[] {
  const filled = Math.round((Math.min(100, Math.max(0, strength)) / 100) * STRIP_CELLS);
  return Array.from({ length: STRIP_CELLS }, (_, i) =>
    i < filled ? (Math.min(4, 1 + Math.floor(i / 2)) as CellLevel) : 0,
  );
}

const cardClass = "flex h-full flex-col gap-4 rounded-theme-lg border border-border bg-surface p-5";

export function TeammateCard({
  teammate,
  action,
}: {
  teammate: TeammateCardData;
  action?: React.ReactNode;
}) {
  return (
    <article className={cardClass}>
      <div className="flex items-start gap-3">
        <Avatar name={teammate.name} image={teammate.image} size="h-10 w-10 text-xs" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-ink">{teammate.name}</h2>
          <p className="truncate text-xs text-ink-muted">{teammate.headline}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {teammate.tags.map((tag) => (
          <Pill key={tag}>{tag}</Pill>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>Evidence on file</Eyebrow>
          <span className="font-mono text-xs tabular-nums text-ink-muted">{teammate.evidenceScore}/100</span>
        </div>
        <EvidenceStrip
          levels={strengthLevels(teammate.evidenceScore)}
          label={`Evidence on file: ${teammate.evidenceScore} out of 100`}
        />
        {action}
      </div>
    </article>
  );
}

export function TeamCard({ team, action }: { team: TeamCardData; action?: React.ReactNode }) {
  const slotLabel = `${team.openSlots} open ${team.openSlots === 1 ? "slot" : "slots"}`;
  const totalSeats = team.members.length + team.openSlots;

  return (
    <article className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-ink">{team.name}</h2>
          <p className="truncate text-xs text-ink-muted">{team.hackathonName}</p>
        </div>
        <Pill tone="warm">{slotLabel}</Pill>
      </div>

      <div>
        <Eyebrow>Looking for</Eyebrow>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {team.lookingFor.length > 0 ? (
            team.lookingFor.map((tag) => <Pill key={tag}>{tag}</Pill>)
          ) : (
            <span className="text-xs text-ink-muted">Open to anyone</span>
          )}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>Seats</Eyebrow>
          <span className="font-mono text-xs tabular-nums text-ink-muted">
            {team.members.length}/{totalSeats} filled
          </span>
        </div>
        {/* Filled seats as solid cells, open seats as empty ones. */}
        <EvidenceStrip
          levels={Array.from({ length: totalSeats }, (_, i) => (i < team.members.length ? 4 : 0))}
          label={`${team.members.length} of ${totalSeats} seats filled`}
        />
        <p className="truncate text-xs text-ink-muted">Members: {team.members.join(", ")}</p>
        {action}
      </div>
    </article>
  );
}
