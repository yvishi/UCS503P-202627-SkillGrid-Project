import { buttonBase } from "./primitives";

// The one "Connect GitHub" trigger, reused by dashboard quick actions,
// onboarding's GithubStep, and the profile page -- see app/api/github for
// the OAuth flow it starts. A plain anchor (not next/link, not a client
// component) since it needs a real full-page navigation off-site to
// GitHub's consent screen; `returnTo` says where the callback should send
// the user back to (validated server-side against an allowlist).
export function ConnectGithubButton({
  returnTo,
  variant = "secondary",
  className = "",
  children = "Connect GitHub",
}: {
  returnTo: "/dashboard" | "/profile" | "/onboarding";
  variant?: "primary" | "secondary";
  className?: string;
  children?: React.ReactNode;
}) {
  const variantClass =
    variant === "primary"
      ? "bg-trust text-surface shadow-sm hover:bg-trust-strong"
      : "border border-border-strong text-ink hover:border-trust hover:text-trust";

  return (
    <a
      href={`/api/github/start?returnTo=${encodeURIComponent(returnTo)}`}
      className={`${buttonBase} ${variantClass} ${className}`}
    >
      <GithubMark />
      {children}
    </a>
  );
}

// Reads the callback's ?github=connected|error redirect param -- shared by
// the dashboard and profile pages (server components, so this is the
// simplest way to surface the OAuth round-trip's result; onboarding's
// wizard handles its own client-side banner instead, since it needs to
// restore in-progress wizard state across the redirect too).
export function GithubConnectionBanner({ status }: { status: string | undefined }) {
  if (status === "connected") {
    return (
      <p className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success-strong">
        GitHub connected.
      </p>
    );
  }
  if (status === "error") {
    return (
      <p className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
        Something went wrong connecting GitHub. Please try again.
      </p>
    );
  }
  return null;
}

function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.69-1.28-1.69-1.04-.72.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.51-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.77.12 3.06.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14 0 1.54-.01 2.79-.01 3.17 0 .31.2.68.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}
