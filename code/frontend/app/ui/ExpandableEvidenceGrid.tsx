"use client";

import { useState } from "react";

import { EvidenceGrid } from "./EvidenceGrid";

export const GRID_ROW_LIMIT = 15;

// Skill lists are open-ended now, so long grids show the strongest rows
// first (rows arrive sorted by evidence) and fold the rest behind a toggle.
export function ExpandableEvidenceGrid({
  rows,
  limit = GRID_ROW_LIMIT,
  ...gridProps
}: React.ComponentProps<typeof EvidenceGrid> & { limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  const hidden = rows.length - limit;
  const shown = expanded || hidden <= 0 ? rows : rows.slice(0, limit);

  return (
    <div className="flex flex-col gap-3">
      <EvidenceGrid {...gridProps} rows={shown} />
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="self-start rounded-theme-sm text-xs font-semibold text-ink-muted underline decoration-border-strong underline-offset-4 transition hover:text-ink hover:decoration-ink"
        >
          {expanded ? "Show fewer" : `Show all ${rows.length} skills`}
        </button>
      )}
    </div>
  );
}
