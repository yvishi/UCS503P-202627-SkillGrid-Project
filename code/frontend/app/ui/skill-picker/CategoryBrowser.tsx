"use client";

import { useEffect, useState } from "react";

import {
  SKILL_CATEGORIES,
  SKILL_CATEGORY_LABELS,
  type SkillCategoryName,
  type SkillSearchResult,
} from "@/lib/skill-catalog-core";

const BROWSE_CATEGORIES = SKILL_CATEGORIES.filter((c) => c !== "OTHER");

// For people who don't know what to type: popular skills per category,
// fetched once per category the first time its tab is opened.
export function CategoryBrowser({
  ownedSlugs,
  onAdd,
}: {
  ownedSlugs: ReadonlySet<string>;
  onAdd: (skill: SkillSearchResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<SkillCategoryName>("LANGUAGE");
  const [loaded, setLoaded] = useState<Partial<Record<SkillCategoryName, SkillSearchResult[]>>>({});

  useEffect(() => {
    if (!open || loaded[category]) return;
    let cancelled = false;
    fetch(`/api/skills/popular?category=${category}`)
      .then((res) => (res.ok ? res.json() : { results: [] }))
      .then((body: { results: SkillSearchResult[] }) => {
        if (!cancelled) setLoaded((prev) => ({ ...prev, [category]: body.results }));
      })
      .catch(() => {
        if (!cancelled) setLoaded((prev) => ({ ...prev, [category]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [open, category, loaded]);

  const skills = loaded[category];

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="rounded-theme-md border border-border bg-surface"
    >
      <summary className="cursor-pointer px-3.5 py-2.5 text-sm font-medium text-ink">Browse by category</summary>
      <div className="border-t border-border px-3.5 py-3">
        <div role="tablist" aria-label="Skill categories" className="flex flex-wrap gap-1">
          {BROWSE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={c === category}
              onClick={() => setCategory(c)}
              className={`rounded-theme-sm px-2.5 py-1 text-xs font-medium transition ${
                c === category ? "bg-ink text-bg" : "text-ink-muted hover:bg-surface-alt hover:text-ink"
              }`}
            >
              {SKILL_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="mt-3">
          {!skills ? (
            <p className="text-xs text-ink-muted">Loading…</p>
          ) : skills.length === 0 ? (
            <p className="text-xs text-ink-muted">Nothing here yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {skills.map((s) => {
                const owned = ownedSlugs.has(s.slug);
                return (
                  <li key={s.slug}>
                    <button
                      type="button"
                      disabled={owned}
                      onClick={() => onAdd(s)}
                      className="rounded-theme-sm border border-border-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink transition hover:border-ink disabled:cursor-default disabled:opacity-45"
                    >
                      {owned ? `✓ ${s.name}` : s.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
}
