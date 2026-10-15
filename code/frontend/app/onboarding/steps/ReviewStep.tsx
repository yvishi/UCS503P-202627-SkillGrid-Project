"use client";

import { AVAILABILITY_LABELS, type AvailabilityOption } from "@/lib/onboarding-options";
import {
  SKILLS,
  SKILL_RATING_LABELS,
  SKILL_RATING_LEVELS,
  skillLabel,
  type SkillRatings,
  type SkillSlug,
} from "@/lib/skills";
import { Empty, Eyebrow, Pill, PrimaryButton, TrustBadge } from "@/app/ui/primitives";
import { EvidenceGrid, GridLegend, type CellLevel, type GridRow } from "@/app/ui/EvidenceGrid";
import type { StepKey } from "../Stepper";

import { ArrowRight, StepCard, StepFooter, StepHeading } from "./StepShell";

// Self-rating -> grid cell strength (amber). Kept below the top level so a
// self-report never reads as strong as real evidence would.
const SELF_LEVEL: Record<(typeof SKILL_RATING_LEVELS)[number], CellLevel> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
};
// A keyword match on the resume is one solid piece of evidence.
const RESUME_LEVEL: CellLevel = 3;

// Spec sections 4.7 / 5.6: an editable summary of everything collected so
// far, plus (Path A only) the resume-extracted skill tags reconciled here.
export function ReviewStep({
  hasResume,
  resumeUsedOcr,
  resumeSkills,
  onResumeSkillsChange,
  skillRatings,
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
  resumeSkills: SkillSlug[];
  onResumeSkillsChange: (next: SkillSlug[]) => void;
  skillRatings: SkillRatings;
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
  const addableSkills = SKILLS.filter((s) => !resumeSkills.includes(s.slug));

  // Grid preview: every skill that is rated or on the resume, in the fixed
  // list order. Self column from ratings (amber), Resume column on Path A.
  const columns = hasResume ? ["Self", "Resume"] : ["Self"];
  const rows: GridRow[] = SKILLS.filter((s) => skillRatings[s.slug] || (hasResume && resumeSkills.includes(s.slug))).map(
    (s) => {
      const rating = skillRatings[s.slug];
      const self: CellLevel = rating ? SELF_LEVEL[rating] : 0;
      return {
        label: s.label,
        cells: hasResume ? [self, resumeSkills.includes(s.slug) ? RESUME_LEVEL : 0] : [self],
      };
    },
  );
  const ratedEntries = (Object.entries(skillRatings) as [SkillSlug, keyof typeof SKILL_RATING_LABELS][]).filter(
    ([, level]) => !!level,
  );

  return (
    <StepCard>
      <StepHeading title="Review and submit" description="Check everything below, then submit your profile." />

      <div className="flex flex-col gap-4 px-5 pb-6 sm:px-7">
        <ReviewRow label="Your grid so far" onEdit={() => onEditStep("skills")} editLabel="Edit ratings">
          {rows.length > 0 ? (
            <div className="flex flex-col gap-4">
              <EvidenceGrid
                columns={columns}
                rows={rows}
                selfColumn={0}
                size="md"
                caption="Preview of your skill grid: self-rated level and resume evidence for each skill"
              />
              <GridLegend />
              {ratedEntries.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {ratedEntries.map(([slug, level]) => (
                    <Pill key={slug} tone="warm">
                      {skillLabel(slug)} · {SKILL_RATING_LABELS[level]}
                    </Pill>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Empty message="No skills yet. Rate a few so your grid has something on it." />
          )}
        </ReviewRow>

        {hasResume && (
          <ReviewRow
            label={resumeUsedOcr ? "From your resume (scanned with OCR)" : "From your resume"}
            aside={<TrustBadge>Evidence</TrustBadge>}
          >
            <div className="flex flex-wrap gap-2">
              {resumeSkills.map((slug) => (
                <span
                  key={slug}
                  className="inline-flex items-center gap-1.5 rounded-theme-sm border border-trust/25 bg-trust/10 py-0.5 pl-2 pr-1 text-xs font-medium text-trust-strong"
                >
                  <span aria-hidden="true" className="h-2 w-2 rounded-[2px] bg-trust" />
                  {skillLabel(slug)}
                  <button
                    type="button"
                    onClick={() => onResumeSkillsChange(resumeSkills.filter((s) => s !== slug))}
                    aria-label={`Remove ${skillLabel(slug)}`}
                    className="flex h-5 w-5 items-center justify-center rounded-[4px] text-trust-strong/70 transition hover:bg-danger/10 hover:text-danger"
                  >
                    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path strokeLinecap="round" d="M5 5l10 10M15 5L5 15" />
                    </svg>
                  </button>
                </span>
              ))}
              {resumeSkills.length === 0 && (
                <Empty message="No skills found on your resume. Add any it should have picked up below." />
              )}
            </div>
            {addableSkills.length > 0 && (
              <select
                aria-label="Add a skill from your resume"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) onResumeSkillsChange([...resumeSkills, e.target.value as SkillSlug]);
                  e.target.value = "";
                }}
                className="mt-3 rounded-theme-sm border border-border-strong bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition hover:border-ink"
              >
                <option value="" disabled>
                  + Add a skill
                </option>
                {addableSkills.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.label}
                  </option>
                ))}
              </select>
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
