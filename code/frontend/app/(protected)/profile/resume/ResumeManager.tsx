"use client";

import { useActionState, useEffect, useId, useState, useTransition } from "react";

import { Eyebrow, PrimaryButton, Pill, SecondaryButton } from "@/app/ui/primitives";

import { reuploadResumeAction, selectResumeAction, type ReuploadState } from "./actions";

export type ResumeEntry = {
  id: string;
  filename: string;
  uploadedAt: string;
  extractedSkills: { slug: string; name: string }[];
  usedOcr: boolean;
  active: boolean;
};

// Mirrors MAX_RESUME_BYTES in lib/resume-upload.ts. Only used to warn
// early in the picker; the server still does the real validation.
const MAX_BYTES = 5 * 1024 * 1024;
// The upload and the parse happen in one server request. After this long
// the bytes are almost certainly sent and the server is reading the PDF.
const PARSING_AFTER_MS = 1500;
// Decorative cells in the drop zone; they fill once a file is chosen.
const PREVIEW_CELLS = ["bg-cell-1", "bg-cell-2", "bg-cell-3", "bg-cell-4", "bg-cell-2", "bg-cell-3", "bg-cell-4", "bg-cell-3"];

export function ResumeManager({ resumes }: { resumes: ResumeEntry[] }) {
  const [state, formAction, isPending] = useActionState<ReuploadState, FormData>(
    reuploadResumeAction,
    null,
  );

  return (
    <div className="flex flex-col gap-8">
      <UploadPanel state={state} formAction={formAction} isPending={isPending} />

      <section aria-labelledby="resume-ledger-heading">
        <div className="flex items-baseline justify-between gap-3 border-b border-border-strong pb-2">
          <h2 id="resume-ledger-heading">
            <Eyebrow>Uploaded resumes</Eyebrow>
          </h2>
          <span className="font-mono text-xs text-ink-muted tabular-nums">
            {resumes.length} {resumes.length === 1 ? "file" : "files"}
          </span>
        </div>
        {resumes.length === 0 ? (
          <div className="py-6">
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-[3px] border border-dashed border-border-strong"
              />
              No resumes yet. Upload a PDF above and the skills it names become evidence on your profile.
            </p>
          </div>
        ) : (
          <ol className="divide-y divide-border">
            {resumes.map((resume) => (
              <ResumeRow key={resume.id} resume={resume} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

type Phase = "uploading" | "parsing";

function UploadPanel({
  state,
  formAction,
  isPending,
}: {
  state: ReuploadState;
  formAction: (formData: FormData) => void;
  isPending: boolean;
}) {
  const inputId = useId();
  const hintId = useId();
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [phase, setPhase] = useState<Phase>("uploading");

  useEffect(() => {
    if (!isPending) return;
    const t = setTimeout(() => setPhase("parsing"), PARSING_AFTER_MS);
    return () => clearTimeout(t);
  }, [isPending]);

  const tooLarge = file !== null && file.size > MAX_BYTES;
  const status = isPending ? phase : state?.error ? "error" : "idle";

  return (
    <section
      aria-labelledby="upload-heading"
      className="rounded-theme-lg border border-border bg-surface"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 id="upload-heading">
          <Eyebrow>Upload a new resume</Eyebrow>
        </h2>
        <span className="font-mono text-[11px] text-ink-muted">PDF · max 5MB</span>
      </div>

      <form
        action={formAction}
        onSubmit={() => setPhase("uploading")}
        onReset={() => setFile(null)}
        className="flex flex-col gap-4 p-5"
      >
        <div
          className={`relative rounded-theme-md border border-dashed bg-graph px-4 py-8 text-center transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-trust ${
            status === "error" ? "border-danger/60" : "border-border-strong hover:border-trust"
          } ${isPending ? "opacity-60" : ""}`}
        >
          <input
            id={inputId}
            name="resume"
            type="file"
            accept=".pdf,application/pdf"
            required
            aria-describedby={hintId}
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              setFile(f ? { name: f.name, size: f.size } : null);
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <div aria-hidden="true" className="pointer-events-none mx-auto mb-3 grid w-max grid-cols-4 gap-[3px]">
            {PREVIEW_CELLS.map((cls, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-[2px] ${file ? cls : "bg-cell-0"} transition-colors`}
              />
            ))}
          </div>
          <label htmlFor={inputId} className="pointer-events-none block text-sm font-semibold text-ink">
            {file ? (
              <span className="break-all font-mono font-medium">{file.name}</span>
            ) : (
              "Choose a PDF, or drop it here"
            )}
          </label>
          <p id={hintId} className="pointer-events-none mt-1 font-mono text-xs text-ink-muted">
            {file ? formatBytes(file.size) : "Text-based PDFs read best. Scanned ones go through OCR and take longer."}
          </p>
        </div>

        {tooLarge && !isPending && (
          <p className="rounded-theme-sm border border-warm/30 bg-warm/10 px-3 py-2 text-sm text-warm-strong">
            This file is {formatBytes(file.size)}, over the 5MB limit. Compress it, or export the PDF again with
            smaller images, before uploading.
          </p>
        )}

        <div aria-live="polite" className="contents">
          {isPending && <UploadProgress phase={phase} />}
          {!isPending && state?.error && <UploadError message={state.error} />}
        </div>

        <PrimaryButton type="submit" disabled={isPending} className="self-start">
          {isPending ? (phase === "parsing" ? "Reading resume…" : "Uploading…") : "Upload and read skills"}
        </PrimaryButton>
      </form>
    </section>
  );
}

function UploadProgress({ phase }: { phase: Phase }) {
  const steps: { key: Phase; label: string }[] = [
    { key: "uploading", label: "Uploading the file" },
    { key: "parsing", label: "Reading text and matching skills" },
  ];
  const current = steps.findIndex((s) => s.key === phase);
  return (
    <ol className="flex flex-col gap-1.5" role="status">
      {steps.map((step, i) => (
        <li key={step.key} className={`flex items-center gap-2.5 text-sm ${i <= current ? "text-ink" : "text-ink-muted"}`}>
          <span
            aria-hidden="true"
            className={`h-3 w-3 shrink-0 rounded-[3px] ${
              i < current
                ? "bg-trust"
                : i === current
                  ? "animate-pulse bg-trust/60 motion-reduce:animate-none"
                  : "border border-border-strong"
            }`}
          />
          {step.label}
          {i === current && <span className="sr-only"> (in progress)</span>}
        </li>
      ))}
      {phase === "parsing" && (
        <li className="pl-5 text-xs text-ink-muted">Scanned PDFs can take up to a minute while we run OCR.</li>
      )}
    </ol>
  );
}

// The server returns a short "what happened" reason (lib/resume-upload.ts,
// lib/resume-parser.ts). Pair it with how to fix it, shown underneath.
function fixFor(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes("5mb")) return "Compress the PDF, or export it again with smaller images, then upload it.";
  if (m.includes("must be a pdf")) return "Save or export your resume as a PDF (File → Download → PDF in Google Docs or Word).";
  if (m.includes("too little extractable text"))
    return "This usually means a scanned or image-only PDF we couldn't read. Export a text-based PDF from the original document.";
  if (m.includes("too long")) return "Upload just your resume, not a full portfolio, thesis or transcript.";
  if (m.includes("no resume-style sections"))
    return "Check the file has headings like Education, Experience, Projects or Skills.";
  if (m.includes("no contact information")) return "Add your email address or phone number to the resume and upload it again.";
  if (m.includes("couldn't read that pdf"))
    return "The file may be damaged or password-protected. Re-export it without a password and try again.";
  if (m.includes("choose a resume") || m.includes("upload a resume to continue"))
    return "Pick a PDF file before pressing upload.";
  return null;
}

function UploadError({ message }: { message: string }) {
  const fix = fixFor(message);
  return (
    <div role="alert" className="rounded-theme-sm border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm">
      <p className="font-medium text-danger">{message}</p>
      {fix && <p className="mt-0.5 text-ink-muted">{fix}</p>}
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

  const date = new Date(resume.uploadedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <li
      className={`flex flex-col gap-3 py-4 ${resume.active ? "-mx-3 rounded-theme-md bg-trust/5 px-3" : ""}`}
      aria-current={resume.active ? "true" : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className={`mt-1 h-3 w-3 shrink-0 rounded-[3px] ${
              resume.active ? "bg-trust" : "border border-border-strong"
            }`}
          />
          <div className="min-w-0">
            <p className="break-all font-mono text-sm font-medium text-ink">{resume.filename}</p>
            <p className="mt-0.5 font-mono text-xs text-ink-muted">
              <time dateTime={resume.uploadedAt}>{date}</time>
              {resume.usedOcr && " · scanned, read via OCR"}
            </p>
          </div>
        </div>
        {resume.active ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-trust-strong">
            Current
          </span>
        ) : (
          <SecondaryButton
            type="button"
            onClick={makeActive}
            disabled={isPending}
            className="px-3 py-1.5 text-xs"
          >
            {isPending ? "Switching…" : "Make current"}
          </SecondaryButton>
        )}
      </div>
      {error && (
        <p role="alert" className="pl-6 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5 pl-6">
        {resume.extractedSkills.length > 0 ? (
          resume.extractedSkills.map(({ slug, name }) => (
            <Pill key={slug} tone="trust">
              {name}
            </Pill>
          ))
        ) : (
          <span className="text-xs text-ink-muted">
            No skills from our list were found in this file.
          </span>
        )}
      </div>
    </li>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
