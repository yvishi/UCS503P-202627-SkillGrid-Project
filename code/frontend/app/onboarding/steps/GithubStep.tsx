"use client";

import { ConnectGithubButton } from "@/app/ui/ConnectGithubButton";
import { TrustBadge } from "@/app/ui/primitives";
import { StepShell } from "./StepShell";

// Real GitHub OAuth (see app/api/github) -- connecting mid-wizard means a
// full-page redirect off-site to GitHub and back, so OnboardingWizard
// persists its state across that round-trip (sessionStorage) and restores
// `username`/`connectionError` from the callback's redirect query params.
export function GithubStep({
  username,
  connectionError,
  onContinue,
  onSkip,
  onBack,
}: {
  username: string | null;
  connectionError: boolean;
  onContinue: () => void;
  onSkip: () => void;
  onBack?: () => void;
}) {
  return (
    <StepShell
      title="Link your GitHub"
      description="Optional. Connecting pulls your public repo languages in as evidence."
      onContinue={onContinue}
      onSkip={onSkip}
      onBack={onBack}
    >
      <div className="flex flex-col items-start gap-3">
        {username ? (
          <TrustBadge>Connected as @{username}</TrustBadge>
        ) : (
          <ConnectGithubButton returnTo="/onboarding" />
        )}
        {connectionError && (
          <p className="text-xs text-danger">Something went wrong connecting GitHub. Please try again.</p>
        )}
        <p className="text-xs text-ink-muted">
          We only read your public profile and repos — nothing is posted on your behalf.
        </p>
      </div>
    </StepShell>
  );
}
