import { PrimaryButton, SecondaryButton } from "@/app/ui/primitives";

// Shared shell for every onboarding screen after the branch (spec section 3):
// title/description, the screen's own content, then a Continue button, with
// Skip shown only for the two optional screens, and Back for everything
// after the first step in a path.
export function StepShell({
  title,
  description,
  children,
  onContinue,
  onSkip,
  onBack,
  continueLabel = "Continue",
  continueDisabled = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onContinue: () => void;
  onSkip?: () => void;
  onBack?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>

      {children}

      <div className="flex items-center justify-between gap-3 border-t border-line pt-5">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="font-display text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted transition hover:text-ink"
          >
            ← Back
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          {onSkip && (
            <SecondaryButton type="button" onClick={onSkip}>
              Skip
            </SecondaryButton>
          )}
          <PrimaryButton type="button" onClick={onContinue} disabled={continueDisabled}>
            {continueLabel}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
