// Shared visual primitives for SkillGrid. Used by both the public
// (landing) and protected (dashboard/profile/onboarding) surfaces, which
// is why this lives outside the (protected) route group.
//
// Visual language: graph paper + evidence cells. Anything "backed by
// evidence" is drawn as a filled ultramarine square (the same cell as the
// EvidenceGrid signature); anything empty/pending is an outlined cell.

export function Eyebrow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-block font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted ${className}`}
    >
      {children}
    </span>
  );
}

export function Cell({
  level = 0,
  className = "",
}: {
  level?: 0 | 1 | 2 | 3 | 4;
  className?: string;
}) {
  const bg = ["bg-cell-0", "bg-cell-1", "bg-cell-2", "bg-cell-3", "bg-cell-4"][level];
  return <span aria-hidden="true" className={`inline-block h-3 w-3 shrink-0 rounded-[3px] ${bg} ${className}`} />;
}

export function SectionCard({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-theme-lg border border-border bg-surface ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <Eyebrow>{title}</Eyebrow>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "trust" | "warm";
}) {
  const toneClass =
    tone === "trust"
      ? "border-trust/25 bg-trust/10 text-trust-strong"
      : tone === "warm"
        ? "border-warm/30 bg-warm/10 text-warm-strong"
        : "border-border bg-surface-alt text-ink";
  return (
    <span
      className={`inline-flex items-center rounded-theme-sm border px-2 py-0.5 text-xs font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
}

export function Empty({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-ink-muted">
      <span aria-hidden="true" className="inline-block h-3 w-3 rounded-[3px] border border-dashed border-border-strong" />
      {message}
    </p>
  );
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
        done ? "text-ink" : disabled ? "text-ink-muted/60" : "text-ink-muted"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] ${
          done
            ? "bg-trust text-on-trust"
            : disabled
              ? "border border-dashed border-border-strong"
              : "border border-border-strong"
        }`}
      >
        {done && (
          <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor">
            <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z" />
          </svg>
        )}
      </span>
      {children}
    </li>
  );
}

// Drawn as a row of grid cells rather than a smooth bar, so progress reads
// in the same unit as the evidence grid.
export function ProgressBar({
  fraction,
  cells = 10,
}: {
  fraction: number;
  cells?: number;
}) {
  const clamped = Math.min(1, Math.max(0, fraction));
  const pct = Math.round(clamped * 100);
  const filled = Math.round(clamped * cells);
  return (
    <div
      className="flex w-full gap-[3px]"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {Array.from({ length: cells }, (_, i) => (
        <span
          key={i}
          className={`h-2 flex-1 rounded-[2px] transition-colors duration-500 ${
            i < filled ? "bg-trust" : "bg-cell-0"
          }`}
          style={{ transitionDelay: `${i * 40}ms` }}
        />
      ))}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-theme-lg border border-border bg-surface p-5">
      <Eyebrow>{label}</Eyebrow>
      <p className="font-display mt-3 text-4xl font-bold leading-none tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-2 truncate text-sm text-ink-muted">{hint}</p>}
    </div>
  );
}

/**
 * Marks anything that counts as verified evidence (resume on file, GitHub
 * connected, etc). The leading filled cell ties it to the evidence grid;
 * `pending` renders an outlined cell for evidence not yet verified.
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
      className={`inline-flex items-center gap-2 rounded-theme-sm border px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.08em] ${
        pending
          ? "border-border-strong text-ink-muted"
          : "border-trust/25 bg-trust/10 text-trust-strong"
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 rounded-[2px] ${pending ? "border border-dashed border-ink-muted" : "bg-trust"}`}
      />
      {children}
    </span>
  );
}

export const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-theme-md px-4 py-2.5 text-sm font-semibold transition duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0";

export const primaryButtonClass =
  "bg-trust text-on-trust shadow-[inset_0_-2px_0_rgba(0,0,0,0.18)] hover:bg-trust-strong";

export const secondaryButtonClass =
  "border border-border-strong bg-surface text-ink hover:border-ink hover:bg-surface-alt";

export function PrimaryButton({
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`${buttonBase} ${primaryButtonClass} ${className}`} />;
}

export function SecondaryButton({
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`${buttonBase} ${secondaryButtonClass} ${className}`} />;
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
