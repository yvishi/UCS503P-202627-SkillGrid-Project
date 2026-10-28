import { describe, expect, it } from "vitest";

import {
  FEEDBACK_WINDOW_DAYS,
  MAX_SKILLS_PER_TEAMMATE,
  aggregatePeerEvidence,
  canGiveFeedback,
  feedbackWindow,
  parseFeedbackInput,
} from "@/lib/peer-feedback-core";
import { peerSkillsFromPayload } from "@/lib/skill-grid";

const DAY = 24 * 60 * 60 * 1000;
const endsAt = new Date("2026-11-01T10:00:00Z");

describe("feedbackWindow", () => {
  it("is not-open before endsAt", () => {
    expect(feedbackWindow(endsAt, new Date("2026-11-01T09:59:00Z"))).toBe("not-open");
  });
  it("is open exactly at endsAt", () => {
    expect(feedbackWindow(endsAt, endsAt)).toBe("open");
  });
  it("is open just before the window ends", () => {
    expect(feedbackWindow(endsAt, new Date(endsAt.getTime() + FEEDBACK_WINDOW_DAYS * DAY - 1))).toBe("open");
  });
  it("is closed at endsAt + 14 days", () => {
    expect(feedbackWindow(endsAt, new Date(endsAt.getTime() + FEEDBACK_WINDOW_DAYS * DAY))).toBe("closed");
  });
});

describe("canGiveFeedback", () => {
  const base = { window: "open" as const, raterTeamId: "t1", targetTeamId: "t1", raterId: "a", targetId: "b" };
  it("allows teammates in an open window", () => {
    expect(canGiveFeedback(base)).toEqual({ ok: true });
  });
  it("refuses rating yourself", () => {
    expect(canGiveFeedback({ ...base, targetId: "a" })).toEqual({ ok: false, error: "You can't rate yourself." });
  });
  it("refuses different teams", () => {
    expect(canGiveFeedback({ ...base, targetTeamId: "t2" })).toEqual({
      ok: false,
      error: "You can only rate your own teammates.",
    });
  });
  it("refuses when either side has no team", () => {
    expect(canGiveFeedback({ ...base, raterTeamId: null }).ok).toBe(false);
    expect(canGiveFeedback({ ...base, targetTeamId: null }).ok).toBe(false);
  });
  it("refuses when closed", () => {
    expect(canGiveFeedback({ ...base, window: "closed" })).toEqual({
      ok: false,
      error: "The feedback window for this hackathon has closed.",
    });
  });
  it("refuses when not yet open", () => {
    expect(canGiveFeedback({ ...base, window: "not-open" }).ok).toBe(false);
  });
});

describe("parseFeedbackInput", () => {
  const allowed = new Set(["react", "python", "go", "rust", "sql", "css"]);
  it("accepts valid input", () => {
    expect(parseFeedbackInput({ toUserId: "u", ratings: [{ slug: "react", level: "ADVANCED" }] }, allowed)).toEqual({
      ok: true,
      value: { toUserId: "u", ratings: [{ slug: "react", level: "ADVANCED" }] },
    });
  });
  it("rejects more than the maximum", () => {
    expect(MAX_SKILLS_PER_TEAMMATE).toBe(5);
    const ratings = ["react", "python", "go", "rust", "sql", "css"].map((slug) => ({ slug, level: "BEGINNER" }));
    expect(parseFeedbackInput({ toUserId: "u", ratings }, allowed).ok).toBe(false);
  });
  it("rejects a slug outside the allowed set", () => {
    expect(parseFeedbackInput({ toUserId: "u", ratings: [{ slug: "cobol", level: "BEGINNER" }] }, allowed).ok).toBe(false);
  });
  it("rejects an unknown level", () => {
    expect(parseFeedbackInput({ toUserId: "u", ratings: [{ slug: "react", level: "EXPERT" }] }, allowed).ok).toBe(false);
  });
  it("rejects duplicate slugs", () => {
    const ratings = [
      { slug: "react", level: "BEGINNER" },
      { slug: "react", level: "ADVANCED" },
    ];
    expect(parseFeedbackInput({ toUserId: "u", ratings }, allowed).ok).toBe(false);
  });
});

describe("aggregatePeerEvidence", () => {
  it("takes the median across three raters", () => {
    const out = aggregatePeerEvidence([
      { slug: "react", level: "BEGINNER", fromUserId: "a" },
      { slug: "react", level: "ADVANCED", fromUserId: "b" },
      { slug: "react", level: "INTERMEDIATE", fromUserId: "c" },
    ]);
    expect(out).toEqual({ version: 1, verified: true, skills: [{ slug: "react", level: 3, raters: 3 }] });
  });
  it("uses the lower median for an even count", () => {
    const out = aggregatePeerEvidence([
      { slug: "react", level: "BEGINNER", fromUserId: "a" },
      { slug: "react", level: "ADVANCED", fromUserId: "b" },
    ]);
    expect(out.skills).toEqual([{ slug: "react", level: 2, raters: 2 }]);
  });
  it("orders by slug and counts distinct raters", () => {
    const out = aggregatePeerEvidence([
      { slug: "sql", level: "ADVANCED", fromUserId: "a" },
      { slug: "css", level: "BEGINNER", fromUserId: "a" },
      { slug: "css", level: "BEGINNER", fromUserId: "a" },
    ]);
    expect(out.skills).toEqual([
      { slug: "css", level: 2, raters: 1 },
      { slug: "sql", level: 4, raters: 1 },
    ]);
  });
  it("returns no skills for no rows", () => {
    expect(aggregatePeerEvidence([]).skills).toEqual([]);
  });
  it("round-trips through peerSkillsFromPayload", () => {
    const out = aggregatePeerEvidence([
      { slug: "react", level: "ADVANCED", fromUserId: "a" },
      { slug: "go", level: "INTERMEDIATE", fromUserId: "b" },
    ]);
    expect(peerSkillsFromPayload(out)).toEqual([
      { slug: "go", level: 3 },
      { slug: "react", level: 4 },
    ]);
  });
});
