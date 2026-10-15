import { describe, expect, it } from "vitest";

import { rankSuggestions, type EvidenceSnapshot } from "@/lib/skill-suggestions";

const EVIDENCE: EvidenceSnapshot = {
  github: [
    { slug: "react", level: 4 },
    { slug: "rust", level: 3 },
    { slug: "go", level: 2 },
  ],
  resume: ["react", "python", "unknown"],
  names: { react: "React", rust: "Rust", python: "Python", go: "Go" },
};

describe("rankSuggestions", () => {
  it("merges sources, skips owned skills and unnamed slugs, strongest first", () => {
    expect(rankSuggestions(EVIDENCE, new Set(["rust"]))).toEqual([
      { slug: "react", name: "React", sources: ["github", "resume"], strength: 5 },
      { slug: "python", name: "Python", sources: ["resume"], strength: 3 },
      { slug: "go", name: "Go", sources: ["github"], strength: 2 },
    ]);
  });

  it("breaks strength ties by name", () => {
    const evidence: EvidenceSnapshot = {
      github: [
        { slug: "b", level: 3 },
        { slug: "a", level: 3 },
      ],
      resume: [],
      names: { a: "Alpha", b: "Beta" },
    };
    expect(rankSuggestions(evidence, new Set()).map((s) => s.slug)).toEqual(["a", "b"]);
  });
});
