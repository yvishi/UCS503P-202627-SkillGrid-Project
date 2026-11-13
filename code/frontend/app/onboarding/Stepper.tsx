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

// Job-application-style horizontal stepper (spec section 3), drawn as a row
// of grid cells: done = filled ultramarine, current = outlined + pulsing,
// upcoming = empty cell. Steps are passed in because Path A includes a
// "Resume" step that Path B skips.
export function Stepper({ steps, current }: { steps: StepKey[]; current: StepKey }) {
  const currentIndex = steps.indexOf(current);
  const lastIndex = steps.length - 1;

  return (
    <nav aria-label="Profile setup progress" className="mb-6">
      <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
        Step <span className="text-ink tabular-nums">{currentIndex + 1}</span> of{" "}
        <span className="tabular-nums">{steps.length}</span>
        <span aria-hidden="true" className="sm:hidden">
          {" "}
          · <span className="text-trust-strong">{STEP_LABELS[current]}</span>
        </span>
      </p>

      <ol className="flex w-full items-start">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          const isLast = index === lastIndex;
          return (
            <li
              key={step}
              aria-current={active ? "step" : undefined}
              className={`flex min-w-0 flex-col gap-2 ${isLast ? "flex-none" : "flex-1"}`}
            >
              <span aria-hidden="true" className="flex items-center gap-1.5">
                <span className="relative flex h-4 w-4 shrink-0">
                  {active && (
                    <span className="absolute inset-0 rounded-[4px] border border-trust opacity-60 motion-safe:animate-ping" />
                  )}
                  <span
                    className={`relative h-4 w-4 rounded-[4px] transition-colors duration-300 ${
                      done
                        ? "bg-trust"
                        : active
                          ? "border-2 border-trust bg-trust/15"
                          : "bg-cell-0"
                    }`}
                  />
                </span>
                {!isLast && (
                  <span
                    className={`h-px flex-1 transition-colors duration-300 ${done ? "bg-trust" : "bg-border-strong"}`}
                  />
                )}
              </span>
              <span
                aria-hidden="true"
                className={`hidden truncate pr-2 font-mono text-[10px] font-medium uppercase tracking-[0.12em] sm:block ${
                  active ? "text-trust-strong" : done ? "text-ink" : "text-ink-muted"
                }`}
              >
                {STEP_LABELS[step]}
              </span>
              <span className="sr-only">
                {STEP_LABELS[step]}
                {done ? ", done" : active ? ", current step" : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
