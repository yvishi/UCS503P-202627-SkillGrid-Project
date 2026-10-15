"use client";

import { useActionState, useRef, useState } from "react";

import { checkResumeAction, type ResumeCheckState } from "../actions";
import type { SkillSlug } from "@/lib/skills";
import { PrimaryButton, TrustBadge } from "@/app/ui/primitives";

import { ArrowRight, StepCard, StepFooter, StepHeading } from "./StepShell";

const MAX_RESUME_BYTES = 5 * 1024 * 1024;

// Spec section 4.1: upload -> fast integrity check (blocking). On pass,
// checkResumeAction also runs the keyword-based slow parse inline (see
// lib/resume-parser.ts) and we advance immediately with the result.
export function ResumeStep({
  onPassed,
  onSwitchToManual,
}: {
  onPassed: (result: { fileUrl: string; evidenceId: string; extractedSkills: SkillSlug[]; usedOcr: boolean }) => void;
  onSwitchToManual: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ResumeCheckState, FormData>(
    async (prev, formData) => {
      const result = await checkResumeAction(prev, formData);
      if (result.status === "ok") {
        onPassed({
          fileUrl: result.fileUrl,
          evidenceId: result.evidenceId,
          extractedSkills: result.extractedSkills,
          usedOcr: result.usedOcr,
        });
      }
      return result;
    },
    { status: "idle" },
  );
  const [clientError, setClientError] = useState<string | null>(null);
  // Display-only: the chosen file's name/size for the dropzone. The file
  // itself always lives in the <input>, which is what the form submits.
  const [picked, setPicked] = useState<{ name: string; size: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function validate(file: File | undefined) {
    if (!file) {
      setClientError(null);
      setPicked(null);
      return;
    }
    setPicked({ name: file.name, size: file.size });
    if (file.size > MAX_RESUME_BYTES) {
      setClientError("That file is over 5MB. Export a smaller PDF and try again.");
    } else if (file.type !== "application/pdf") {
      setClientError("That file isn't a PDF. Save your resume as a PDF and choose it again.");
    } else {
      setClientError(null);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    validate(e.target.files?.[0]);
  }

  // Dropping a file onto the zone hands it to the real <input> so the form
  // submits it exactly as if it had been picked from the dialog.
  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    if (isPending) return;
    const file = e.dataTransfer.files?.[0];
    const input = inputRef.current;
    if (!file || !input) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    validate(file);
  }

  const hasError = !!clientError || state.status === "error";

  return (
    <StepCard>
      <StepHeading
        title="Upload your resume"
        description="PDF only, up to 5MB. We check it's really a resume, then pull skill tags from it."
        aside={<TrustBadge pending={state.status !== "ok"}>Counts as evidence</TrustBadge>}
      />

      {/* React resets the form after the action runs, which clears the
          file input -- so the display state is cleared alongside it. */}
      <form action={formAction} onReset={() => setPicked(null)}>
        <div className="flex flex-col gap-4 px-5 pb-6 sm:px-7">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              if (!isPending) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`group relative flex flex-col items-center gap-4 rounded-theme-md border-2 border-dashed px-5 py-9 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-trust ${
              isPending
                ? "cursor-wait border-trust/40 bg-trust/[0.04]"
                : "cursor-pointer " +
                  (dragging
                  ? "border-trust bg-trust/[0.06]"
                  : hasError
                    ? "border-danger/50 bg-surface hover:border-danger"
                    : picked
                      ? "border-trust/50 bg-surface hover:border-trust"
                      : "border-border-strong bg-surface-alt/30 hover:border-ink-muted")
            }`}
          >
            <input
              ref={inputRef}
              name="resume"
              type="file"
              accept=".pdf,application/pdf"
              required
              onChange={handleFileChange}
              className="sr-only"
            />

            <ScanCells active={isPending} filled={!!picked && !hasError} />

            {isPending ? (
              <span className="flex flex-col gap-1" role="status">
                <span className="font-semibold">Checking your resume…</span>
                <span className="text-sm text-ink-muted">Reading it and matching skills. This takes a few seconds.</span>
              </span>
            ) : picked ? (
              <span className="flex max-w-full flex-col gap-1">
                <span className="truncate font-semibold">{picked.name}</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
                  {formatSize(picked.size)} · <span className="text-ink underline underline-offset-2">Choose a different file</span>
                </span>
              </span>
            ) : (
              <span className="flex flex-col gap-1">
                <span className="font-semibold">
                  {dragging ? "Drop your PDF here" : (
                    <>
                      Drop your PDF here, or <span className="text-trust-strong underline underline-offset-2">browse</span>
                    </>
                  )}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">PDF · max 5MB</span>
              </span>
            )}
          </label>

          {clientError && (
            <p role="alert" className="rounded-theme-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
              {clientError}
            </p>
          )}

          {state.status === "error" && (
            <div role="alert" className="flex flex-col gap-3 rounded-theme-md border border-danger/30 bg-danger/5 p-4">
              <p className="text-sm text-danger">{state.reason}</p>
              <button
                type="button"
                onClick={onSwitchToManual}
                className="self-start rounded-theme-sm text-sm font-semibold text-ink underline decoration-border-strong underline-offset-4 hover:decoration-ink"
              >
                Continue manually instead
              </button>
            </div>
          )}
        </div>

        <StepFooter
          actions={
            <PrimaryButton type="submit" disabled={isPending || !!clientError}>
              {isPending ? "Checking…" : "Continue"}
              {!isPending && <ArrowRight />}
            </PrimaryButton>
          }
        />
      </form>
    </StepCard>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// A 3x5 patch of grid cells: empty while idle, filled once a file is
// picked, and sweeping while the server checks and parses it.
function ScanCells({ active, filled }: { active: boolean; filled: boolean }) {
  return (
    <span aria-hidden="true" className="grid grid-cols-5 gap-[3px]">
      {Array.from({ length: 15 }, (_, i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        return (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-[3px] transition-colors duration-300 ${
              active ? "bg-cell-2 motion-safe:animate-pulse" : filled ? (i % 3 === 0 ? "bg-cell-2" : "bg-trust") : "bg-cell-0"
            }`}
            style={active ? { animationDelay: `${(col + row) * 120}ms` } : { transitionDelay: `${(col + row) * 30}ms` }}
          />
        );
      })}
    </span>
  );
}
