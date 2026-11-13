// Kept out of EvidenceGrid.tsx ("use client") so server components can
// call it too.

export type CellLevel = 0 | 1 | 2 | 3 | 4;

export function cellColor(level: CellLevel, self: boolean) {
  if (level === 0) return "var(--cell-0)";
  if (self) return `color-mix(in srgb, var(--warm) ${30 + level * 17}%, var(--cell-0))`;
  return `var(--cell-${level})`;
}
