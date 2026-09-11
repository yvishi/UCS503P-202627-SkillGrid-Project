"use client";

import { useState } from "react";

import type { AvailabilityOption } from "@/lib/onboarding-options";
import type { SkillRatings, SkillSlug } from "@/lib/skills";

import { submitOnboardingAction } from "./actions";
import { Stepper, type StepKey } from "./Stepper";
import { BranchStep } from "./steps/BranchStep";
import { ResumeStep } from "./steps/ResumeStep";
import { SkillsStep } from "./steps/SkillsStep";
import { InterestsStep } from "./steps/InterestsStep";
import { AvailabilityStep } from "./steps/AvailabilityStep";
import { ProjectsStep } from "./steps/ProjectsStep";
import { GithubStep } from "./steps/GithubStep";
import { ReviewStep } from "./steps/ReviewStep";

const STEPS_A: StepKey[] = ["resume", "skills", "interests", "availability", "projects", "github", "review"];
const STEPS_B: StepKey[] = ["skills", "interests", "availability", "projects", "github", "review"];

export function OnboardingWizard() {
  const [path, setPath] = useState<"A" | "B" | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const [resumeFileUrl, setResumeFileUrl] = useState<string | null>(null);
  const [resumeSkills, setResumeSkills] = useState<SkillSlug[]>([]);
  const [resumeUsedOcr, setResumeUsedOcr] = useState(false);
  const [skillRatings, setSkillRatings] = useState<SkillRatings>({});
  const [interestTags, setInterestTags] = useState<string[]>([]);
  const [availability, setAvailability] = useState<AvailabilityOption | null>(null);
  const [projectLinks, setProjectLinks] = useState<string[]>([]);
  const [githubUrl, setGithubUrl] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const steps = path === "A" ? STEPS_A : STEPS_B;
  const currentKey = steps[stepIndex];

  function goTo(step: StepKey) {
    setStepIndex(steps.indexOf(step));
  }
  function next() {
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }
  function back() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setSubmitError(null);

    // Reconcile resume-extracted tags into skillRatings: anything still
    // present in the editable review list that wasn't manually rated gets
    // a default "Comfortable" rating, since it showed up on the resume.
    const merged: SkillRatings = { ...skillRatings };
    for (const slug of resumeSkills) {
      if (!merged[slug]) merged[slug] = "INTERMEDIATE";
    }

    const result = await submitOnboardingAction({
      skillRatings: merged,
      interestTags,
      availability,
      projectLinks,
      githubUrl,
    });
    // A successful submit redirects server-side and never returns here.
    if (result?.error) {
      setSubmitError(result.error);
      setIsSubmitting(false);
    }
  }

  if (!path) {
    return <BranchStep onChoose={setPath} />;
  }

  return (
    <div>
      <Stepper steps={steps} current={currentKey} />

      {currentKey === "resume" && (
        <ResumeStep
          onPassed={({ fileUrl, extractedSkills, usedOcr }) => {
            setResumeFileUrl(fileUrl);
            setResumeSkills(extractedSkills);
            setResumeUsedOcr(usedOcr);
            next();
          }}
          onSwitchToManual={() => {
            setPath("B");
            setStepIndex(0);
          }}
        />
      )}

      {currentKey === "skills" && (
        <SkillsStep
          value={skillRatings}
          onChange={setSkillRatings}
          onContinue={next}
          onBack={path === "A" ? back : undefined}
        />
      )}

      {currentKey === "interests" && (
        <InterestsStep value={interestTags} onChange={setInterestTags} onContinue={next} onBack={back} />
      )}

      {currentKey === "availability" && (
        <AvailabilityStep value={availability} onChange={setAvailability} onContinue={next} onBack={back} />
      )}

      {currentKey === "projects" && (
        <ProjectsStep value={projectLinks} onChange={setProjectLinks} onContinue={next} onSkip={next} onBack={back} />
      )}

      {currentKey === "github" && (
        <GithubStep value={githubUrl} onChange={setGithubUrl} onContinue={next} onSkip={next} onBack={back} />
      )}

      {currentKey === "review" && (
        <ReviewStep
          hasResume={!!resumeFileUrl}
          resumeUsedOcr={resumeUsedOcr}
          resumeSkills={resumeSkills}
          onResumeSkillsChange={setResumeSkills}
          skillRatings={skillRatings}
          interestTags={interestTags}
          availability={availability}
          projectLinks={projectLinks}
          githubUrl={githubUrl}
          onEditStep={goTo}
          onBack={back}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          error={submitError}
        />
      )}
    </div>
  );
}
