import { describe, expect, it } from "vitest";

import { countTopics, githubSkillLevels, qualifyLanguages, recentRepos } from "@/lib/github-skills";

describe("qualifyLanguages", () => {
  it("keeps languages at >= 1% of a repo or in >= 2 repos, and ignores build noise", () => {
    expect(
      qualifyLanguages([
        { TypeScript: 9000, CSS: 50, Makefile: 900 },
        { Python: 1000 },
        { Shell: 5, Python: 995 },
      ]),
    ).toEqual([
      { language: "TypeScript", bytes: 9000, repos: 1 },
      { language: "Python", bytes: 1995, repos: 2 },
    ]);
  });

  it("keeps a language that is small everywhere but in two repos", () => {
    expect(qualifyLanguages([{ Go: 10000, Shell: 5 }, { Rust: 10000, Shell: 5 }]).map((l) => l.language)).toContain("Shell");
  });

  it("handles no repos and empty repos (Review Focus 2)", () => {
    expect(qualifyLanguages([])).toEqual([]);
    expect(qualifyLanguages([{}, {}])).toEqual([]);
  });
});

describe("githubSkillLevels", () => {
  it("scores languages by share and repo count, topics by repo count, and merges both", () => {
    const skills = githubSkillLevels({
      languages: [
        { language: "TypeScript", slug: "typescript", bytes: 9000, repos: 1 },
        { language: "Python", slug: "python", bytes: 700, repos: 2 },
        { language: "HTML", slug: "html", bytes: 300, repos: 3 },
        { language: "Go", slug: "go", bytes: 30, repos: 1 },
      ],
      topics: [
        { slug: "react", repos: 2 },
        { slug: "docker", repos: 1 },
        { slug: "python", repos: 1 },
      ],
    });
    expect(skills.map((s) => [s.slug, s.level])).toEqual([
      ["typescript", 4],
      ["python", 3],
      ["html", 3],
      ["react", 3],
      ["go", 2],
      ["docker", 2],
    ]);
    expect(skills.find((s) => s.slug === "python")?.via).toEqual(["language", "topic"]);
  });

  it("gives every language at >= 25% of all bytes the top level", () => {
    const skills = githubSkillLevels({
      languages: [
        { language: "A", slug: "a", bytes: 600, repos: 1 },
        { language: "B", slug: "b", bytes: 400, repos: 1 },
      ],
      topics: [],
    });
    expect(skills.map((s) => s.level)).toEqual([4, 4]);
  });

  it("returns nothing for an account with no evidence (Review Focus 2)", () => {
    expect(githubSkillLevels({ languages: [], topics: [] })).toEqual([]);
  });
});

describe("recentRepos", () => {
  it("keeps the most recently pushed repos", () => {
    const repos = [
      { name: "old", pushedAt: "2024-01-01T00:00:00Z", topics: [] },
      { name: "new", pushedAt: "2026-01-01T00:00:00Z", topics: [] },
      { name: "mid", pushedAt: "2025-01-01T00:00:00Z", topics: [] },
    ];
    expect(recentRepos(repos, 2).map((r) => r.name)).toEqual(["new", "mid"]);
  });
});

describe("countTopics", () => {
  it("counts each topic once per repo, case-folded", () => {
    expect(
      countTopics([
        { name: "a", pushedAt: "", topics: ["React", "react", "docker"] },
        { name: "b", pushedAt: "", topics: ["react"] },
      ]),
    ).toEqual(
      new Map([
        ["react", 2],
        ["docker", 1],
      ]),
    );
  });
});
