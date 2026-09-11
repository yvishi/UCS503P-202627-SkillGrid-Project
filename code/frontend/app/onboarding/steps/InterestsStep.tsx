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
      description="Pick as many as apply."
      onContinue={onContinue}
      onBack={onBack}
      continueDisabled={value.length === 0}
    >
      <div className="flex flex-wrap gap-2">
        {INTEREST_TAGS.map((tag) => {
          const active = value.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={`font-display rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-trust bg-trust text-surface"
                  : "border-border-strong text-ink-muted hover:border-trust hover:text-trust"
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}
