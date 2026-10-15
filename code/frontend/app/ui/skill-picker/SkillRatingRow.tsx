"use client";

import { useId, useRef, useState } from "react";

import { SKILL_RATING_LABELS, SKILL_RATING_LEVELS, type SkillRatingLevel } from "@/lib/skills";

// The amber three-cell comfort selector, moved here from the old onboarding
// SkillsStep. Removing a skill is now its own button, so clicking the
// chosen level again no longer clears it.

export function LevelKey() {
  return (
    <span
      aria-hidden="true"
      className="hidden items-center gap-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted sm:flex"
    >
      {SKILL_RATING_LEVELS.map((level, i) => (
        <span key={level} className="flex items-center gap-1.5">
          <span className="flex gap-[2px]">
            {[0, 1, 2].map((c) => (
              <span key={c} className={`h-2 w-2 rounded-[2px] ${c <= i ? "bg-warm" : "bg-cell-0"}`} />
            ))}
          </span>
          {SKILL_RATING_LABELS[level]}
        </span>
      ))}
    </span>
  );
}

export function SkillRatingRow({
  label,
  level,
  onSelect,
  onRemove,
  busy = false,
}: {
  label: string;
  level: SkillRatingLevel;
  onSelect: (level: SkillRatingLevel) => void;
  onRemove: () => void;
  busy?: boolean;
}) {
  const labelId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [hover, setHover] = useState<number | null>(null);

  const chosen = SKILL_RATING_LEVELS.indexOf(level);
  const shown = hover ?? chosen;

  // Radio-group keyboard pattern: arrows move and select.
  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let target: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") target = Math.min(index + 1, SKILL_RATING_LEVELS.length - 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") target = Math.max(index - 1, 0);
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = SKILL_RATING_LEVELS.length - 1;
    if (target === null) return;
    e.preventDefault();
    buttons.current[target]?.focus();
    if (SKILL_RATING_LEVELS[target] !== level) onSelect(SKILL_RATING_LEVELS[target]);
  }

  return (
    <li className="flex items-center justify-between gap-3 bg-warm/[0.04] px-4 py-2.5">
      <div className="min-w-0">
        <p id={labelId} className="truncate text-sm font-medium">
          {label}
        </p>
        <p
          aria-hidden="true"
          className={`mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
            hover !== null ? "text-ink-muted" : "text-warm-strong"
          }`}
        >
          {SKILL_RATING_LABELS[SKILL_RATING_LEVELS[shown]]}
        </p>
      </div>

      <div className="flex shrink-0 items-center">
        <div role="radiogroup" aria-labelledby={labelId} className="flex" onMouseLeave={() => setHover(null)}>
          {SKILL_RATING_LEVELS.map((lvl, i) => {
            const checked = level === lvl;
            const filled = i <= shown;
            const previewing = hover !== null;
            return (
              <button
                key={lvl}
                ref={(el) => {
                  buttons.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                disabled={busy}
                aria-label={SKILL_RATING_LABELS[lvl]}
                title={SKILL_RATING_LABELS[lvl]}
                tabIndex={checked ? 0 : -1}
                onClick={() => {
                  if (!checked) onSelect(lvl);
                }}
                onKeyDown={(e) => onKeyDown(e, i)}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") setHover(i);
                }}
                className="grid h-10 w-9 place-items-center rounded-theme-sm"
              >
                <span
                  aria-hidden="true"
                  className={`h-6 w-6 rounded-[5px] border transition-colors duration-150 ${
                    filled
                      ? previewing
                        ? "border-warm/70 bg-warm/45"
                        : "border-warm bg-warm"
                      : "border-border-strong bg-cell-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          aria-label={`Remove ${label}`}
          title={`Remove ${label}`}
          className="ml-1 grid h-9 w-9 place-items-center rounded-theme-sm text-ink-muted transition hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>
    </li>
  );
}
