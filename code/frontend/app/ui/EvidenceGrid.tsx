"use client";

// The SkillGrid signature: skills as rows, evidence sources as columns,
// each intersection a contribution-graph cell. Level 0 = nothing on file,
// 1-4 = increasingly strong evidence. Self-reported cells can be drawn in
// amber (`selfColumn`) to keep "you said so" visually distinct from
// "something proves it". Cells fill in a diagonal wave on first view and
// hovering a cell crosshairs its row and column.

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cellColor, type CellLevel } from "./cell-color";

export type { CellLevel };
export type GridRow = { label: string; cells: CellLevel[] };

const LEVEL_TEXT = ["nothing on file", "light", "some", "solid", "strong"];

const SIZES = {
  sm: { cell: "h-3 w-3 rounded-[3px]", gap: "gap-[3px]", label: "text-xs w-24" },
  md: { cell: "h-5 w-5 rounded-[4px]", gap: "gap-1", label: "text-sm w-32" },
  lg: { cell: "h-7 w-7 sm:h-8 sm:w-8 rounded-[5px]", gap: "gap-1.5", label: "text-sm w-28 sm:w-36" },
} as const;


export function EvidenceGrid({
  columns,
  rows,
  size = "md",
  selfColumn,
  animate = true,
  caption,
  className = "",
}: {
  columns: readonly string[];
  rows: GridRow[];
  size?: keyof typeof SIZES;
  selfColumn?: number;
  animate?: boolean;
  caption?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const s = SIZES[size];
  const shouldAnimate = animate && !reduce;

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="border-separate border-spacing-0" onMouseLeave={() => setHover(null)}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            <th scope="col" className="sr-only">
              Skill
            </th>
            {columns.map((col, c) => (
              <th
                key={col}
                scope="col"
                className={`pb-2 text-center align-bottom font-mono text-[10px] font-medium uppercase tracking-[0.12em] transition-colors ${
                  hover?.c === c ? "text-ink" : "text-ink-muted"
                } ${c === selfColumn ? "text-warm-strong" : ""}`}
              >
                <span className="px-0.5">{col}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={row.label}>
              <th
                scope="row"
                className={`${s.label} truncate pr-3 text-left font-medium transition-colors ${
                  hover?.r === r ? "text-ink" : "text-ink-muted"
                }`}
              >
                {row.label}
              </th>
              {row.cells.map((level, c) => {
                const isSelf = c === selfColumn;
                const crossed = hover !== null && (hover.r === r || hover.c === c);
                const exact = hover?.r === r && hover?.c === c;
                return (
                  <td key={c} className="p-0 text-center">
                    <div className={`flex justify-center ${s.gap} p-[2px]`}>
                      <motion.span
                        onMouseEnter={() => setHover({ r, c })}
                        className={`${s.cell} block transition-[box-shadow,opacity] duration-150 ${
                          exact ? "ring-2 ring-ink ring-offset-1 ring-offset-surface" : ""
                        } ${hover && !crossed ? "opacity-45" : ""}`}
                        style={{ backgroundColor: cellColor(level, isSelf) }}
                        initial={shouldAnimate ? { scale: 0.3, opacity: 0 } : false}
                        whileInView={{ scale: 1, opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{
                          duration: 0.35,
                          delay: shouldAnimate ? (r + c) * 0.035 : 0,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        title={`${row.label} · ${columns[c]}: ${LEVEL_TEXT[level]}`}
                      >
                        <span className="sr-only">
                          {columns[c]}: {LEVEL_TEXT[level]}
                        </span>
                      </motion.span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// One-row variant for dense lists (teammate cards etc.) -- no labels, no
// interaction, just the strip of cells with an accessible summary.
export function EvidenceStrip({
  levels,
  label,
  className = "",
}: {
  levels: CellLevel[];
  label: string;
  className?: string;
}) {
  return (
    <div role="img" aria-label={label} className={`flex gap-[3px] ${className}`}>
      {levels.map((level, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="h-3 w-3 rounded-[3px]"
          style={{ backgroundColor: cellColor(level, false) }}
        />
      ))}
    </div>
  );
}

export function GridLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted ${className}`}>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: cellColor(3, true) }} />
        Self-reported
      </span>
      <span className="flex items-center gap-1.5">
        Less
        {([0, 1, 2, 3, 4] as CellLevel[]).map((l) => (
          <span key={l} className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: cellColor(l, false) }} />
        ))}
        More evidence
      </span>
    </div>
  );
}
