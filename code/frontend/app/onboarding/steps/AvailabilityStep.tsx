"use client";

import { AVAILABILITY_LABELS, AVAILABILITY_OPTIONS, type AvailabilityOption } from "@/lib/onboarding-options";
import { StepShell } from "./StepShell";

// Spec sections 4.4 / 5.3: reuse the existing availability selector as-is.
export function AvailabilityStep({
  value,
  onChange,
  onContinue,
  onBack,
}: {
  value: AvailabilityOption | null;
  onChange: (next: AvailabilityOption) => void;
  onContinue: () => void;
  onBack?: () => void;
}) {
  return (
    <StepShell
      title="When are you usually free?"
      onContinue={onContinue}
      onBack={onBack}
      continueDisabled={!value}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {AVAILABILITY_OPTIONS.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`border p-4 text-left transition ${
                active ? "border-ink bg-paper-raised" : "border-line-strong hover:border-ink"
              }`}
            >
              <span className="font-display font-semibold">{AVAILABILITY_LABELS[option]}</span>
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}
