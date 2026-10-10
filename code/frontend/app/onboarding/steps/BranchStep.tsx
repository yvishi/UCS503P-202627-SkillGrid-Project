"use client";

import { Pill, TrustBadge } from "@/app/ui/primitives";
import { SpotlightCard } from "@/app/ui/motion";

import { StepHeading } from "./StepShell";

// Spec section 2: one question, two choices, nothing else. No stepper here.
export function BranchStep({ onChoose }: { onChoose: (path: "A" | "B") => void }) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        bare
        eyebrow="New profile"
        title="Do you have a resume to upload?"
        description="Your profile is a grid of skills and the evidence behind them. A resume puts real evidence on it from the start."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ChoiceCard
          onClick={() => onChoose("A")}
          title="I have a resume"
          body="Upload a PDF. We check it and pull skill tags from it, so those skills count as evidence."
          badge={<TrustBadge>Evidence-backed</TrustBadge>}
          cells="trust"
          recommended
        />
        <ChoiceCard
          onClick={() => onChoose("B")}
          title="I'll fill it in by hand"
          body="Rate your skills yourself. They show as self-reported until GitHub or a resume backs them up."
          badge={<Pill tone="warm">Self-reported</Pill>}
          cells="warm"
          spotColor="color-mix(in srgb, var(--warm) 16%, transparent)"
        />
      </div>
    </div>
  );
}

// Tiny preview of what each path puts on the grid.
const PREVIEW = [
  [4, 3, 0, 2],
  [2, 0, 3, 4],
  [0, 3, 2, 0],
];

function ChoiceCard({
  onClick,
  title,
  body,
  badge,
  cells,
  recommended = false,
  spotColor,
}: {
  onClick: () => void;
  title: string;
  body: string;
  badge: React.ReactNode;
  cells: "trust" | "warm";
  recommended?: boolean;
  spotColor?: string;
}) {
  return (
    <SpotlightCard
      color={spotColor}
      className={`rounded-theme-lg border bg-surface transition-colors hover:border-ink ${
        recommended ? "border-trust/40" : "border-border-strong"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex h-full w-full flex-col items-start gap-4 rounded-theme-lg p-5 text-left focus-visible:outline-offset-[-3px] sm:p-6"
      >
        <span className="flex w-full items-start justify-between gap-3">
          <span aria-hidden="true" className="grid grid-cols-4 gap-[3px]">
            {PREVIEW.flat().map((level, i) => (
              <span
                key={i}
                className="h-3 w-3 rounded-[3px]"
                style={{
                  backgroundColor:
                    level === 0
                      ? "var(--cell-0)"
                      : cells === "trust"
                        ? `var(--cell-${level})`
                        : `color-mix(in srgb, var(--warm) ${30 + level * 17}%, var(--cell-0))`,
                }}
              />
            ))}
          </span>
          {recommended && (
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-trust-strong">
              Recommended
            </span>
          )}
        </span>
        <span className="flex flex-col gap-1.5">
          <span className="font-display text-lg font-semibold tracking-tight">{title}</span>
          <span className="text-sm text-ink-muted">{body}</span>
        </span>
        <span className="mt-auto flex w-full items-center justify-between gap-3">
          {badge}
          <span aria-hidden="true" className="text-ink-muted">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 5l5 5-5 5" />
            </svg>
          </span>
        </span>
      </button>
    </SpotlightCard>
  );
}
