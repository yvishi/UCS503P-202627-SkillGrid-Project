import { Eyebrow } from "@/app/ui/primitives";

// Spec section 2: one question, two buttons, nothing else. No stepper here.
export function BranchStep({ onChoose }: { onChoose: (path: "A" | "B") => void }) {
  return (
    <div className="flex flex-col items-center gap-8 py-8 text-center">
      <div>
        <Eyebrow>New profile</Eyebrow>
        <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">
          Do you have a resume you&apos;d like to upload?
        </h1>
      </div>

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChoose("A")}
          className="border border-line-strong p-5 text-left transition hover:border-ink hover:bg-paper-raised"
        >
          <p className="font-display font-semibold">Yes, I have a resume</p>
          <p className="mt-1 text-sm text-ink-muted">
            We&apos;ll pull skill tags from it automatically.
          </p>
        </button>
        <button
          type="button"
          onClick={() => onChoose("B")}
          className="border border-line-strong p-5 text-left transition hover:border-ink hover:bg-paper-raised"
        >
          <p className="font-display font-semibold">No, I&apos;ll set up manually</p>
          <p className="mt-1 text-sm text-ink-muted">
            Tell us your skills and interests yourself.
          </p>
        </button>
      </div>
    </div>
  );
}
