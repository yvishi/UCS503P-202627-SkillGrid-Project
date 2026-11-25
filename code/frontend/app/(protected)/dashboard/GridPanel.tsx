import Link from "next/link";

import { EvidenceGrid, GridLegend } from "@/app/ui/EvidenceGrid";
import { Eyebrow, buttonBase, secondaryButtonClass } from "@/app/ui/primitives";
import { GRID_PREVIEW_ROWS } from "@/lib/guide-core";

import { GRID_COLUMNS, type DashboardSkillGrid } from "./grid-data";

const FULL_GRID_HREF = "/profile/grid";
const linkClass = "rounded-theme-sm text-sm font-semibold text-trust underline underline-offset-4 hover:text-trust-strong";

// Names the skills that rest on the user's word alone, e.g. "Figma and
// Docker are only your own word so far."
function unbackedLine(grid: DashboardSkillGrid): string | null {
  const names = grid.rows.filter((r) => r.cells.slice(1).every((level) => level === 0)).map((r) => r.label);
  if (names.length === 0) return "Every skill here has something behind it.";
  const shown = names.slice(0, 2).join(" and ");
  const more = names.length > 2 ? ` and ${names.length - 2} more` : "";
  return `${shown}${more} ${names.length === 1 ? "is" : "are"} only your own word so far.`;
}

/**
 * The dashboard's view of the skill grid: the brand's signature, so it is
 * on every dashboard visit, but only as a preview of the best-evidenced
 * skills (rows arrive sorted that way). The full grid has its own page.
 *
 * `side` sits beside the getting-started steps; `hero` leads the home base.
 */
export function GridPanel({ grid, variant }: { grid: DashboardSkillGrid; variant: "side" | "hero" }) {
  const total = grid.rows.length;
  const preview = grid.rows.slice(0, GRID_PREVIEW_ROWS);
  const hero = variant === "hero";

  return (
    <section aria-labelledby="your-grid-heading" className="overflow-hidden rounded-theme-lg border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 id="your-grid-heading">
          <Eyebrow className="text-ink">Your grid</Eyebrow>
        </h2>
        <span className="font-mono text-xs tabular-nums text-ink-muted">
          {total} {total === 1 ? "skill" : "skills"}
        </span>
      </div>

      {total === 0 ? (
        <div className="flex flex-col gap-4 p-5">
          <EvidenceGrid
            columns={GRID_COLUMNS}
            rows={[{ label: "Your first skill", cells: [0, 0, 0, 0] }]}
            selfColumn={0}
            size="md"
            animate={false}
            caption="Empty skill grid"
          />
          <div>
            <p className="font-semibold text-ink">Your grid is empty</p>
            <p className="mt-1 text-sm text-ink-muted">
              Add your skills, then upload a resume or connect GitHub. What they show fills in here.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/profile/skills" className={linkClass}>
              Add skills
            </Link>
            <Link href="/profile/resume" className={linkClass}>
              Upload a resume
            </Link>
          </div>
        </div>
      ) : (
        <div className={`bg-graph p-5 ${hero ? "grid gap-6 sm:p-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-10" : "flex flex-col gap-4"}`}>
          <div className="flex min-w-0 flex-col gap-4">
            <EvidenceGrid
              columns={GRID_COLUMNS}
              rows={preview}
              selfColumn={0}
              size={hero ? "lg" : "md"}
              caption="Your best-evidenced skills by source: self-rating, resume, GitHub and peers"
            />
            {/* Beside the steps the panel stays compact on a phone, where it sits above them. */}
            <div className={hero ? "" : "hidden lg:block"}>
              <GridLegend />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <p className={`font-display font-bold tracking-tight text-ink ${hero ? "text-2xl sm:text-3xl" : "text-lg"}`}>
                {grid.backedCount} of {total} {total === 1 ? "skill" : "skills"} backed
              </p>
              <p className={`mt-1 text-sm text-ink-muted ${hero ? "" : "hidden lg:block"}`}>
                {hero ? unbackedLine(grid) : "Filled squares have evidence behind them. Outlined ones are your own rating."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link href={FULL_GRID_HREF} className={`${buttonBase} ${secondaryButtonClass} px-3 py-2`}>
                See the full grid
              </Link>
              {hero && (
                <Link href="/profile" className={linkClass}>
                  Add evidence
                </Link>
              )}
            </div>
            {total > preview.length && (
              <p className={`font-mono text-xs text-ink-muted ${hero ? "" : "hidden lg:block"}`}>
                Showing your top {preview.length} of {total}.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
