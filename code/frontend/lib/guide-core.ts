// Rules for the dashboard's one-time "getting started" guide. Pure --
// lib/guide.ts loads the facts and stores the progress.

export const GUIDE_STEPS = ["profile", "hackathon", "team", "invites", "feedback"] as const;
export type GuideStepId = (typeof GUIDE_STEPS)[number];

// Steps that depend on other people (an invite arriving, a hackathon
// ending), so a new student can't complete them for real on day one.
// Opening them from the guide counts.
export const ACK_STEPS: readonly GuideStepId[] = ["invites", "feedback"];

/** How many skills the dashboard's grid preview shows. */
export const GRID_PREVIEW_ROWS = 5;

export type GuideFacts = {
  skillCount: number;
  /** Evidence sources on file: resume, GitHub. */
  evidenceSources: number;
  joinedHackathon: boolean;
  onTeam: boolean;
  sentInviteOrRequest: boolean;
  respondedToInvite: boolean;
  gaveFeedback: boolean;
  /** Step ids acknowledged from the guide (Profile.guideSeenSteps). */
  seenSteps: readonly string[];
};

export type GuideState = {
  done: Record<GuideStepId, boolean>;
  /** First step not done, or null when all are. */
  current: GuideStepId | null;
  doneCount: number;
  allDone: boolean;
};

export function guideState(facts: GuideFacts): GuideState {
  const seen = (step: GuideStepId) => ACK_STEPS.includes(step) && facts.seenSteps.includes(step);
  const done: Record<GuideStepId, boolean> = {
    profile: facts.skillCount > 0 && facts.evidenceSources > 0,
    hackathon: facts.joinedHackathon || facts.onTeam,
    team: facts.onTeam || facts.sentInviteOrRequest,
    invites: facts.respondedToInvite || seen("invites"),
    feedback: facts.gaveFeedback || seen("feedback"),
  };
  const current = GUIDE_STEPS.find((step) => !done[step]) ?? null;
  const doneCount = GUIDE_STEPS.filter((step) => done[step]).length;
  return { done, current, doneCount, allDone: current === null };
}

/** The guide shows until it has ended once. Ending is permanent: a step
 *  becoming "not done" again later must not bring it back. */
export function guideVisible(endedAt: Date | null, state: GuideState): boolean {
  return endedAt === null && !state.allDone;
}
