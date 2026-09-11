"use client";

import { StepShell } from "./StepShell";

// Spec section 8: real GitHub OAuth is the intended implementation, but no
// GitHub OAuth app credentials exist in this environment, so this uses the
// documented temporary fallback -- an unverified profile URL, clearly
// labeled as such. Swap for real OAuth before this goes near real users.
export function GithubStep({
  value,
  onChange,
  onContinue,
  onSkip,
  onBack,
}: {
  value: string;
  onChange: (next: string) => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack?: () => void;
}) {
  return (
    <StepShell
      title="Link your GitHub"
      description="Optional. Real GitHub sign-in is coming soon — for now, drop your profile URL."
      onContinue={onContinue}
      onSkip={onSkip}
      onBack={onBack}
    >
      <div className="flex flex-col gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://github.com/yourusername"
          className="border border-line-strong bg-paper-raised px-3 py-2 text-sm"
        />
        <p className="text-xs text-ink-muted">
          Unverified for now — this won&apos;t count as evidence until real GitHub sign-in ships.
        </p>
      </div>
    </StepShell>
  );
}
