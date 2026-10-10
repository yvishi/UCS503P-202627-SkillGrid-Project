"use client";

import { useId, useRef, useState } from "react";

import {
  SKILLS,
  SKILL_RATING_LEVELS,
  SKILL_RATING_LABELS,
  type SkillRatingLevel,
  type SkillRatings,
} from "@/lib/skills";
import { Pill } from "@/app/ui/primitives";

import { StepShell } from "./StepShell";

// Spec sections 4.2 / 5.1: same fixed skill list and comfort selector for
// both paths -- Path A shows this after the resume step, Path B shows it
// as the first onboarding screen. Resume-extracted tags are reconciled
// separately at Review (not shown here).
//
// Ratings are self-reported, so the selector speaks amber: three cells that
// fill up to the chosen level. Clicking the chosen level again clears it.
export function SkillsStep({
  value,
  onChange,
  onContinue,
  onBack,
}: {
  value: SkillRatings;
  onChange: (next: SkillRatings) => void;
  onContinue: () => void;
  onBack?: () => void;
}) {
  function setRating(slug: (typeof SKILLS)[number]["slug"], level: (typeof SKILL_RATING_LEVELS)[number]) {
    const next = { ...value };
    next[slug] = next[slug] === level ? undefined : level;
    onChange(next);
  }

  const ratedCount = Object.values(value).filter(Boolean).length;

  return (
    <StepShell
      title="Rate your skills"
      description="Pick a comfort level for anything you know. Skip what doesn't apply."
      onContinue={onContinue}
      onBack={onBack}
      continueDisabled={ratedCount === 0}
      disabledHint="Rate at least one skill to continue."
    >
      <div className="overflow-hidden rounded-theme-md border border-border">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-surface-alt/50 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Pill tone="warm">Self-reported</Pill>
            <LevelKey />
          </div>
          <p aria-live="polite" className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
            <span className="text-ink tabular-nums">{ratedCount}</span> of {SKILLS.length} rated
          </p>
        </div>
        <ul className="divide-y divide-border">
          {SKILLS.map((skill) => (
            <SkillRow
              key={skill.slug}
              label={skill.label}
              level={value[skill.slug]}
              onSelect={(level) => setRating(skill.slug, level)}
            />
          ))}
        </ul>
      </div>
    </StepShell>
  );
}

function LevelKey() {
  return (
    <span aria-hidden="true" className="hidden items-center gap-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted sm:flex">
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

function SkillRow({
  label,
  level,
  onSelect,
}: {
  label: string;
  level: SkillRatingLevel | undefined;
  onSelect: (level: SkillRatingLevel) => void;
}) {
  const labelId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [hover, setHover] = useState<number | null>(null);

  const chosen = level ? SKILL_RATING_LEVELS.indexOf(level) : -1;
  const shown = hover ?? chosen;
  const focusIndex = chosen >= 0 ? chosen : 0;

  // Radio-group keyboard pattern: arrows move and select (never clear --
  // Space/Enter on the checked cell does that, same as clicking it again).
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
    <li className={`flex items-center justify-between gap-3 px-4 py-2.5 transition-colors ${level ? "bg-warm/[0.04]" : "bg-surface"}`}>
      <div className="min-w-0">
        <p id={labelId} className="truncate text-sm font-medium">
          {label}
        </p>
        <p
          aria-hidden="true"
          className={`mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
            hover !== null ? "text-ink-muted" : chosen >= 0 ? "text-warm-strong" : "text-ink-muted/70"
          }`}
        >
          {shown >= 0 ? SKILL_RATING_LABELS[SKILL_RATING_LEVELS[shown]] : "Not rated"}
        </p>
      </div>

      <div role="radiogroup" aria-labelledby={labelId} className="flex shrink-0" onMouseLeave={() => setHover(null)}>
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
              aria-label={SKILL_RATING_LABELS[lvl]}
              title={checked ? `${SKILL_RATING_LABELS[lvl]} (click again to clear)` : SKILL_RATING_LABELS[lvl]}
              tabIndex={i === focusIndex ? 0 : -1}
              onClick={() => onSelect(lvl)}
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
    </li>
  );
}
