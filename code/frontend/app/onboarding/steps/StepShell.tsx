"use client";

import { useEffect, useRef } from "react";

import { Eyebrow, PrimaryButton, SecondaryButton } from "@/app/ui/primitives";

// Shared shell for every onboarding screen after the branch (spec section 3):
// title/description, the screen's own content, then a Continue button, with
// Skip shown only for the two optional screens, and Back for everything
// after the first step in a path.
//
// The pieces (StepCard / StepHeading / StepFooter / BackButton) are exported
// too, so the two screens with their own footer logic (Resume, Review) sit
// in the same frame.
export function StepShell({
  title,
  description,
  aside,
  children,
  onContinue,
  onSkip,
  onBack,
  continueLabel = "Continue",
  continueDisabled = false,
  disabledHint,
}: {
  title: string;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  onContinue: () => void;
  onSkip?: () => void;
  onBack?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  /** Shown beside the footer buttons while Continue is disabled. */
  disabledHint?: string;
}) {
  return (
    <StepCard>
      <StepHeading title={title} description={description} aside={aside} />
      <div className="px-5 pb-6 sm:px-7">{children}</div>
      <StepFooter
        onBack={onBack}
        hint={continueDisabled ? disabledHint : undefined}
        actions={
          <>
            {onSkip && (
              <SecondaryButton type="button" onClick={onSkip}>
                Skip
              </SecondaryButton>
            )}
            <PrimaryButton type="button" onClick={onContinue} disabled={continueDisabled}>
              {continueLabel}
              <ArrowRight />
            </PrimaryButton>
          </>
        }
      />
    </StepCard>
  );
}

export function StepCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-theme-lg border border-border bg-surface shadow-[0_2px_0_var(--border)]">
      {children}
    </section>
  );
}

// The step's <h1>. When a step mounts after the previous one unmounted
// (focus has fallen back to <body>), focus moves here so keyboard and
// screen-reader users land at the top of the new step instead of nowhere.
export function StepHeading({
  title,
  description,
  aside,
  eyebrow,
  bare = false,
}: {
  title: string;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  eyebrow?: string;
  /** Drop the card padding (for headings that sit directly on the page). */
  bare?: boolean;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) {
      ref.current?.focus();
    }
  }, []);

  return (
    <header
      className={`flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${
        bare ? "" : "px-5 pb-5 pt-6 sm:px-7 sm:pt-7"
      }`}
    >
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
        <h1
          ref={ref}
          tabIndex={-1}
          className="font-display text-2xl font-bold tracking-tight text-balance focus:outline-none sm:text-[1.7rem]"
        >
          {title}
        </h1>
        {description && <p className="mt-1.5 max-w-prose text-sm text-ink-muted">{description}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </header>
  );
}

export function StepFooter({
  onBack,
  hint,
  actions,
}: {
  onBack?: () => void;
  hint?: string;
  actions: React.ReactNode;
}) {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 rounded-b-theme-lg border-t border-border bg-surface-alt/40 px-5 py-4 sm:px-7">
      {onBack ? <BackButton onClick={onBack} /> : <span />}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {hint && <p className="text-xs text-ink-muted">{hint}</p>}
        {actions}
      </div>
    </footer>
  );
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-theme-sm px-1 py-1 text-sm font-medium text-ink-muted transition hover:text-ink"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5l-5 5 5 5" />
      </svg>
      Back
    </button>
  );
}

export function ArrowRight() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5l5 5-5 5" />
    </svg>
  );
}
