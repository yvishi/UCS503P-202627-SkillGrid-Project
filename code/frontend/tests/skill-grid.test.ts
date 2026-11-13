import { describe, expect, it } from "vitest";

import { buildSkillGrid, githubSkillsFromPayload, peerSkillsFromPayload, resumeSkillsFromPayload } from "@/lib/skill-grid";
import type { UserSkillEntry } from "@/lib/skills";

const NAMES = new Map([
  ["react", "React"],
  ["python", "Python"],
  ["docker", "Docker"],
  ["rust", "Rust"],
  ["pytorch", "PyTorch"],
  ["tensorflow", "TensorFlow"],
]);

const USER_SKILLS: UserSkillEntry[] = [
  { slug: "react", name: "React", level: "ADVANCED" },
  { slug: "docker", name: "Docker", level: "BEGINNER" },
];

describe("buildSkillGrid", () => {
  it("unions self-rated and evidence-only skills, strongest evidence first", () => {
    const grid = buildSkillGrid({
      userSkills: USER_SKILLS,
      resumeSkills: ["python", "react"],
      githubSkills: [
        { slug: "react", level: 4 },
        { slug: "rust", level: 3 },
      ],
      skillNames: NAMES,
    });
    expect(grid.rows).toEqual([
      { label: "React", cells: [4, 3, 4, 0] },
      { label: "Python", cells: [0, 3, 0, 0] },
      { label: "Rust", cells: [0, 0, 3, 0] },
      { label: "Docker", cells: [2, 0, 0, 0] },
    ]);
    expect(grid.backedCount).toBe(3);
    expect(grid.columns).toEqual(["Self", "Resume", "GitHub", "Peers"]);
  });

  it("drops evidence slugs the catalog doesn't know", () => {
    const grid = buildSkillGrid({ userSkills: [], resumeSkills: ["no-such-skill"], githubSkills: [], skillNames: NAMES });
    expect(grid.rows).toEqual([]);
  });
});

describe("resumeSkillsFromPayload", () => {
  it("expands legacy combined slugs", () => {
    expect(resumeSkillsFromPayload({ extractedSkills: ["pytorch-tensorflow", 7, "react"] })).toEqual([
      "pytorch",
      "tensorflow",
      "react",
    ]);
  });

  it("returns nothing for a missing payload", () => {
    expect(resumeSkillsFromPayload(null)).toEqual([]);
  });
});

describe("githubSkillsFromPayload", () => {
  it("reads v2 payloads and ignores malformed entries", () => {
    expect(
      githubSkillsFromPayload({
        verified: true,
        version: 2,
        skills: [{ slug: "react", level: 4, repos: 3, via: ["language"] }, { slug: "rust", level: 9 }, null],
      }),
    ).toEqual([{ slug: "react", level: 4 }]);
  });

  it("reads v1 payloads: first language strongest", () => {
    expect(githubSkillsFromPayload({ verified: true, languages: ["python", "rust"] })).toEqual([
      { slug: "python", level: 4 },
      { slug: "rust", level: 3 },
    ]);
  });

  it("ignores unverified connections", () => {
    expect(githubSkillsFromPayload({ verified: false, languages: ["python"] })).toEqual([]);
  });
});

describe("peer evidence", () => {
  it("fills the Peers column from peer evidence", () => {
    const grid = buildSkillGrid({
      userSkills: [],
      resumeSkills: [],
      githubSkills: [],
      peerSkills: [{ slug: "react", level: 3 }],
      skillNames: new Map([["react", "React"]]),
    });
    expect(grid.rows).toEqual([{ label: "React", cells: [0, 0, 0, 3] }]);
    expect(grid.backedCount).toBe(1);
  });

  it("reads a verified peer payload", () => {
    expect(peerSkillsFromPayload({ version: 1, verified: true, skills: [{ slug: "a", level: 3 }] })).toEqual([
      { slug: "a", level: 3 },
    ]);
  });

  it("ignores unverified or malformed peer payloads", () => {
    expect(peerSkillsFromPayload(null)).toEqual([]);
    expect(peerSkillsFromPayload({ version: 1, verified: false, skills: [{ slug: "a", level: 3 }] })).toEqual([]);
    expect(peerSkillsFromPayload({ version: 1, verified: true, skills: [{ slug: "a", level: 7 }] })).toEqual([]);
  });
});
