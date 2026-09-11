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
  review: "Review & Submit",
};

// Job-application-style horizontal stepper (spec section 3). Steps are
// passed in because Path A includes a "Resume" step that Path B skips.
export function Stepper({ steps, current }: { steps: StepKey[]; current: StepKey }) {
  const currentIndex = steps.indexOf(current);

  return (
    <ol className="mb-8 flex w-full items-stretch border border-line">
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li
            key={step}
            className={`font-display flex flex-1 flex-col gap-1 border-r border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] last:border-r-0 ${
              active
                ? "bg-ink text-paper"
                : done
                  ? "text-ink"
                  : "text-ink-muted/60"
            }`}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <span className="truncate">{STEP_LABELS[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}
