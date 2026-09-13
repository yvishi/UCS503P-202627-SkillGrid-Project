// Shared visual primitives for SkillGrid. Used by both the public
// (landing) and protected (dashboard/profile/onboarding) surfaces, which
// is why this lives outside the (protected) route group.

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display inline-block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
      {children}
    </span>
  );
}

export function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Eyebrow>{title}</Eyebrow>
        {action}
      </div>
      {children}
    </div>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display inline-block rounded-full border border-border-strong bg-surface-alt px-3 py-1 text-xs font-medium">
      {children}
    </span>
  );
}

export function Empty({ message }: { message: string }) {
  return <p className="text-sm text-ink-muted">{message}</p>;
}

export function EvidenceRow({
  done,
  disabled = false,
  children,
}: {
  done: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className={`flex items-center gap-3 text-sm ${
        done ? "" : disabled ? "text-ink-muted/60" : "text-ink-muted"
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          done ? "bg-success text-surface" : "border border-border-strong"
        }`}
      >
        {done ? "✓" : "–"}
      </span>
      {children}
    </li>
  );
}

export function ProgressBar({ fraction }: { fraction: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-surface-alt"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-success transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <Eyebrow>{label}</Eyebrow>
      <p className="font-display mt-2 text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
    </div>
  );
}

/**
 * The signature element: a warm, rounded badge for anything that counts
 * as verified evidence (resume on file, GitHub connected, etc). A soft
 * tinted pill with a checkmark reads as reassuring rather than
 * bureaucratic -- literalizing "trust" without feeling like paperwork.
 * `pending` renders a neutral outline for evidence submitted but not yet
 * verified.
 */
export function TrustBadge({
  children,
  pending = false,
  className = "",
}: {
  children: React.ReactNode;
  pending?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`font-display inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
        pending
          ? "border border-border-strong text-ink-muted"
          : "bg-success/15 text-success-strong"
      } ${className}`}
    >
      {!pending && (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z" />
        </svg>
      )}
      {children}
    </span>
  );
}

export const buttonBase =
  "font-display inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";

export function PrimaryButton({
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${buttonBase} bg-trust text-surface shadow-sm hover:bg-trust-strong ${className}`}
    />
  );
}

export function SecondaryButton({
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${buttonBase} border border-border-strong text-ink hover:border-trust hover:text-trust ${className}`}
    />
  );
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.89c2.27-2.09 3.58-5.17 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.89-3c-1.08.73-2.46 1.16-4.06 1.16-3.12 0-5.77-2.11-6.71-4.94H1.28v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.31A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.58.38-2.31v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.41l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.59l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75Z"
      />
    </svg>
  );
}
