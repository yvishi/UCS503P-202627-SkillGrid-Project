// Kept out of EvidenceGrid.tsx ("use client") so server components can
// call it too.

import type { CSSProperties } from "react";

export type CellLevel = 0 | 1 | 2 | 3 | 4;

// Inner mark of a self-rated cell, as a share of the cell, by level.
const SELF_MARK = ["0%", "24%", "36%", "48%", "60%"] as const;

/**
 * Inline style for one grid cell. Evidence cells are filled, on a scale
 * from pale to full. Self-rated cells are never filled: they are an
 * outline with a centred mark that grows with the level, so "you said
 * so" can't be mistaken for "something proves it".
 */
export function cellStyle(level: CellLevel, self: boolean): CSSProperties {
  if (level === 0 || !self) return { backgroundColor: `var(--cell-${level})` };
  return {
    boxShadow: "inset 0 0 0 1.5px var(--cell-4)",
    backgroundImage: "linear-gradient(var(--cell-4), var(--cell-4))",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
    backgroundSize: `${SELF_MARK[level]} ${SELF_MARK[level]}`,
  };
}
