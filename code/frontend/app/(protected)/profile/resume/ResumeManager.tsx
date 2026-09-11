"use client";

import { useActionState, useState, useTransition } from "react";

import { PrimaryButton, Pill, SecondaryButton, TrustBadge } from "@/app/ui/primitives";
import { skillLabel } from "@/lib/skills";

import { reuploadResumeAction, selectResumeAction, type ReuploadState } from "./actions";

export type ResumeEntry = {
  id: string;
  filename: string;
  uploadedAt: string;
  extractedSkills: string[];
  usedOcr: boolean;
  active: boolean;
};

export function ResumeManager({ resumes }: { resumes: ResumeEntry[] }) {
  const [state, formAction, isPending] = useActionState<ReuploadState, FormData>(
    reuploadResumeAction,
    null,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="font-display font-bold">Upload a new resume</h2>
        <p className="mt-1 text-sm text-ink-muted">
          PDF only, up to 5MB. Your skills will update automatically from whatever we find.
        </p>
        <form action={formAction} className="mt-4 flex flex-col gap-3">
          <input
            name="resume"
            type="file"
            accept=".pdf,application/pdf"
            required
            className="font-display block w-full rounded-2xl border border-border-strong bg-surface-alt p-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-trust file:px-4 file:py-1.5 file:font-display file:text-xs file:font-semibold file:text-surface"
          />
          {state?.error && <p className="text-sm text-danger">{state.error}</p>}
          <PrimaryButton type="submit" disabled={isPending} className="self-start">
            {isPending ? "Uploading…" : "Upload"}
          </PrimaryButton>
        </form>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display font-bold">Previous resumes</h2>
        {resumes.length === 0 ? (
          <p className="text-sm text-ink-muted">No resumes uploaded yet.</p>
        ) : (
          resumes.map((resume) => <ResumeRow key={resume.id} resume={resume} />)
        )}
      </div>
    </div>
  );
}

function ResumeRow({ resume }: { resume: ResumeEntry }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function makeActive() {
    setError(null);
    startTransition(async () => {
      const result = await selectResumeAction(resume.id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display truncate text-sm font-semibold">{resume.filename}</p>
          <p className="text-xs text-ink-muted">
            {new Date(resume.uploadedAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
            {resume.usedOcr && " · scanned via OCR"}
          </p>
        </div>
        {resume.active ? (
          <TrustBadge>Active</TrustBadge>
        ) : (
          <SecondaryButton type="button" onClick={makeActive} disabled={isPending} className="px-3 py-1.5 text-xs">
            {isPending ? "Switching…" : "Make active"}
          </SecondaryButton>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-1.5">
        {resume.extractedSkills.length > 0 ? (
          resume.extractedSkills.map((slug) => <Pill key={slug}>{skillLabel(slug)}</Pill>)
        ) : (
          <span className="text-xs text-ink-muted">No skills detected</span>
        )}
      </div>
    </div>
  );
}
