"use client";

import { useMemo } from "react";

import { Pill } from "@/app/ui/primitives";
import type { OpenReport } from "@/lib/skill-report-input";
import { rankSuggestions, type EvidenceSnapshot } from "@/lib/skill-suggestions";

import { CategoryBrowser } from "./CategoryBrowser";
import { SkillRatingRow, LevelKey } from "./SkillRatingRow";
import { SkillSearch } from "./SkillSearch";
import { SuggestionStrip } from "./SuggestionStrip";
import { useSkillEditor, type SkillEditorState } from "./use-skill-editor";

// Spec section 5.1. One component for onboarding and /profile/skills;
// every change saves immediately through app/skills/actions.ts.
export function SkillPicker({
  initial,
  evidence,
  onChange,
}: {
  initial: SkillEditorState;
  evidence: EvidenceSnapshot | null;
  onChange?: (state: SkillEditorState) => void;
}) {
  const editor = useSkillEditor(initial, onChange);
  const owned = useMemo(() => new Set(editor.skills.map((s) => s.slug)), [editor.skills]);
  const suggestions = useMemo(() => (evidence ? rankSuggestions(evidence, owned) : []), [evidence, owned]);

  return (
    <div className="flex flex-col gap-4">
      <SuggestionStrip
        suggestions={suggestions}
        onAdd={(s) => editor.add(s)}
        onAddAll={() => editor.addMany(suggestions)}
      />
      <SkillSearch ownedSlugs={owned} onAdd={(s) => editor.add(s)} onReport={editor.report} />
      <CategoryBrowser ownedSlugs={owned} onAdd={(s) => editor.add(s)} />

      {editor.error && (
        <p
          role="alert"
          className="flex items-start justify-between gap-3 rounded-theme-md border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger"
        >
          {editor.error}
          <button type="button" onClick={editor.dismissError} className="shrink-0 text-xs font-semibold underline">
            Dismiss
          </button>
        </p>
      )}

      <section aria-label="Your skills" className="overflow-hidden rounded-theme-md border border-border">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-surface-alt/50 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Pill tone="warm">Self-reported</Pill>
            <LevelKey />
          </div>
          <p aria-live="polite" className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
            <span className="tabular-nums text-ink">{editor.skills.length}</span>{" "}
            {editor.skills.length === 1 ? "skill" : "skills"}
          </p>
        </div>
        {editor.skills.length === 0 && editor.reports.length === 0 ? (
          <p className="bg-surface px-4 py-6 text-sm text-ink-muted">No skills yet. Search above or add a suggestion.</p>
        ) : (
          <ul className="divide-y divide-border">
            {editor.skills.map((s) => (
              <SkillRatingRow
                key={s.slug}
                label={s.name}
                level={s.level}
                busy={editor.busy.has(s.slug)}
                onSelect={(level) => editor.setLevel(s.slug, level)}
                onRemove={() => editor.remove(s.slug)}
              />
            ))}
            {editor.reports.map((r) => (
              <ReportRow
                key={r.id}
                report={r}
                busy={editor.busy.has(r.id)}
                onCancel={() => editor.cancelReport(r.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ReportRow({ report, busy, onCancel }: { report: OpenReport; busy: boolean; onCancel: () => void }) {
  const pending = report.status === "PENDING";
  return (
    <li className="flex items-center justify-between gap-3 bg-surface-alt/40 px-4 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink-muted">{report.rawName}</p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted/80">
          {pending ? "Pending review" : "Not added"}
        </p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded-theme-sm text-xs font-semibold text-ink-muted underline decoration-border-strong underline-offset-4 transition hover:text-ink disabled:opacity-40"
      >
        {pending ? "Cancel" : "Dismiss"}
      </button>
    </li>
  );
}
