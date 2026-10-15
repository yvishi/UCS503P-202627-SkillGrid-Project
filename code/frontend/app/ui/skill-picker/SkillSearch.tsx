"use client";

import { useEffect, useId, useState } from "react";

import { SKILL_CATEGORY_TAGS, type SkillSearchResponse, type SkillSearchResult } from "@/lib/skill-catalog-core";
import { MAX_SKILL_NAME_LENGTH } from "@/lib/skill-normalize";

import { ReportSkillForm, type ReportHandler } from "./ReportSkillForm";

const DEBOUNCE_MS = 150;

// Type-ahead over the catalog (ARIA combobox, list rendered inline so it
// works at phone width without a floating layer). When nothing matches it
// offers typo fixes first and only then "report it".
export function SkillSearch({
  ownedSlugs,
  onAdd,
  onReport,
}: {
  ownedSlugs: ReadonlySet<string>;
  onAdd: (skill: { slug: string; name: string }) => void;
  onReport: ReportHandler;
}) {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<(SkillSearchResponse & { query: string }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [reporting, setReporting] = useState(false);

  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/skills/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (res.ok) setData({ ...((await res.json()) as SkillSearchResponse), query: trimmed });
      } catch {
        // Aborted by the next keystroke, or offline: keep what's shown.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  const current = trimmed && data?.query === trimmed ? data : null;
  const results = current?.results ?? [];
  const didYouMean = current?.didYouMean ?? [];
  const noMatch = current !== null && !loading && results.length === 0;

  function reset() {
    setQuery("");
    setData(null);
    setActive(0);
    setReporting(false);
  }

  function choose(skill: SkillSearchResult) {
    if (ownedSlugs.has(skill.slug)) return;
    onAdd(skill);
    reset();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && results.length > 0) {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp" && results.length > 0) {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) choose(results[active]);
    } else if (e.key === "Escape") {
      reset();
    }
  }

  return (
    <div>
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        Search skills
      </label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={query}
        maxLength={MAX_SKILL_NAME_LENGTH}
        placeholder="e.g. Rust, Django, Figma"
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setReporting(false);
        }}
        onKeyDown={onKeyDown}
        className="mt-1.5 w-full rounded-theme-md border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted/70 focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/25"
      />

      <ul
        id={listId}
        role="listbox"
        aria-label="Matching skills"
        className={results.length > 0 ? "mt-1 overflow-hidden rounded-theme-md border border-border bg-surface" : "hidden"}
      >
        {results.map((r, i) => {
          const owned = ownedSlugs.has(r.slug);
          return (
            <li
              key={r.slug}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              aria-disabled={owned}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(r)}
              onMouseEnter={() => setActive(i)}
              className={`flex items-center justify-between gap-3 px-3.5 py-2 text-sm ${
                i === active ? "bg-surface-alt" : ""
              } ${owned ? "cursor-default opacity-50" : "cursor-pointer"}`}
            >
              <span className="min-w-0 truncate">
                <span className="font-medium text-ink">{r.name}</span>
                {r.matchedAlias && <span className="ml-2 text-xs text-ink-muted">matches &ldquo;{r.matchedAlias}&rdquo;</span>}
              </span>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                {owned ? "Added" : SKILL_CATEGORY_TAGS[r.category]}
              </span>
            </li>
          );
        })}
      </ul>

      <div aria-live="polite">
        {noMatch && (
          <div className="mt-2 rounded-theme-md border border-dashed border-border-strong bg-surface-alt/40 p-3.5">
            <p className="text-sm text-ink">No skill called &ldquo;{trimmed}&rdquo; in the catalog.</p>
            {didYouMean.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-ink-muted">Did you mean</span>
                {didYouMean.map((s) => (
                  <button
                    key={s.slug}
                    type="button"
                    disabled={ownedSlugs.has(s.slug)}
                    onClick={() => choose(s)}
                    className="rounded-theme-sm border border-border-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink transition hover:border-ink disabled:cursor-default disabled:opacity-45"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            {reporting ? (
              <ReportSkillForm rawName={trimmed} onReport={onReport} onDone={reset} onCancel={() => setReporting(false)} />
            ) : (
              <button
                type="button"
                onClick={() => setReporting(true)}
                className="mt-3 rounded-theme-sm text-xs font-semibold text-trust underline underline-offset-4 hover:text-trust-strong"
              >
                Can&apos;t find it? Report &ldquo;{trimmed}&rdquo;
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
