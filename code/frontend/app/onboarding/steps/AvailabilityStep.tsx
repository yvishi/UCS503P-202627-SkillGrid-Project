"use client";

import { AVAILABILITY_LABELS, AVAILABILITY_OPTIONS, type AvailabilityOption } from "@/lib/onboarding-options";
import { StepShell } from "./StepShell";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

// Which days of the week each option covers, drawn as a 7-cell week strip.
// "Flexible" is shown as every day at half strength.
const WEEK: Record<AvailabilityOption, ("on" | "half" | "off")[]> = {
  WEEKDAYS: ["on", "on", "on", "on", "on", "off", "off"],
  WEEKENDS: ["off", "off", "off", "off", "off", "on", "on"],
  BOTH: ["on", "on", "on", "on", "on", "on", "on"],
  FLEXIBLE: ["half", "half", "half", "half", "half", "half", "half"],
};

const HINTS: Record<AvailabilityOption, string> = {
  WEEKDAYS: "Monday to Friday",
  WEEKENDS: "Saturday and Sunday",
  BOTH: "Any day of the week",
  FLEXIBLE: "Varies week to week",
};

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
      description="Teammates see this when deciding whether your schedules line up."
      onContinue={onContinue}
      onBack={onBack}
      continueDisabled={!value}
      disabledHint="Choose one to continue."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {AVAILABILITY_OPTIONS.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option)}
              className={`flex flex-col gap-3 rounded-theme-md border p-4 text-left transition-colors ${
                active ? "border-ink bg-surface-alt/60" : "border-border-strong bg-surface hover:border-ink"
              }`}
            >
              <span className="flex w-full items-center justify-between gap-3">
                <span className="font-semibold">{AVAILABILITY_LABELS[option]}</span>
                <span
                  aria-hidden="true"
                  className={`h-4 w-4 rounded-full border-2 ${active ? "border-ink bg-ink ring-2 ring-inset ring-bg" : "border-border-strong"}`}
                />
              </span>
              <span aria-hidden="true" className="flex gap-[3px]">
                {WEEK[option].map((day, i) => (
                  <span key={i} className="flex flex-col items-center gap-1">
                    <span
                      className={`h-4 w-4 rounded-[3px] ${
                        day === "on" ? (active ? "bg-ink" : "bg-ink-muted") : day === "half" ? "bg-ink-muted/40" : "bg-cell-0"
                      }`}
                    />
                    <span className="font-mono text-[9px] text-ink-muted">{DAYS[i]}</span>
                  </span>
                ))}
              </span>
              <span className="text-xs text-ink-muted">{HINTS[option]}</span>
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}
