"use client";

import { useState, useTransition } from "react";

import { SkillRatingRow } from "@/app/ui/skill-picker/SkillRatingRow";
import { primaryButtonClass } from "@/app/ui/primitives";
import { MAX_SKILLS_PER_TEAMMATE } from "@/lib/peer-feedback-core";
import type { SkillRatingLevel } from "@/lib/skills";
import { submitFeedbackAction } from "./actions";

type Skill = { slug: string; name: string };

export function FeedbackForm({
  hackathonSlug,
  toUserId,
  skills,
}: {
  hackathonSlug: string;
  toUserId: string;
  skills: Skill[];
}) {
  const [ratings, setRatings] = useState<Record<string, SkillRatingLevel>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const chosen = skills.filter((s) => ratings[s.slug]);
  const unrated = skills.filter((s) => !ratings[s.slug]);
  const full = chosen.length >= MAX_SKILLS_PER_TEAMMATE;

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const result = await submitFeedbackAction(hackathonSlug, {
        toUserId,
        ratings: chosen.map((s) => ({ slug: s.slug, level: ratings[s.slug] })),
      });
      setMessage(result.ok ? { ok: true, text: "Feedback saved." } : { ok: false, text: result.error });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {chosen.length > 0 && (
        <ul className="flex flex-col gap-px overflow-hidden rounded-theme-sm">
          {chosen.map((s) => (
            <SkillRatingRow
              key={s.slug}
              label={s.name}
              level={ratings[s.slug]}
              busy={pending}
              onSelect={(level) => setRatings((r) => ({ ...r, [s.slug]: level }))}
              onRemove={() =>
                setRatings((r) => {
                  const next = { ...r };
                  delete next[s.slug];
                  return next;
                })
              }
            />
          ))}
        </ul>
      )}

      {unrated.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {unrated.map((s) => (
            <button
              key={s.slug}
              type="button"
              disabled={full || pending}
              onClick={() => setRatings((r) => ({ ...r, [s.slug]: "INTERMEDIATE" }))}
              className="rounded-theme-sm border border-border-strong px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
            >
              + Rate {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="button" onClick={submit} disabled={pending || chosen.length === 0} className={primaryButtonClass}>
          {pending ? "Saving..." : "Submit feedback"}
        </button>
        {message && (
          <p role="status" className={`text-sm ${message.ok ? "text-ink-muted" : "text-danger"}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
