import { describe, expect, it } from "vitest";

import { collectEvidence, profileScore, skillScore, type SkillEvidence } from "@/lib/skill-score-core";

const none: SkillEvidence = { slug: "x", self: 0, resume: false, github: 0, peers: 0 };

describe("skillScore", () => {
  it("weights each source", () => {
    expect(skillScore({ ...none, self: 4 })).toBe(10);
    expect(skillScore({ ...none, resume: true })).toBe(20);
    expect(skillScore({ ...none, github: 2 })).toBe(23);
    expect(skillScore({ ...none, github: 4 })).toBe(45);
    expect(skillScore({ ...none, peers: 3 })).toBe(19);
    expect(skillScore({ slug: "x", self: 4, resume: true, github: 4, peers: 4 })).toBe(100);
    expect(skillScore(none)).toBe(0);
  });

  it("weakest GitHub beats resume beats strongest self", () => {
    expect(skillScore({ ...none, github: 2 })).toBeGreaterThan(skillScore({ ...none, resume: true }));
    expect(skillScore({ ...none, resume: true })).toBeGreaterThan(skillScore({ ...none, self: 4 }));
  });
});

describe("profileScore", () => {
  it("averages the top five, zero-padded", () => {
    expect(profileScore([])).toBe(0);
    expect(profileScore([100])).toBe(20);
    expect(profileScore([90, 80, 70, 60, 50, 40])).toBe(70);
    expect(profileScore([40, 50, 60, 70, 80, 90])).toBe(70);
  });
});

describe("collectEvidence", () => {
  it("merges sources per slug, maps self levels, orders by slug", () => {
    const out = collectEvidence({
      userSkills: [
        { slug: "react", name: "React", level: "ADVANCED" },
        { slug: "python", name: "Python", level: "BEGINNER" },
        { slug: "go", name: "Go", level: "INTERMEDIATE" },
      ],
      resumeSkills: ["react", "docker"],
      githubSkills: [{ slug: "react", level: 3 }, { slug: "python", level: 2 }],
      peerSkills: [{ slug: "react", level: 4 }, { slug: "rust", level: 2 }],
    });
    expect(out).toEqual([
      { slug: "docker", self: 0, resume: true, github: 0, peers: 0 },
      { slug: "go", self: 3, resume: false, github: 0, peers: 0 },
      { slug: "python", self: 2, resume: false, github: 2, peers: 0 },
      { slug: "react", self: 4, resume: true, github: 3, peers: 4 },
      { slug: "rust", self: 0, resume: false, github: 0, peers: 2 },
    ]);
  });
});
