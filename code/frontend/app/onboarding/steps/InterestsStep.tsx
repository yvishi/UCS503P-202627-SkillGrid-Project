"use client";

import { INTEREST_TAGS } from "@/lib/onboarding-options";
import { StepShell } from "./StepShell";

// Spec sections 4.3 / 5.2: multi-select, tap to toggle.
export function InterestsStep({
  value,
  onChange,
  onContinue,
  onBack,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  onContinue: () => void;
  onBack?: () => void;
}) {
  function toggle(tag: string) {
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);
  }

  return (
    <StepShell
      title="What are you interested in?"
      description="Pick as many as apply. We use these to suggest teammates and projects."
      aside={
        <p aria-live="polite" className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted sm:pt-2">
          <span className="text-ink tabular-nums">{value.length}</span> selected
        </p>
      }
      onContinue={onContinue}
      onBack={onBack}
      continueDisabled={value.length === 0}
      disabledHint="Pick at least one to continue."
    >
      <div className="flex flex-wrap gap-2">
        {INTEREST_TAGS.map((tag) => {
          const active = value.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(tag)}
              className={`inline-flex items-center gap-2 rounded-theme-sm border px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-ink bg-ink text-bg"
                  : "border-border-strong bg-surface text-ink-muted hover:border-ink hover:text-ink"
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-3 w-3 items-center justify-center rounded-[3px] ${
                  active ? "bg-bg text-ink" : "border border-border-strong"
                }`}
              >
                {active && (
                  <svg viewBox="0 0 20 20" className="h-2.5 w-2.5" fill="currentColor">
                    <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z" />
                  </svg>
                )}
              </span>
              {tag}
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}
