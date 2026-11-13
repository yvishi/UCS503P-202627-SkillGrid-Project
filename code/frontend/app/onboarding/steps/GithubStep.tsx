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
      description="Optional. Connecting pulls your public repo languages and topics in as evidence."
      onContinue={onContinue}
      onSkip={onSkip}
      onBack={onBack}
    >
      <div className="flex flex-col gap-4">
        {connectionError && (
          <p role="alert" className="rounded-theme-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            GitHub didn&apos;t connect. Try again, and approve access on GitHub&apos;s screen when it opens. You can
            also skip this and connect later from your profile.
          </p>
        )}

        <div
          className={`flex flex-col gap-4 rounded-theme-md border p-4 sm:flex-row sm:items-center sm:justify-between ${
            username ? "border-trust/30 bg-trust/[0.06]" : "border-border bg-surface-alt/40"
          }`}
        >
          <div className="flex flex-col gap-1.5">
            {username ? (
              <>
                <TrustBadge className="self-start">Connected as @{username}</TrustBadge>
                <p className="text-sm text-ink-muted">Skills from your repos will show up as evidence on your grid.</p>
              </>
            ) : (
              <>
                <TrustBadge pending className="self-start">
                  Not connected
                </TrustBadge>
                <p className="text-sm text-ink-muted">You&apos;ll go to GitHub to approve, then come straight back here.</p>
              </>
            )}
          </div>
          {!username && <ConnectGithubButton returnTo="/onboarding" className="shrink-0" />}
        </div>

        <p className="text-xs text-ink-muted">We only read your public profile and repos. Nothing is posted on your behalf.</p>
      </div>
    </StepShell>
  );
}
