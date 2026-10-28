"use client";

import { useId } from "react";

import type { SkillSuggestion } from "@/lib/skill-suggestions";

const SOURCE_LABEL = { github: "GitHub", resume: "Resume" } as const;

// Skills the user's resume or GitHub already show, one click from being
// added. Drawn in the evidence (trust) colour because that's where they
// came from -- once added they become self-ratings like any other.
export function SuggestionStrip({
  suggestions,
  onAdd,
  onAddAll,
}: {
  suggestions: SkillSuggestion[];
  onAdd: (skill: SkillSuggestion) => void;
  onAddAll: () => void;
}) {
  const headingId = useId();
  if (suggestions.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="rounded-theme-md border border-trust/25 bg-trust/[0.04] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-trust-strong">
          Found in your evidence
        </h3>
        <button
          type="button"
          onClick={onAddAll}
          className="rounded-theme-sm text-xs font-semibold text-trust underline underline-offset-4 hover:text-trust-strong"
        >
          Add all {suggestions.length}
        </button>
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-1.5">
        {suggestions.map((s) => {
          const sources = s.sources.map((src) => SOURCE_LABEL[src]).join(" · ");
          return (
            <li key={s.slug}>
              <button
                type="button"
                onClick={() => onAdd(s)}
                aria-label={`Add ${s.name}, found on your ${sources}`}
                className="inline-flex items-center gap-1.5 rounded-theme-sm border border-trust/25 bg-surface py-1 pl-2 pr-2.5 text-xs font-medium text-ink transition hover:border-trust hover:bg-trust/10"
              >
                <span aria-hidden="true" className="text-trust">
                  +
                </span>
                {s.name}
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">{sources}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
