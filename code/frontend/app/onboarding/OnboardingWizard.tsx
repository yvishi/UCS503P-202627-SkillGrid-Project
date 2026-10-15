"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import type { AvailabilityOption } from "@/lib/onboarding-options";
import type { SkillEditorState } from "@/app/ui/skill-picker/use-skill-editor";
import type { EvidenceSnapshot } from "@/lib/skill-suggestions";

import { getEvidenceSnapshotAction } from "@/app/skills/actions";

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

// Connecting GitHub mid-wizard means a full-page redirect off to GitHub's
// consent screen and back (see app/api/github) -- that reload would wipe
// all the plain React state below, so it's mirrored into sessionStorage
// and restored on mount. Nothing here is sensitive (no tokens -- those
// stay server-side), just the same form values the wizard already tracks.
// Keyed per-user so a shared/lab machine can't rehydrate one signed-in
// user's in-progress answers into the next user's session.
// v2: skills moved to the database (saved as picked), so drafts no longer carry them.
function getStorageKey(userId: string): string {
  return `skillgrid_onboarding_wizard_v2:${userId}`;
}

type WizardState = {
  path: "A" | "B" | null;
  stepIndex: number;
  resumeFileUrl: string | null;
  resumeEvidenceId: string | null;
  resumeSkills: string[];
  resumeUsedOcr: boolean;
  interestTags: string[];
  availability: AvailabilityOption | null;
  projectLinks: string[];
  githubEvidenceId: string | null;
  githubUsername: string | null;
};

const INITIAL_STATE: WizardState = {
  path: null,
  stepIndex: 0,
  resumeFileUrl: null,
  resumeEvidenceId: null,
  resumeSkills: [],
  resumeUsedOcr: false,
  interestTags: [],
  availability: null,
  projectLinks: [],
  githubEvidenceId: null,
  githubUsername: null,
};

function loadSavedState(userId: string): WizardState | null {
  try {
    const raw = sessionStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    return { ...INITIAL_STATE, ...(JSON.parse(raw) as Partial<WizardState>) };
  } catch {
    return null;
  }
}

function clearSavedState(userId: string) {
  try {
    sessionStorage.removeItem(getStorageKey(userId));
  } catch {
    // best-effort only (private browsing, storage disabled, etc.)
  }
}

// Restoring any in-progress wizard state plus the GitHub OAuth callback's
// redirect query params (?github=connected&evidenceId=&username=, or
// ?github=error) belongs in the initial-state computation, not an effect
// -- this genuinely is the initial state, not a later sync from an
// external system. Runs once per mount; SSR gets INITIAL_STATE (no
// window), then the client's first render restores for real.
function computeInitialState(userId: string): WizardState {
  if (typeof window === "undefined") return INITIAL_STATE;
  const base = loadSavedState(userId) ?? INITIAL_STATE;
  const params = new URLSearchParams(window.location.search);
  if (params.get("github") !== "connected") return base;
  return {
    ...base,
    githubEvidenceId: params.get("evidenceId") ?? base.githubEvidenceId,
    githubUsername: params.get("username") ?? base.githubUsername,
  };
}

export function OnboardingWizard({ userId, initialSkills }: { userId: string; initialSkills: SkillEditorState }) {
  const [state, setState] = useState<WizardState>(() => computeInitialState(userId));
  const [githubConnectionError] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("github") === "error",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  // Skills live in the database, not the sessionStorage draft; this just
  // mirrors the picker's list for Continue and the Review preview.
  const [skillState, setSkillState] = useState<SkillEditorState>(initialSkills);
  const [evidence, setEvidence] = useState<EvidenceSnapshot | null>(null);

  // Strip the OAuth callback's query params so a refresh doesn't re-apply
  // them. Doesn't call setState -- this is a real side effect (URL), not
  // state sync, so it belongs in an effect.
  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(getStorageKey(userId), JSON.stringify(state));
    } catch {
      // best-effort only (private browsing, storage disabled, etc.)
    }
  }, [state, userId]);

  const steps = state.path === "A" ? STEPS_A : STEPS_B;
  const currentKey = steps[state.stepIndex];

  // Suggestions and the Review preview read the user's evidence, which
  // changes mid-wizard (resume upload, GitHub connect) -- refetch it
  // whenever one of the two screens that show it opens.
  useEffect(() => {
    if (currentKey !== "skills" && currentKey !== "review") return;
    let cancelled = false;
    getEvidenceSnapshotAction(state.resumeEvidenceId)
      .then((snapshot) => {
        if (!cancelled) setEvidence(snapshot);
      })
      .catch((err) => console.error("Loading evidence failed:", err));
    return () => {
      cancelled = true;
    };
  }, [currentKey, state.resumeEvidenceId, state.githubEvidenceId]);

  function patch(next: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...next }));
  }
  function goTo(step: StepKey) {
    setState((prev) => ({ ...prev, stepIndex: steps.indexOf(step) }));
  }
  function next() {
    setState((prev) => ({ ...prev, stepIndex: Math.min(prev.stepIndex + 1, steps.length - 1) }));
  }
  function back() {
    setState((prev) => ({ ...prev, stepIndex: Math.max(prev.stepIndex - 1, 0) }));
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submitOnboardingAction({
        interestTags: state.interestTags,
        availability: state.availability,
        projectLinks: state.projectLinks,
        resumeEvidenceId: state.resumeEvidenceId,
        githubEvidenceId: state.githubEvidenceId,
      });
      // A successful submit redirects server-side and never returns here --
      // it throws instead, caught below.
      if (result?.error) {
        setSubmitError(result.error);
        setIsSubmitting(false);
      }
    } catch (err) {
      // submitOnboardingAction's redirect() on success surfaces here as a
      // thrown NEXT_REDIRECT. Onboarding is done, so drop the draft before
      // letting Next.js perform the actual navigation.
      clearSavedState(userId);
      throw err;
    }
  }

  // Each screen fades/slides in on its own key; the branch screen counts as
  // one too, so choosing a path transitions like any other step.
  const viewKey = state.path ? `${state.path}:${currentKey}` : "branch";
  const offset = reduceMotion ? 0 : 10;

  return (
    <div>
      {state.path && <Stepper steps={steps} current={currentKey} />}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={viewKey}
          initial={{ opacity: 0, y: offset }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -offset }}
          transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {!state.path ? (
            <BranchStep onChoose={(path) => patch({ path })} />
          ) : (
            <>
              {currentKey === "resume" && (
                <ResumeStep
                  onPassed={({ fileUrl, evidenceId, extractedSkills, usedOcr }) => {
                    patch({
                      resumeFileUrl: fileUrl,
                      resumeEvidenceId: evidenceId,
                      resumeSkills: extractedSkills,
                      resumeUsedOcr: usedOcr,
                    });
                    next();
                  }}
                  onSwitchToManual={() => patch({ path: "B", stepIndex: 0 })}
                />
              )}

              {currentKey === "skills" && (
                <SkillsStep
                  value={skillState}
                  evidence={evidence}
                  onChange={setSkillState}
                  onContinue={next}
                  onBack={state.path === "A" ? back : undefined}
                />
              )}

              {currentKey === "interests" && (
                <InterestsStep
                  value={state.interestTags}
                  onChange={(interestTags) => patch({ interestTags })}
                  onContinue={next}
                  onBack={back}
                />
              )}

              {currentKey === "availability" && (
                <AvailabilityStep
                  value={state.availability}
                  onChange={(availability) => patch({ availability })}
                  onContinue={next}
                  onBack={back}
                />
              )}

              {currentKey === "projects" && (
                <ProjectsStep
                  value={state.projectLinks}
                  onChange={(projectLinks) => patch({ projectLinks })}
                  onContinue={next}
                  onSkip={next}
                  onBack={back}
                />
              )}

              {currentKey === "github" && (
                <GithubStep
                  username={state.githubUsername}
                  connectionError={githubConnectionError}
                  onContinue={next}
                  onSkip={next}
                  onBack={back}
                />
              )}

              {currentKey === "review" && (
                <ReviewStep
                  hasResume={!!state.resumeFileUrl}
                  resumeUsedOcr={state.resumeUsedOcr}
                  skills={skillState.skills}
                  reports={skillState.reports}
                  evidence={evidence}
                  interestTags={state.interestTags}
                  availability={state.availability}
                  projectLinks={state.projectLinks}
                  githubUsername={state.githubUsername}
                  onEditStep={goTo}
                  onBack={back}
                  onSubmit={handleSubmit}
                  isSubmitting={isSubmitting}
                  error={submitError}
                />
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
