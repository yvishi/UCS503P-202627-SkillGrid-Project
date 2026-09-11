"use client";

import { useActionState, useState } from "react";

import { checkResumeAction, type ResumeCheckState } from "../actions";
import type { SkillSlug } from "@/lib/skills";

const MAX_RESUME_BYTES = 5 * 1024 * 1024;

// Spec section 4.1: upload -> fast integrity check (blocking). On pass,
// checkResumeAction also runs the keyword-based slow parse inline (see
// lib/resume-parser.ts) and we advance immediately with the result.
export function ResumeStep({
  onPassed,
  onSwitchToManual,
}: {
  onPassed: (result: { fileUrl: string; extractedSkills: SkillSlug[] }) => void;
  onSwitchToManual: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ResumeCheckState, FormData>(
    async (prev, formData) => {
      const result = await checkResumeAction(prev, formData);
      if (result.status === "ok") {
        onPassed({ fileUrl: result.fileUrl, extractedSkills: result.extractedSkills });
      }
      return result;
    },
    { status: "idle" },
  );
  const [clientError, setClientError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setClientError(null);
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      setClientError("Resume must be 5MB or smaller.");
    } else if (file.type !== "application/pdf") {
      setClientError("Resume must be a PDF file.");
    } else {
      setClientError(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Upload your resume</h1>
        <p className="mt-1 text-sm text-ink-muted">
          PDF only, up to 5MB. We&apos;ll check it&apos;s really a resume, then pull skill tags from it.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input
          name="resume"
          type="file"
          accept=".pdf,application/pdf"
          required
          onChange={handleFileChange}
          className="font-display block w-full rounded-2xl border border-border-strong bg-surface p-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-trust file:px-4 file:py-1.5 file:font-display file:text-xs file:font-semibold file:text-surface"
        />

        {clientError && <p className="text-sm text-danger">{clientError}</p>}

        {state.status === "error" && (
          <div className="flex flex-col gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-4">
            <p className="text-sm text-danger">{state.reason}</p>
            <button
              type="button"
              onClick={onSwitchToManual}
              className="font-display self-start text-sm font-medium text-trust underline decoration-trust/40 underline-offset-2 hover:decoration-trust"
            >
              Continue manually instead
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
          <span />
          <button
            type="submit"
            disabled={isPending || !!clientError}
            className="font-display inline-flex items-center justify-center gap-2 rounded-full bg-trust px-5 py-2.5 text-sm font-semibold text-surface shadow-sm transition hover:bg-trust-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? "Checking…" : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}
