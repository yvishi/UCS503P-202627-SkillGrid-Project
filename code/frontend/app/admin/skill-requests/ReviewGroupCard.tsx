"use client";

import { useActionState, useState } from "react";

import { Pill, PrimaryButton, SecondaryButton } from "@/app/ui/primitives";
import { SKILL_CATEGORIES, SKILL_CATEGORY_TAGS } from "@/lib/skill-catalog-core";
import { toSlug } from "@/lib/skill-normalize";
import type { QueueGroup } from "@/lib/skill-review";

import { approveAction, mergeAction, rejectAction, type ReviewActionState } from "./actions";

const inputClass =
  "rounded-theme-sm border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/25";

export function ReviewGroupCard({ group }: { group: QueueGroup }) {
  const [approveState, approve, approving] = useActionState<ReviewActionState, FormData>(approveAction, null);
  const [mergeState, merge, merging] = useActionState<ReviewActionState, FormData>(mergeAction, null);
  const [rejectState, reject, rejecting] = useActionState<ReviewActionState, FormData>(rejectAction, null);
  const [target, setTarget] = useState(group.similar[0]?.slug ?? "");
  const state = approveState ?? mergeState ?? rejectState;
  const otherSpellings = group.spellings.slice(1).map((s) => s.rawName).join(", ");

  return (
    <article className="rounded-theme-lg border border-border bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
        <h2 className="text-lg font-semibold text-ink">{group.displayName}</h2>
        <p className="font-mono text-xs text-ink-muted">
          {group.reporters} {group.reporters === 1 ? "reporter" : "reporters"} · since{" "}
          {new Date(group.oldest).toLocaleDateString()}
        </p>
      </header>

      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="flex flex-wrap gap-1.5">
          {group.spellings.map((s) => (
            <Pill key={s.rawName}>
              {s.rawName} ×{s.count}
            </Pill>
          ))}
        </div>
        {group.notes.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-ink-muted">
            {group.notes.map((note, i) => (
              <li key={i} className="break-words">
                {note}
              </li>
            ))}
          </ul>
        )}

        {state && (
          <p role="status" className={`text-sm ${state.ok ? "text-trust-strong" : "text-danger"}`}>
            {state.message}
          </p>
        )}

        <form action={approve} className="flex flex-col gap-2 rounded-theme-md border border-border p-3">
          <input type="hidden" name="key" value={group.key} />
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">Approve as a new skill</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium">
              Name
              <input name="name" defaultValue={group.displayName} className={inputClass} required />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Slug
              <input name="slug" defaultValue={toSlug(group.displayName)} className={inputClass} required />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Category
              <select name="category" defaultValue="OTHER" className={inputClass}>
                {SKILL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {SKILL_CATEGORY_TAGS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Aliases (comma-separated)
              <input name="aliases" defaultValue={otherSpellings} className={inputClass} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="strictMatch" />
            Case-sensitive resume matching (the name is an ordinary word or very short)
          </label>
          <PrimaryButton type="submit" disabled={approving} className="self-start">
            {approving ? "Approving…" : "Approve"}
          </PrimaryButton>
        </form>

        <form action={merge} className="flex flex-col gap-2 rounded-theme-md border border-border p-3">
          <input type="hidden" name="key" value={group.key} />
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">Merge into an existing skill</p>
          {group.similar.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
              Closest:
              {group.similar.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => setTarget(s.slug)}
                  className="rounded-theme-sm border border-border-strong px-2 py-0.5 font-medium text-ink hover:border-ink"
                >
                  {s.name} ({s.slug})
                </button>
              ))}
            </div>
          )}
          <label className="flex flex-col gap-1 text-xs font-medium">
            Target skill slug
            <input name="target" value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass} required />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="addAlias" defaultChecked />
            Also add &ldquo;{group.displayName}&rdquo; as an alias
          </label>
          <SecondaryButton type="submit" disabled={merging} className="self-start">
            {merging ? "Merging…" : "Merge"}
          </SecondaryButton>
        </form>

        <form action={reject}>
          <input type="hidden" name="key" value={group.key} />
          <button
            type="submit"
            disabled={rejecting}
            className="rounded-theme-sm text-xs font-semibold text-danger underline underline-offset-4 disabled:opacity-40"
          >
            {rejecting ? "Rejecting…" : "Reject all reports for this skill"}
          </button>
        </form>
      </div>
    </article>
  );
}
