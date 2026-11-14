import { describe, expect, it } from "vitest";
import { guideState, guideVisible, type GuideFacts } from "@/lib/guide-core";

function facts(overrides: Partial<GuideFacts> = {}): GuideFacts {
  return {
    skillCount: 0,
    evidenceSources: 0,
    joinedHackathon: false,
    onTeam: false,
    sentInviteOrRequest: false,
    respondedToInvite: false,
    gaveFeedback: false,
    seenSteps: [],
    ...overrides,
  };
}

const ALL_DONE = facts({ skillCount: 1, evidenceSources: 1, onTeam: true, seenSteps: ["invites", "feedback"] });

describe("guideState", () => {
  it("starts at profile with nothing on file", () => {
    const s = guideState(facts());
    expect(s.current).toBe("profile");
    expect(s.doneCount).toBe(0);
    expect(s.allDone).toBe(false);
  });
  it("needs both a skill and an evidence source for profile", () => {
    expect(guideState(facts({ skillCount: 3 })).done.profile).toBe(false);
    expect(guideState(facts({ evidenceSources: 1 })).done.profile).toBe(false);
    expect(guideState(facts({ skillCount: 1, evidenceSources: 1 })).done.profile).toBe(true);
  });
  it("counts a team membership as having joined a hackathon", () => {
    expect(guideState(facts({ onTeam: true })).done.hackathon).toBe(true);
    expect(guideState(facts({ joinedHackathon: true })).done.hackathon).toBe(true);
  });
  it("finishes the team step on a sent invite or request", () => {
    expect(guideState(facts({ sentInviteOrRequest: true })).done.team).toBe(true);
    expect(guideState(facts({ onTeam: true })).done.team).toBe(true);
    expect(guideState(facts({ joinedHackathon: true })).done.team).toBe(false);
  });
  it("finishes ack steps when seen or when really done", () => {
    expect(guideState(facts({ seenSteps: ["invites"] })).done.invites).toBe(true);
    expect(guideState(facts({ respondedToInvite: true })).done.invites).toBe(true);
    expect(guideState(facts({ seenSteps: ["feedback"] })).done.feedback).toBe(true);
    expect(guideState(facts({ gaveFeedback: true })).done.feedback).toBe(true);
  });
  it("makes the first unfinished step current, skipping finished ones", () => {
    expect(guideState(facts({ skillCount: 1, evidenceSources: 1, joinedHackathon: true })).current).toBe("team");
    expect(guideState(facts({ joinedHackathon: true })).current).toBe("profile");
  });
  it("ignores unknown seen steps and steps that can't be acknowledged", () => {
    expect(guideState(facts({ seenSteps: ["nope", "profile", "team"] })).doneCount).toBe(0);
  });
  it("is all done with no current step", () => {
    const s = guideState(ALL_DONE);
    expect(s.allDone).toBe(true);
    expect(s.doneCount).toBe(5);
    expect(s.current).toBeNull();
  });
});

describe("guideVisible", () => {
  it("stays hidden once ended, even if steps are unfinished again", () => {
    expect(guideVisible(new Date(), guideState(facts()))).toBe(false);
  });
  it("hides when all done, shows otherwise", () => {
    expect(guideVisible(null, guideState(facts()))).toBe(true);
    expect(guideVisible(null, guideState(ALL_DONE))).toBe(false);
  });
});
