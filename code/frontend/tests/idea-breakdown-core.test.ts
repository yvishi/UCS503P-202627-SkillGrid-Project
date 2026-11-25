import { describe, expect, it } from "vitest";

import {
  MAX_IDEA_SKILLS,
  buildIdeaMessages,
  parseIdeaReply,
  validateIdea,
  type PromptSkill,
} from "@/lib/idea-breakdown-core";

const catalog: PromptSkill[] = [
  { slug: "react", name: "React", keys: ["react", "reactjs"] },
  { slug: "python", name: "Python", keys: ["python"] },
  { slug: "figma", name: "Figma", keys: ["figma"] },
];

describe("validateIdea", () => {
  it("rejects non-strings and short ideas", () => {
    expect(validateIdea(undefined).ok).toBe(false);
    expect(validateIdea("an app").ok).toBe(false);
  });
  it("rejects overly long ideas", () => {
    expect(validateIdea("x".repeat(2001)).ok).toBe(false);
  });
  it("collapses whitespace", () => {
    expect(validateIdea("  a  web   app for booking labs  ")).toEqual({
      ok: true,
      idea: "a web app for booking labs",
    });
  });
});

describe("buildIdeaMessages", () => {
  it("lists the catalog and fences the idea", () => {
    const [system, user] = buildIdeaMessages("my idea text here", catalog);
    expect(system.content).toContain("react: React");
    expect(user.content).toContain('"""\nmy idea text here\n"""');
  });
});

describe("parseIdeaReply", () => {
  it("maps slugs, names and aliases onto the catalog", () => {
    const reply = JSON.stringify({
      summary: "A thing.",
      skills: [
        { slug: "react", name: "React", why: "UI" },
        { slug: null, name: "React.js", why: "dupe" },
        { slug: "py", name: "Python", why: "backend" },
        { slug: null, name: "Blockchain", why: "ledger" },
      ],
    });
    expect(parseIdeaReply(reply, catalog)).toEqual({
      summary: "A thing.",
      skills: [
        { slug: "react", name: "React", why: "UI" },
        { slug: "python", name: "Python", why: "backend" },
        { slug: null, name: "Blockchain", why: "ledger" },
      ],
    });
  });

  it("reads JSON wrapped in a code fence", () => {
    const reply = '```json\n{"summary":"s","skills":[{"slug":"figma","name":"Figma"}]}\n```';
    expect(parseIdeaReply(reply, catalog)?.skills).toEqual([{ slug: "figma", name: "Figma", why: "" }]);
  });

  it("caps the number of skills", () => {
    const skills = Array.from({ length: 20 }, (_, i) => ({ slug: null, name: `Skill ${i}` }));
    expect(parseIdeaReply(JSON.stringify({ skills }), catalog)?.skills).toHaveLength(MAX_IDEA_SKILLS);
  });

  it("returns null for unusable replies", () => {
    expect(parseIdeaReply("sorry, I can't", catalog)).toBeNull();
    expect(parseIdeaReply('{"skills": "react"}', catalog)).toBeNull();
  });
});
