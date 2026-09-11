export type StepKey =
  | "resume"
  | "skills"
  | "interests"
  | "availability"
  | "projects"
  | "github"
  | "review";

const STEP_LABELS: Record<StepKey, string> = {
  resume: "Resume",
  skills: "Skills",
  interests: "Interests",
  availability: "Availability",
  projects: "Projects",
  github: "GitHub",
  review: "Review",
};

// Job-application-style horizontal stepper (spec section 3). Steps are
// passed in because Path A includes a "Resume" step that Path B skips.
export function Stepper({ steps, current }: { steps: StepKey[]; current: StepKey }) {
  const currentIndex = steps.indexOf(current);

  return (
    <ol className="mb-8 flex w-full items-center gap-2">
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step} className="flex flex-1 flex-col items-center gap-2 border-b-2 pb-3" style={{ borderColor: done ? "var(--success)" : active ? "var(--trust)" : "var(--border)" }}>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                active
                  ? "bg-trust text-surface"
                  : done
                    ? "bg-success text-surface"
                    : "bg-surface-alt text-ink-muted"
              }`}
            >
              {done ? "✓" : index + 1}
            </div>
            <span
              className={`font-display hidden truncate text-[11px] font-medium sm:block ${
                active ? "text-trust" : done ? "text-ink" : "text-ink-muted"
              }`}
            >
              {STEP_LABELS[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
