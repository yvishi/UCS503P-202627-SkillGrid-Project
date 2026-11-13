"use client";

import { StepShell } from "./StepShell";

// Spec sections 4.5 / 5.4: optional, up to 3 project URLs.
export function ProjectsStep({
  value,
  onChange,
  onContinue,
  onSkip,
  onBack,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack?: () => void;
}) {
  const links = value.length > 0 ? value : [""];

  function updateAt(index: number, link: string) {
    const next = [...links];
    next[index] = link;
    onChange(next.filter((l, i) => l.trim() !== "" || i === next.length - 1));
  }

  function addField() {
    onChange([...links, ""]);
  }

  return (
    <StepShell
      title="Show off a project or two"
      description="Optional. Add up to 3 links to repos, demos or write-ups."
      aside={
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted sm:pt-2">
          <span className="text-ink tabular-nums">{links.filter((l) => l.trim() !== "").length}</span> of 3
        </p>
      }
      onContinue={onContinue}
      onSkip={onSkip}
      onBack={onBack}
    >
      <div className="flex flex-col gap-2.5">
        {links.map((link, index) => (
          <label
            key={index}
            className="flex items-center overflow-hidden rounded-theme-md border border-border-strong bg-surface transition-colors focus-within:border-trust focus-within:ring-2 focus-within:ring-trust/25 hover:border-ink-muted focus-within:hover:border-trust"
          >
            <span className="flex items-center self-stretch border-r border-border bg-surface-alt/60 px-3 font-mono text-[11px] font-medium text-ink-muted">
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <span className="sr-only">Project link {index + 1}</span>
            </span>
            <input
              type="url"
              value={link}
              onChange={(e) => updateAt(index, e.target.value)}
              placeholder="https://github.com/you/project"
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm placeholder:text-ink-muted/60 focus:outline-none"
            />
          </label>
        ))}
        {links.length < 3 && (
          <button
            type="button"
            onClick={addField}
            className="inline-flex items-center gap-2 self-start rounded-theme-sm px-1 py-1 text-sm font-medium text-ink-muted transition hover:text-ink"
          >
            <span
              aria-hidden="true"
              className="flex h-4 w-4 items-center justify-center rounded-[4px] border border-dashed border-border-strong text-[11px] leading-none"
            >
              +
            </span>
            Add another
          </button>
        )}
      </div>
    </StepShell>
  );
}
