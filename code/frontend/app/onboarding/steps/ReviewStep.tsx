"use client";

import { AVAILABILITY_LABELS, type AvailabilityOption } from "@/lib/onboarding-options";
import { SKILLS, SKILL_RATING_LABELS, skillLabel, type SkillRatings, type SkillSlug } from "@/lib/skills";
import { PrimaryButton, Pill } from "@/app/ui/primitives";
import type { StepKey } from "../Stepper";

// Spec sections 4.7 / 5.6: an editable summary of everything collected so
// far, plus (Path A only) the resume-extracted skill tags reconciled here.
export function ReviewStep({
  hasResume,
  resumeSkills,
  onResumeSkillsChange,
  skillRatings,
  interestTags,
  availability,
  projectLinks,
  githubUrl,
  onEditStep,
  onBack,
  onSubmit,
  isSubmitting,
  error,
}: {
  hasResume: boolean;
  resumeSkills: SkillSlug[];
  onResumeSkillsChange: (next: SkillSlug[]) => void;
  skillRatings: SkillRatings;
  interestTags: string[];
  availability: AvailabilityOption | null;
  projectLinks: string[];
  githubUrl: string;
  onEditStep: (step: StepKey) => void;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  const addableSkills = SKILLS.filter((s) => !resumeSkills.includes(s.slug));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight">Review & submit</h1>
        <p className="mt-1 text-sm text-ink-muted">Check everything below, then submit your profile.</p>
      </div>

      {hasResume && (
        <ReviewRow label="Resume-extracted skills" onEdit={undefined}>
          <div className="flex flex-wrap gap-2">
            {resumeSkills.map((slug) => (
              <span key={slug} className="font-display inline-flex items-center gap-1.5 border border-line-strong px-2.5 py-1 text-xs">
                {skillLabel(slug)}
                <button
                  type="button"
                  onClick={() => onResumeSkillsChange(resumeSkills.filter((s) => s !== slug))}
                  aria-label={`Remove ${skillLabel(slug)}`}
                  className="text-ink-muted hover:text-stamp"
                >
                  ×
                </button>
              </span>
            ))}
            {resumeSkills.length === 0 && <span className="text-sm text-ink-muted">None found — add manually below.</span>}
          </div>
          {addableSkills.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) onResumeSkillsChange([...resumeSkills, e.target.value as SkillSlug]);
                e.target.value = "";
              }}
              className="font-display mt-2 border border-line-strong bg-paper-raised px-2 py-1.5 text-xs"
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

      <ReviewRow label="Skill ratings" onEdit={() => onEditStep("skills")}>
        {Object.keys(skillRatings).length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {(Object.entries(skillRatings) as [SkillSlug, keyof typeof SKILL_RATING_LABELS][]).map(
              ([slug, level]) =>
                level && (
                  <Pill key={slug}>
                    {skillLabel(slug)} · {SKILL_RATING_LABELS[level]}
                  </Pill>
                ),
            )}
          </div>
        ) : (
          <span className="text-sm text-ink-muted">None rated</span>
        )}
      </ReviewRow>

      <ReviewRow label="Interests" onEdit={() => onEditStep("interests")}>
        {interestTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {interestTags.map((tag) => (
              <Pill key={tag}>{tag}</Pill>
            ))}
          </div>
        ) : (
          <span className="text-sm text-ink-muted">None selected</span>
        )}
      </ReviewRow>

      <ReviewRow label="Availability" onEdit={() => onEditStep("availability")}>
        <span className="text-sm">{availability ? AVAILABILITY_LABELS[availability] : "Not set"}</span>
      </ReviewRow>

      <ReviewRow label="Projects" onEdit={() => onEditStep("projects")}>
        {projectLinks.filter(Boolean).length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm">
            {projectLinks.filter(Boolean).map((link) => (
              <li key={link} className="truncate">{link}</li>
            ))}
          </ul>
        ) : (
          <span className="text-sm text-ink-muted">None added</span>
        )}
      </ReviewRow>

      <ReviewRow label="GitHub" onEdit={() => onEditStep("github")}>
        <span className="text-sm">{githubUrl || "Not connected"}</span>
      </ReviewRow>

      {error && (
        <p className="border border-stamp/40 bg-stamp/5 px-4 py-2 text-sm text-stamp">{error}</p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-line pt-5">
        <button
          type="button"
          onClick={onBack}
          className="font-display text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted transition hover:text-ink"
        >
          ← Back
        </button>
        <PrimaryButton type="button" onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Submitting…" : "Submit"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function ReviewRow({
  label,
  onEdit,
  children,
}: {
  label: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-line p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
          {label}
        </span>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="font-display text-[11px] font-semibold uppercase tracking-[0.06em] text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink"
          >
            Edit
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
