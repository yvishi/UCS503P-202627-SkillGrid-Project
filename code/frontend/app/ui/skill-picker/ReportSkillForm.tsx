"use client";

import { useState } from "react";

import { PrimaryButton, SecondaryButton } from "@/app/ui/primitives";
import { MAX_REPORT_NOTE_LENGTH, type ReportResult } from "@/lib/skill-report-input";
import { DEFAULT_SKILL_LEVEL, SKILL_RATING_LABELS, SKILL_RATING_LEVELS, type SkillRatingLevel } from "@/lib/skills";

export type ReportHandler = (input: { rawName: string; level: SkillRatingLevel; note: string }) => Promise<ReportResult>;

// Shown only after search and "did you mean" both came up empty. Nothing
// is added to the catalog from here -- an admin reviews it first.
export function ReportSkillForm({
  rawName,
  onReport,
  onDone,
  onCancel,
}: {
  rawName: string;
  onReport: ReportHandler;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [level, setLevel] = useState<SkillRatingLevel>(DEFAULT_SKILL_LEVEL);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await onReport({ rawName, level, note });
    setSubmitting(false);
    if (res.status === "error") setError(res.error);
    else onDone();
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
      <p className="text-xs text-ink-muted">
        We&apos;ll check &ldquo;{rawName}&rdquo; and add it to the catalog. Until then it shows as pending on your
        profile.
      </p>
      <fieldset>
        <legend className="text-xs font-medium text-ink">Your comfort level</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {SKILL_RATING_LEVELS.map((l) => (
            <label
              key={l}
              className={`cursor-pointer rounded-theme-sm border px-2.5 py-1 text-xs font-medium transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-trust ${
                level === l ? "border-warm bg-warm/10 text-warm-strong" : "border-border-strong text-ink-muted hover:text-ink"
              }`}
            >
              <input
                type="radio"
                name="report-level"
                value={l}
                checked={level === l}
                onChange={() => setLevel(l)}
                className="sr-only"
              />
              {SKILL_RATING_LABELS[l]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-xs font-medium text-ink">
        Note (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={MAX_REPORT_NOTE_LENGTH}
          rows={2}
          placeholder="What is it? A link helps."
          className="rounded-theme-sm border border-border-strong bg-surface px-2.5 py-1.5 text-sm font-normal text-ink placeholder:text-ink-muted/70 focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/25"
        />
      </label>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Report skill"}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={onCancel}>
          Cancel
        </SecondaryButton>
      </div>
    </form>
  );
}
