import Link from "next/link";

import { Eyebrow, buttonBase, primaryButtonClass } from "@/app/ui/primitives";
import { GUIDE_STEPS, type GuideState, type GuideStepId } from "@/lib/guide-core";
import type { HackathonSummary } from "@/lib/teams";

import { formatIst } from "../hackathons/format";
import { ackGuideStepAction, hideGuideAction } from "./actions";
import { GridPanel } from "./GridPanel";
import type { DashboardSkillGrid } from "./grid-data";

// The one-time "getting started" guide: SkillGrid's five features, met one
// at a time. Only the current step is open and only it carries the accent
// colour. Steps tick themselves (lib/guide-core.ts); nothing is locked.

const primaryLink = `${buttonBase} ${primaryButtonClass}`;
const plainLink = "rounded-theme-sm text-sm font-semibold text-trust underline underline-offset-4 hover:text-trust-strong";

const COPY: Record<GuideStepId, { title: string; line: string; href: string | null }> = {
  profile: {
    title: "Build your profile",
    line: "Add your skills, then back them with a resume or GitHub.",
    href: "/profile",
  },
  hackathon: {
    title: "Join a hackathon",
    line: "Pick the event you want a team for.",
    href: "/hackathons",
  },
  team: {
    title: "Find teammates or a team",
    line: "See who has the skills you need, or join a team with an open slot.",
    href: "/dashboard/teammates",
  },
  invites: {
    title: "Answer invites",
    line: "Invites and join requests land in one place.",
    href: "/invites",
  },
  feedback: {
    title: "Give peer feedback",
    line: "After a hackathon, rate your teammates' skills. It becomes evidence on their grid, and theirs on yours.",
    href: null,
  },
};

function StepMark({ kind, number }: { kind: "done" | "current" | "later"; number: number }) {
  const base = "flex h-7 w-7 shrink-0 items-center justify-center rounded-theme-sm font-mono text-xs font-semibold";
  if (kind === "done") {
    return (
      <span className={`${base} bg-trust text-on-trust`}>
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z" />
        </svg>
        <span className="sr-only">Done</span>
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${base} ${kind === "current" ? "border-2 border-accent text-accent" : "border border-border-strong text-ink-muted"}`}
    >
      {number}
    </span>
  );
}

function AckButton({ step, children }: { step: GuideStepId; children: React.ReactNode }) {
  return (
    <form action={ackGuideStepAction}>
      <input type="hidden" name="step" value={step} />
      <button type="submit" className={primaryLink}>
        {children}
      </button>
    </form>
  );
}

// What the open step shows under its one-line explanation.
function CurrentStepBody({
  step,
  hackathons,
  feedbackHref,
}: {
  step: GuideStepId;
  hackathons: HackathonSummary[];
  feedbackHref: string | null;
}) {
  switch (step) {
    case "profile":
      return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/profile" className={primaryLink}>
            Add evidence
          </Link>
          <Link href="/profile/skills" className={plainLink}>
            Edit skills
          </Link>
        </div>
      );
    case "hackathon":
      if (hackathons.length === 0) {
        return <p className="text-sm text-ink-muted">No hackathons are open yet. Check back soon.</p>;
      }
      return (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {hackathons.map((h) => (
              <li key={h.slug}>
                <Link
                  href={`/hackathons/${h.slug}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-theme-md border border-border bg-surface-alt px-3 py-2 transition-colors hover:border-border-strong"
                >
                  <span className="text-sm font-semibold text-ink">{h.name}</span>
                  <span className="font-mono text-xs text-ink-muted">
                    {h.phase === "running" ? "Running now" : `Starts ${formatIst(h.startsAt)}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div>
            <Link href="/hackathons" className={primaryLink}>
              Browse hackathons
            </Link>
          </div>
        </div>
      );
    case "team":
      return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/dashboard/teammates" className={primaryLink}>
            Find teammates
          </Link>
          <Link href="/dashboard/teams" className={plainLink}>
            Browse teams
          </Link>
        </div>
      );
    case "invites":
      return <AckButton step="invites">See your invites</AckButton>;
    case "feedback":
      return feedbackHref ? (
        <div>
          <Link href={feedbackHref} className={primaryLink}>
            Give feedback
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">Nothing to rate yet. It opens when a hackathon you teamed up in ends.</p>
          <AckButton step="feedback">Got it</AckButton>
        </div>
      );
  }
}

export function GuideView({
  firstName,
  state,
  doneNotes,
  grid,
  hackathons,
  feedbackHref,
  review,
}: {
  firstName: string;
  state: GuideState;
  /** One-line summaries for finished steps. */
  doneNotes: Partial<Record<GuideStepId, string>>;
  grid: DashboardSkillGrid;
  /** Hackathons that have not ended, soonest first; the hackathon step shows the first two. */
  hackathons: HackathonSummary[];
  /** Feedback page of a finished hackathon where feedback is due, if any. */
  feedbackHref: string | null;
  /** Reopened from the home base after the guide ended: nothing to hide. */
  review: boolean;
}) {
  const currentNumber = state.current ? GUIDE_STEPS.indexOf(state.current) + 1 : GUIDE_STEPS.length;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <Eyebrow>{review ? "How SkillGrid works" : "Getting started"}</Eyebrow>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {review ? "The five steps" : `Welcome, ${firstName}`}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {state.allDone
              ? "You've been through all five."
              : `Step ${currentNumber} of ${GUIDE_STEPS.length}. One thing at a time.`}
          </p>
        </div>
        {review ? (
          <Link href="/dashboard" className="rounded-theme-sm text-sm text-ink-muted underline underline-offset-4 hover:text-ink">
            Back to dashboard
          </Link>
        ) : (
          <form action={hideGuideAction}>
            <button
              type="submit"
              className="rounded-theme-sm text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
            >
              Hide guide
            </button>
          </form>
        )}
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        {/* First in the DOM so it sits above the steps on a phone. */}
        <aside className="lg:sticky lg:top-20 lg:order-2">
          <GridPanel grid={grid} variant="side" />
        </aside>

        <ol className="flex flex-col gap-3 lg:order-1">
          {GUIDE_STEPS.map((step, index) => {
            const copy = COPY[step];
            const kind = state.done[step] ? "done" : step === state.current ? "current" : "later";
            const href = step === "feedback" ? feedbackHref : copy.href;

            if (kind === "current") {
              return (
                <li
                  key={step}
                  aria-current="step"
                  className="flex gap-4 rounded-theme-lg border-2 border-accent bg-surface p-5"
                >
                  <StepMark kind="current" number={index + 1} />
                  <div className="flex min-w-0 flex-1 flex-col gap-4">
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight text-ink">{copy.title}</h2>
                      <p className="mt-1 text-sm text-ink-muted">{copy.line}</p>
                    </div>
                    <CurrentStepBody step={step} hackathons={hackathons.slice(0, 2)} feedbackHref={feedbackHref} />
                  </div>
                </li>
              );
            }

            const title = href ? (
              <Link href={href} className="rounded-theme-sm hover:underline hover:underline-offset-4">
                {copy.title}
              </Link>
            ) : (
              copy.title
            );
            return (
              <li
                key={step}
                className={`flex items-center gap-4 rounded-theme-lg border border-border bg-surface px-5 py-3.5 ${
                  kind === "later" ? "opacity-75" : ""
                }`}
              >
                <StepMark kind={kind} number={index + 1} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-ink">{title}</h2>
                  <p className="mt-0.5 truncate text-sm text-ink-muted">
                    {kind === "done" ? (doneNotes[step] ?? "Done") : copy.line}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
