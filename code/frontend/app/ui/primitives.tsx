// Shared visual primitives for SkillGrid. Used by both the public
// (landing) and protected (dashboard/profile/onboarding) surfaces, which
// is why this lives outside the (protected) route group.

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display inline-block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
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
    <div className="border border-line bg-paper-raised p-5">
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
    <span className="font-display inline-block border border-line-strong px-2.5 py-1 text-xs">
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
        className={`font-display flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
          done
            ? "border-verified bg-verified text-paper-raised"
            : "border-line-strong"
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
      className="h-1.5 w-full overflow-hidden bg-line/60"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-verified transition-all"
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
    <div className="border border-line bg-paper-raised p-5">
      <Eyebrow>{label}</Eyebrow>
      <p className="font-display mt-2 text-2xl font-semibold tracking-tight">
        {value}
      </p>
      {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
    </div>
  );
}

/**
 * The signature element: a rubber-stamp badge for anything that counts as
 * verified evidence (resume on file, GitHub connected, etc). Literalizes
 * "trust through evidence, not self-report" instead of using a generic
 * checkmark badge. `pending` renders the same ring in a muted ink tone for
 * evidence that's been submitted but not yet verified.
 */
export function Stamp({
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
      className={`font-display relative inline-flex -rotate-3 items-center gap-1.5 border-2 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] ${
        pending
          ? "border-ink-muted/50 text-ink-muted"
          : "border-stamp text-stamp"
      } ${className}`}
    >
      <span
        className={`absolute inset-[3px] border ${pending ? "border-ink-muted/30" : "border-stamp/40"}`}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

const buttonBase =
  "font-display inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.04em] transition disabled:cursor-not-allowed disabled:opacity-40";

export function PrimaryButton({
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${buttonBase} border-2 border-ink bg-ink text-paper hover:bg-transparent hover:text-ink ${className}`}
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
      className={`${buttonBase} border-2 border-line-strong text-ink hover:border-ink ${className}`}
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
