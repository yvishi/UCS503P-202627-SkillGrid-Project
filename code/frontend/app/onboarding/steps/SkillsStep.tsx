"use client";

import { SKILLS, SKILL_RATING_LEVELS, SKILL_RATING_LABELS, type SkillRatings } from "@/lib/skills";
import { StepShell } from "./StepShell";

// Spec sections 4.2 / 5.1: same fixed skill list and comfort selector for
// both paths -- Path A shows this after the resume step, Path B shows it
// as the first onboarding screen. Resume-extracted tags are reconciled
// separately at Review (not shown here).
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
    >
      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border">
        {SKILLS.map((skill) => (
          <div key={skill.slug} className="flex flex-wrap items-center justify-between gap-3 bg-surface p-3.5">
            <span className="font-display text-sm font-medium">{skill.label}</span>
            <div className="flex gap-1.5">
              {SKILL_RATING_LEVELS.map((level) => {
                const active = value[skill.slug] === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setRating(skill.slug, level)}
                    className={`font-display rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "border-trust bg-trust text-surface"
                        : "border-border-strong text-ink-muted hover:border-trust hover:text-trust"
                    }`}
                  >
                    {SKILL_RATING_LABELS[level]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </StepShell>
  );
}
