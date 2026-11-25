"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { Avatar } from "@/app/ui/Avatar";
import { ProgressBar, buttonBase, primaryButtonClass, secondaryButtonClass } from "@/app/ui/primitives";
import { SKILL_RATING_LABELS, SKILL_RATING_LEVELS, type SkillRatingLevel } from "@/lib/skills";
import { submitFeedbackAction } from "./actions";

type Ratings = Record<string, SkillRatingLevel>;

export type FeedbackMate = {
  id: string;
  name: string;
  image: string | null;
  skills: { slug: string; name: string }[];
  /** Ratings already stored for this teammate. */
  saved: Ratings;
};

type Status = "saved" | "draft" | "todo" | "no-skills";

function sameRatings(a: Ratings, b: Ratings) {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

/**
 * One teammate at a time: a rail to move between teammates, a rating panel,
 * and prev / save-and-next controls. Drafts survive switching teammates, and
 * the selected teammate lives in `?to=` so the view can be deep-linked.
 */
export function FeedbackFlow({
  hackathonSlug,
  hackathonHref,
  mates,
  initialMateId,
}: {
  hackathonSlug: string;
  hackathonHref: string;
  mates: FeedbackMate[];
  initialMateId: string | null;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<Record<string, Ratings>>(() =>
    Object.fromEntries(mates.map((m) => [m.id, m.saved])),
  );
  const [drafts, setDrafts] = useState<Record<string, Ratings>>(() =>
    Object.fromEntries(mates.map((m) => [m.id, { ...m.saved }])),
  );
  const [activeId, setActiveId] = useState(() =>
    mates.some((m) => m.id === initialMateId) ? initialMateId! : (firstOpen(mates) ?? mates[0].id),
  );
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  const statusOf = (m: FeedbackMate): Status => {
    if (m.skills.length === 0) return "no-skills";
    if (!sameRatings(drafts[m.id], saved[m.id])) return "draft";
    return Object.keys(saved[m.id]).length > 0 ? "saved" : "todo";
  };

  const index = mates.findIndex((m) => m.id === activeId);
  const mate = mates[index];
  const draft = drafts[mate.id];
  const status = statusOf(mate);
  const ratable = mates.filter((m) => m.skills.length > 0);
  const doneCount = ratable.filter((m) => Object.keys(saved[m.id]).length > 0).length;
  const allDone = ratable.length > 0 && doneCount === ratable.length;
  const anyDirty = mates.some((m) => statusOf(m) === "draft");
  const isLast = index === mates.length - 1;

  // Warn before leaving the page with unsaved ratings.
  useEffect(() => {
    if (!anyDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [anyDirty]);

  function go(id: string) {
    if (id === activeId) return;
    setActiveId(id);
    setMessage(null);
    router.replace(`?to=${encodeURIComponent(id)}`, { scroll: false });
    // On small screens the rail sits above the panel; bring the panel into view.
    if (window.matchMedia("(max-width: 639px)").matches) {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function setLevel(slug: string, level: SkillRatingLevel | null) {
    setMessage(null);
    setDrafts((d) => {
      const next = { ...d[mate.id] };
      if (level) next[slug] = level;
      else delete next[slug];
      return { ...d, [mate.id]: next };
    });
  }

  function save(advance: boolean) {
    const ratings = mate.skills.filter((s) => draft[s.slug]).map((s) => ({ slug: s.slug, level: draft[s.slug] }));
    const mateId = mate.id;
    const snapshot = { ...draft };
    setMessage(null);
    startTransition(async () => {
      const result = await submitFeedbackAction(hackathonSlug, { toUserId: mateId, ratings });
      if (!result.ok) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      setSaved((s) => ({ ...s, [mateId]: snapshot }));
      if (advance && !isLast) {
        go(mates[index + 1].id);
      } else {
        setMessage({ ok: true, text: `Feedback for ${mate.name.split(" ")[0]} saved.` });
      }
    });
  }

  const ratedCount = Object.keys(draft).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Progress + completion */}
      <section
        className={`flex flex-col gap-3 rounded-theme-lg border p-5 ${
          allDone ? "border-trust/30 bg-trust/[0.06]" : "border-border bg-surface"
        }`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-ink">
            {allDone ? "All teammates rated. Thank you!" : `${doneCount} of ${ratable.length} teammates rated`}
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
            {anyDirty ? "Unsaved changes" : "All changes saved"}
          </p>
        </div>
        <ProgressBar fraction={ratable.length ? doneCount / ratable.length : 1} cells={Math.max(ratable.length * 4, 8)} />
        {allDone && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <p className="text-sm text-ink-muted">You can keep editing until the window closes.</p>
            <div className="flex flex-wrap gap-2">
              <Link href={hackathonHref} className={`${buttonBase} ${secondaryButtonClass} px-3 py-1.5`}>
                Back to hackathon
              </Link>
              <Link href="/dashboard" className={`${buttonBase} ${primaryButtonClass} px-3 py-1.5`}>
                Go to dashboard →
              </Link>
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-6 sm:grid-cols-[15rem_minmax(0,1fr)]">
        {/* Teammate rail */}
        <nav aria-label="Teammates">
          <ol className="flex gap-2 overflow-x-auto pb-1 sm:flex-col sm:overflow-visible sm:pb-0">
            {mates.map((m, i) => {
              const s = statusOf(m);
              const active = m.id === activeId;
              return (
                <li key={m.id} className="shrink-0 sm:shrink">
                  <button
                    type="button"
                    onClick={() => go(m.id)}
                    aria-current={active ? "step" : undefined}
                    className={`flex w-full min-w-[11rem] items-center gap-3 rounded-theme-md border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "border-ink bg-surface shadow-[0_1px_0_rgba(0,0,0,0.04)]"
                        : "border-border bg-surface/60 hover:border-border-strong hover:bg-surface"
                    }`}
                  >
                    <Avatar name={m.name} image={m.image} size="h-9 w-9 text-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{m.name}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
                        <StatusDot status={s} />
                        {STATUS_LABEL[s]}
                      </span>
                    </span>
                    <span className="font-mono text-[10px] text-ink-muted">{i + 1}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Rating panel */}
        <section
          ref={panelRef}
          aria-labelledby="mate-heading"
          className="scroll-mt-20 overflow-hidden rounded-theme-lg border border-border bg-surface"
        >
          <div className="flex items-center gap-4 border-b border-border px-5 py-4">
            <Avatar name={mate.name} image={mate.image} size="h-12 w-12 text-sm" />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                Teammate {index + 1} of {mates.length}
              </p>
              <h2 id="mate-heading" className="font-display truncate text-xl font-semibold text-ink">
                {mate.name}
              </h2>
            </div>
            <span className="hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted sm:flex">
              <StatusDot status={status} />
              {STATUS_LABEL[status]}
            </span>
          </div>

          <div className="flex flex-col gap-4 p-5">
            {mate.skills.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-ink-muted">
                <span aria-hidden="true" className="inline-block h-3 w-3 rounded-[3px] border border-dashed border-border-strong" />
                {mate.name.split(" ")[0]} hasn&apos;t listed any skills yet, so there is nothing to rate.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-ink-muted">
                    Pick a level for the skills you saw them use. Skip any you can&apos;t judge.
                  </p>
                  <LevelLegend />
                </div>
                <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-theme-md border border-border">
                  {mate.skills.map((s) => (
                    <PeerSkillRow
                      key={`${mate.id}:${s.slug}`}
                      label={s.name}
                      level={draft[s.slug] ?? null}
                      busy={pending}
                      onChange={(level) => setLevel(s.slug, level)}
                    />
                  ))}
                </ul>
                <p className="font-mono text-[11px] text-ink-muted">
                  {ratedCount} of {mate.skills.length} skills rated
                </p>
              </>
            )}

            {message && (
              <p
                role="status"
                className={`rounded-theme-sm px-3 py-2 text-sm ${
                  message.ok ? "bg-trust/10 text-trust-strong" : "bg-danger/10 text-danger"
                }`}
              >
                {message.text}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-alt/50 px-5 py-3">
            <button
              type="button"
              onClick={() => go(mates[index - 1].id)}
              disabled={index === 0 || pending}
              className={`${buttonBase} ${secondaryButtonClass} px-3 py-2`}
            >
              ← Previous
            </button>
            <div className="flex flex-wrap items-center gap-2">
              {!isLast && (status === "saved" || status === "todo" || status === "no-skills") && (
                <button
                  type="button"
                  onClick={() => go(mates[index + 1].id)}
                  disabled={pending}
                  className="rounded-theme-sm px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-40"
                >
                  {status === "saved" ? "Next →" : "Skip for now →"}
                </button>
              )}
              {status === "draft" && (
                <button
                  type="button"
                  onClick={() => {
                    setMessage(null);
                    setDrafts((d) => ({ ...d, [mate.id]: { ...saved[mate.id] } }));
                  }}
                  disabled={pending}
                  className="rounded-theme-sm px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-danger disabled:opacity-40"
                >
                  Discard changes
                </button>
              )}
              {mate.skills.length > 0 && (
                <button
                  type="button"
                  onClick={() => save(true)}
                  disabled={pending || ratedCount === 0 || status === "saved"}
                  className={`${buttonBase} ${primaryButtonClass}`}
                >
                  {pending ? "Saving…" : isLast ? "Save feedback" : "Save & next →"}
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function firstOpen(mates: FeedbackMate[]) {
  return mates.find((m) => m.skills.length > 0 && Object.keys(m.saved).length === 0)?.id;
}

const STATUS_LABEL: Record<Status, string> = {
  saved: "Rated",
  draft: "Unsaved",
  todo: "Not rated",
  "no-skills": "No skills",
};

function StatusDot({ status }: { status: Status }) {
  const cls =
    status === "saved"
      ? "bg-trust"
      : status === "draft"
        ? "bg-warm"
        : "border border-dashed border-border-strong";
  return <span aria-hidden="true" className={`inline-block h-2 w-2 shrink-0 rounded-[2px] ${cls}`} />;
}

function LevelLegend() {
  return (
    <span aria-hidden="true" className="hidden items-center gap-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted md:flex">
      {SKILL_RATING_LEVELS.map((level, i) => (
        <span key={level} className="flex items-center gap-1.5">
          <span className="flex gap-[2px]">
            {[0, 1, 2].map((c) => (
              <span key={c} className={`h-2 w-2 rounded-[2px] ${c <= i ? "bg-warm" : "bg-cell-0"}`} />
            ))}
          </span>
          {SKILL_RATING_LABELS[level]}
        </span>
      ))}
    </span>
  );
}

/** A skill with a three-cell level picker that can also be left unrated. */
function PeerSkillRow({
  label,
  level,
  onChange,
  busy,
}: {
  label: string;
  level: SkillRatingLevel | null;
  onChange: (level: SkillRatingLevel | null) => void;
  busy: boolean;
}) {
  const labelId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [hover, setHover] = useState<number | null>(null);

  const chosen = level ? SKILL_RATING_LEVELS.indexOf(level) : -1;
  const shown = hover ?? chosen;

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    const last = SKILL_RATING_LEVELS.length - 1;
    let target: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") target = Math.min(i + 1, last);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") target = Math.max(i - 1, 0);
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = last;
    if (target === null) return;
    e.preventDefault();
    buttons.current[target]?.focus();
    if (!busy) onChange(SKILL_RATING_LEVELS[target]);
  }

  return (
    <li className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors ${level ? "bg-warm/[0.05]" : ""}`}>
      <div className="min-w-0">
        <p id={labelId} className="truncate text-sm font-medium text-ink">
          {label}
        </p>
        <p
          aria-hidden="true"
          className={`mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
            shown >= 0 && hover === null ? "text-warm-strong" : "text-ink-muted"
          }`}
        >
          {shown >= 0 ? SKILL_RATING_LABELS[SKILL_RATING_LEVELS[shown]] : "Not rated"}
        </p>
      </div>

      <div className="flex shrink-0 items-center">
        <div role="radiogroup" aria-labelledby={labelId} className="flex" onMouseLeave={() => setHover(null)}>
          {SKILL_RATING_LEVELS.map((lvl, i) => {
            const checked = level === lvl;
            const filled = i <= shown;
            return (
              <button
                key={lvl}
                ref={(el) => {
                  buttons.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-disabled={busy}
                aria-label={SKILL_RATING_LABELS[lvl]}
                title={SKILL_RATING_LABELS[lvl]}
                tabIndex={checked || (chosen === -1 && i === 0) ? 0 : -1}
                onClick={() => {
                  if (!busy && !checked) onChange(lvl);
                }}
                onKeyDown={(e) => onKeyDown(e, i)}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") setHover(i);
                }}
                className="grid h-10 w-9 place-items-center rounded-theme-sm"
              >
                <span
                  aria-hidden="true"
                  className={`h-6 w-6 rounded-[5px] border transition-colors duration-150 ${
                    filled
                      ? hover !== null
                        ? "border-warm/70 bg-warm/45"
                        : "border-warm bg-warm"
                      : "border-border-strong bg-cell-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            if (!busy) onChange(null);
          }}
          disabled={!level}
          aria-disabled={busy}
          aria-label={`Clear rating for ${label}`}
          title="Clear"
          className="ml-1 grid h-9 w-9 place-items-center rounded-theme-sm text-ink-muted transition hover:bg-danger/10 hover:text-danger disabled:invisible"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>
    </li>
  );
}
