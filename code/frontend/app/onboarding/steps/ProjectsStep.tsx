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
      description="Optional — up to 3 links."
      onContinue={onContinue}
      onSkip={onSkip}
      onBack={onBack}
    >
      <div className="flex flex-col gap-2">
        {links.map((link, index) => (
          <input
            key={index}
            type="url"
            value={link}
            onChange={(e) => updateAt(index, e.target.value)}
            placeholder="https://github.com/you/project"
            className="border border-line-strong bg-paper-raised px-3 py-2 text-sm"
          />
        ))}
        {links.length < 3 && (
          <button
            type="button"
            onClick={addField}
            className="font-display self-start text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted transition hover:text-ink"
          >
            + Add another
          </button>
        )}
      </div>
    </StepShell>
  );
}
