import { describe, expect, it } from "vitest";
import { computeMetrics, toMarkdownTable, type UserRow } from "@/lib/pilot-metrics-core";

const T0 = new Date("2026-11-01T10:00:00Z");
const plus = (min: number) => new Date(T0.getTime() + min * 60_000);
const noTeams = { teams: 0, invites: 0, accepted: 0, feedbackGivers: 0, eligibleGivers: 0 };

function row(over: Partial<UserRow> = {}): UserRow {
  return { createdAt: T0, onboardedAt: plus(5), hasResume: true, hasGithub: false, extracted: [], kept: [], ...over };
}

describe("computeMetrics", () => {
  it("returns nulls, not NaN, for empty input", () => {
    const m = computeMetrics([], noTeams);
    expect(m.users).toBe(0);
    expect(m.medianTtvpMinutes).toBeNull();
    expect(m.completionRate).toBeNull();
    expect(m.coverageAny).toBeNull();
    expect(m.coverageBoth).toBeNull();
    expect(m.parsePrecision).toBeNull();
    expect(m.inviteAcceptRate).toBeNull();
    expect(m.feedbackRate).toBeNull();
    expect(m.teamsFormed).toBe(0);
  });

  it("takes the median TTVP of 4, 8 and 30 minutes as 8", () => {
    const rows = [4, 30, 8].map((n) => row({ onboardedAt: plus(n) }));
    expect(computeMetrics(rows, noTeams).medianTtvpMinutes).toBe(8);
  });

  it("averages the middle two for an even count", () => {
    const rows = [4, 8].map((n) => row({ onboardedAt: plus(n) }));
    expect(computeMetrics(rows, noTeams).medianTtvpMinutes).toBe(6);
  });

  it("excludes users without evidence from TTVP but keeps them in completionRate", () => {
    const rows = [
      row({ onboardedAt: plus(10) }),
      row({ onboardedAt: plus(1), hasResume: false, hasGithub: false }),
      row({ onboardedAt: null }),
      row({ onboardedAt: null, hasResume: false }),
    ];
    const m = computeMetrics(rows, noTeams);
    expect(m.medianTtvpMinutes).toBe(10);
    expect(m.completionRate).toBe(0.5);
  });

  it("computes coverage over onboarded profiles only", () => {
    const rows = [
      row({ hasResume: true, hasGithub: true }),
      row({ hasResume: true, hasGithub: false }),
      row({ hasResume: false, hasGithub: false }),
      row({ hasResume: false, hasGithub: false }),
      row({ onboardedAt: null, hasResume: true, hasGithub: true }),
    ];
    const m = computeMetrics(rows, noTeams);
    expect(m.coverageAny).toBe(0.5);
    expect(m.coverageBoth).toBe(0.25);
  });

  it("gives null coverage and TTVP when nobody is onboarded", () => {
    const m = computeMetrics([row({ onboardedAt: null })], noTeams);
    expect(m.coverageAny).toBeNull();
    expect(m.medianTtvpMinutes).toBeNull();
    expect(m.completionRate).toBe(0);
  });

  it("computes parse precision as sum kept-in-extracted over sum extracted", () => {
    const m = computeMetrics([row({ extracted: ["a", "b", "c", "d"], kept: ["a", "b"] })], noTeams);
    expect(m.parsePrecision).toBe(0.5);
  });

  it("pools precision across users and ignores kept skills that were not extracted", () => {
    const rows = [
      row({ extracted: ["a", "b"], kept: ["a", "b", "z"] }),
      row({ extracted: ["a", "b", "c", "d"], kept: [] }),
      row({ extracted: [], kept: ["x"] }),
    ];
    expect(computeMetrics(rows, noTeams).parsePrecision).toBe(2 / 6);
  });

  it("returns null precision when nothing was extracted", () => {
    expect(computeMetrics([row({ kept: ["a"] })], noTeams).parsePrecision).toBeNull();
  });

  it("computes team metrics and nulls on zero denominators", () => {
    const m = computeMetrics([], { teams: 3, invites: 4, accepted: 3, feedbackGivers: 2, eligibleGivers: 8 });
    expect(m.teamsFormed).toBe(3);
    expect(m.inviteAcceptRate).toBe(0.75);
    expect(m.feedbackRate).toBe(0.25);
    const z = computeMetrics([], { teams: 1, invites: 0, accepted: 0, feedbackGivers: 0, eligibleGivers: 0 });
    expect(z.inviteAcceptRate).toBeNull();
    expect(z.feedbackRate).toBeNull();
  });
});

describe("toMarkdownTable", () => {
  it("shows targets and n/a for nulls", () => {
    const out = toMarkdownTable(computeMetrics([], noTeams));
    expect(out).toContain("| Metric | Value | Target |");
    expect(out).toContain("TTVP");
    expect(out).toContain("10 min");
    expect(out).toContain("60%");
    expect(out).toContain("n/a");
    expect(out).not.toContain("NaN");
  });

  it("formats values", () => {
    const rows = [row({ onboardedAt: plus(8), hasGithub: true, extracted: ["a", "b"], kept: ["a"] })];
    const out = toMarkdownTable(computeMetrics(rows, { teams: 1, invites: 2, accepted: 1, feedbackGivers: 1, eligibleGivers: 4 }));
    expect(out).toContain("8.0 min");
    expect(out).toContain("100.0%");
    expect(out).toContain("50.0%");
    expect(out).toContain("25.0%");
  });
});
