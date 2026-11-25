"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Eyebrow, Pill, PrimaryButton } from "@/app/ui/primitives";
import type { LeadTeamOption } from "@/lib/discovery-core";
import { MAX_IDEA_LENGTH, MIN_IDEA_LENGTH } from "@/lib/idea-breakdown-core";

import { InviteButton } from "../InviteButton";
import { TeammateCard } from "../MatchCards";
import { matchIdeaAction, type IdeaMatchResult } from "./actions";

type Success = Extract<IdeaMatchResult, { ok: true }>;

/**
 * "Describe your idea": an LLM breaks the idea into skills, then the panel
 * lists people holding any of them. Each catalog skill links to the regular
 * filtered list for that one skill.
 */
export function IdeaMatcher({
  leadTeams,
  pendingByUser,
}: {
  leadTeams: LeadTeamOption[];
  pendingByUser: Record<string, string[]>;
}) {
  const [idea, setIdea] = useState("");
  const [result, setResult] = useState<Success | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const length = idea.trim().length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await matchIdeaAction(idea);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res);
    });
  }

  return (
    <section className="flex flex-col gap-5 rounded-theme-lg border border-border bg-surface p-5">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="idea" className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-ink">Describe your idea</span>
          <span className="text-xs text-ink-muted">
            We&apos;ll break it into the skills it needs and find people who have them.
          </span>
        </label>
        <textarea
          id="idea"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={3}
          maxLength={MAX_IDEA_LENGTH}
          placeholder="e.g. A mobile app that lets students split bills, with OCR for receipts and UPI payments"
          className="w-full resize-y rounded-theme-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
        />
        <div className="flex items-center gap-3">
          <PrimaryButton
            type="submit"
            disabled={pending || length < MIN_IDEA_LENGTH}
            className="px-4 py-2 text-xs"
          >
            {pending ? "Breaking it down…" : "Find teammates for this idea"}
          </PrimaryButton>
          <span className="font-mono text-xs tabular-nums text-ink-muted">
            {length}/{MAX_IDEA_LENGTH}
          </span>
        </div>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
      </form>

      {result && (
        <div className="flex flex-col gap-5 border-t border-border pt-5" aria-live="polite">
          {result.summary && <p className="text-sm text-ink">{result.summary}</p>}

          <div className="flex flex-col gap-2">
            <Eyebrow>Skills this idea needs</Eyebrow>
            <ul className="flex flex-col gap-2">
              {result.skills.map((s) => (
                <li key={s.slug ?? s.name} className="flex flex-wrap items-baseline gap-2 text-xs">
                  {s.slug ? (
                    <Link href={`/dashboard/teammates?skill=${encodeURIComponent(s.slug)}`} title="Show everyone with this skill">
                      <Pill tone="trust">{s.name}</Pill>
                    </Link>
                  ) : (
                    <span title="Not in the skill catalog yet, so no one can be matched on it">
                      <Pill>{s.name} (not in catalog)</Pill>
                    </span>
                  )}
                  {s.why && <span className="text-ink-muted">{s.why}</span>}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <Eyebrow>People who can help</Eyebrow>
            {result.teammates.length === 0 ? (
              <p className="text-xs text-ink-muted">No one with these skills is on SkillGrid yet.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {result.teammates.map((t) => (
                  <li key={t.userId}>
                    <TeammateCard
                      teammate={t}
                      action={
                        <InviteButton
                          userId={t.userId}
                          teams={leadTeams}
                          pendingTeamIds={pendingByUser[t.userId] ?? []}
                        />
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
