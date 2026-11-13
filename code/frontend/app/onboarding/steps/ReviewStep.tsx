"use client";

import { AVAILABILITY_LABELS, type AvailabilityOption } from "@/lib/onboarding-options";
import { buildSkillGrid } from "@/lib/skill-grid";
import type { OpenReport } from "@/lib/skill-report-input";
import type { EvidenceSnapshot } from "@/lib/skill-suggestions";
import { SKILL_RATING_LABELS, type UserSkillEntry } from "@/lib/skills";
import { Empty, Eyebrow, Pill, PrimaryButton, TrustBadge } from "@/app/ui/primitives";
import { EvidenceGrid, GridLegend } from "@/app/ui/EvidenceGrid";
import type { StepKey } from "../Stepper";

import { ArrowRight, StepCard, StepFooter, StepHeading } from "./StepShell";

// Spec section 5.2: a summary of everything collected so far. Skills are
// already saved (the picker writes as you go), so this only previews them
// on the grid beside what the resume and GitHub found. Detected skills are
// evidence, not ratings -- nothing is reconciled into ratings here.
export function ReviewStep({
  hasResume,
  resumeUsedOcr,
  skills,
  reports,
  evidence,
  interestTags,
  availability,
  projectLinks,
  githubUsername,
  onEditStep,
  onBack,
  onSubmit,
  isSubmitting,
  error,
}: {
  hasResume: boolean;
  resumeUsedOcr: boolean;
  skills: UserSkillEntry[];
  reports: OpenReport[];
  evidence: EvidenceSnapshot | null;
  interestTags: string[];
  availability: AvailabilityOption | null;
  projectLinks: string[];
  githubUsername: string | null;
  onEditStep: (step: StepKey) => void;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  const names = new Map(Object.entries(evidence?.names ?? {}));
  const grid = buildSkillGrid({
    userSkills: skills,
    resumeSkills: evidence?.resume ?? [],
    githubSkills: evidence?.github ?? [],
    skillNames: names,
  });
  const pendingReports = reports.filter((r) => r.status === "PENDING");
  const resumeSkillNames = (evidence?.resume ?? []).flatMap((slug) => names.get(slug) ?? []);

  return (
    <StepCard>
      <StepHeading title="Review and submit" description="Check everything below, then submit your profile." />

      <div className="flex flex-col gap-4 px-5 pb-6 sm:px-7">
        <ReviewRow label="Your grid so far" onEdit={() => onEditStep("skills")} editLabel="Edit skills">
          {grid.rows.length > 0 ? (
            <div className="flex flex-col gap-4">
              <EvidenceGrid
                columns={grid.columns}
                rows={grid.rows}
                selfColumn={grid.selfColumn}
                size="md"
                caption="Preview of your skill grid: your rating next to resume and GitHub evidence for each skill"
              />
              <GridLegend />
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <Pill key={s.slug} tone="warm">
                      {s.name} · {SKILL_RATING_LABELS[s.level]}
                    </Pill>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Empty message="No skills yet. Add a few so your grid has something on it." />
          )}
          {pendingReports.length > 0 && (
            <p className="mt-3 text-xs text-ink-muted">
              Waiting for review: {pendingReports.map((r) => r.rawName).join(", ")}. They join your grid once approved.
            </p>
          )}
        </ReviewRow>

        {hasResume && (
          <ReviewRow
            label={resumeUsedOcr ? "From your resume (scanned with OCR)" : "From your resume"}
            aside={<TrustBadge>Evidence</TrustBadge>}
          >
            {evidence === null ? (
              <Empty message="Loading…" />
            ) : resumeSkillNames.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {resumeSkillNames.map((name) => (
                  <Pill key={name} tone="trust">
                    {name}
                  </Pill>
                ))}
              </div>
            ) : (
              <Empty message="No skills found on your resume. Add them yourself in the skills step." />
            )}
          </ReviewRow>
        )}

        <ReviewRow label="Interests" onEdit={() => onEditStep("interests")}>
          {interestTags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {interestTags.map((tag) => (
                <Pill key={tag}>{tag}</Pill>
              ))}
            </div>
          ) : (
            <Empty message="None selected" />
          )}
        </ReviewRow>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ReviewRow label="Availability" onEdit={() => onEditStep("availability")}>
            {availability ? (
              <span className="text-sm font-medium">{AVAILABILITY_LABELS[availability]}</span>
            ) : (
              <Empty message="Not set" />
            )}
          </ReviewRow>

          <ReviewRow label="GitHub" onEdit={() => onEditStep("github")}>
            {githubUsername ? (
              <TrustBadge>Connected as @{githubUsername}</TrustBadge>
            ) : (
              <Empty message="Not connected" />
            )}
          </ReviewRow>
        </div>

        <ReviewRow label="Projects" onEdit={() => onEditStep("projects")}>
          {projectLinks.filter(Boolean).length > 0 ? (
            <ul className="flex flex-col gap-1.5 text-sm">
              {projectLinks.filter(Boolean).map((link) => (
                <li key={link} className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-[2px] bg-ink-muted" />
                  <span className="truncate font-mono text-xs">{link}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty message="None added" />
          )}
        </ReviewRow>

        {error && (
          <p role="alert" className="rounded-theme-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      <StepFooter
        onBack={onBack}
        actions={
          <PrimaryButton type="button" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit profile"}
            {!isSubmitting && <ArrowRight />}
          </PrimaryButton>
        }
      />
    </StepCard>
  );
}

function ReviewRow({
  label,
  onEdit,
  editLabel = "Edit",
  aside,
  children,
}: {
  label: string;
  onEdit?: () => void;
  editLabel?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-theme-md border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Eyebrow>{label}</Eyebrow>
        {aside}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`${editLabel}: ${label}`}
            className="rounded-theme-sm text-xs font-semibold text-ink-muted underline decoration-border-strong underline-offset-4 transition hover:text-ink hover:decoration-ink"
          >
            {editLabel}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
