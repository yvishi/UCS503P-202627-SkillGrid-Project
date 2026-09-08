export function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
        {title}
      </h2>
      {children}
    </div>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700">
      {children}
    </span>
  );
}

export function Empty({ message }: { message: string }) {
  return (
    <p className="text-sm text-neutral-400 dark:text-neutral-600">{message}</p>
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
      className={
        done
          ? "flex items-center gap-2 text-sm"
          : `flex items-center gap-2 text-sm ${
              disabled
                ? "text-neutral-300 dark:text-neutral-700"
                : "text-neutral-400 dark:text-neutral-600"
            }`
      }
    >
      <span
        className={
          done
            ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white"
            : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-[10px] dark:border-neutral-700"
        }
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
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
      <div
        className="h-full rounded-full bg-indigo-600 transition-all"
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
    <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && (
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {hint}
        </p>
      )}
    </div>
  );
}
