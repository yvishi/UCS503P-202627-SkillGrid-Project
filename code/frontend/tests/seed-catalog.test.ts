import { describe, expect, it } from "vitest";

import { computeKeys } from "@/lib/skill-catalog-core";
import { skillKey } from "@/lib/skill-normalize";
import { SEED_SKILLS } from "@/prisma/seed-data/skills";

describe("seed catalog", () => {
  it("is large enough to replace the fixed list", () => {
    expect(SEED_SKILLS.length).toBeGreaterThanOrEqual(250);
  });

  it("has unique, well-formed slugs", () => {
    const slugs = SEED_SKILLS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("never gives two skills the same lookup key", () => {
    const owner = new Map<string, string>();
    for (const s of SEED_SKILLS) {
      for (const key of computeKeys(s.slug, s.name, s.aliases ?? [])) {
        expect(owner.get(key) ?? s.slug, `key "${key}"`).toBe(s.slug);
        owner.set(key, s.slug);
      }
    }
  });

  it("keeps every slug old data can point at", () => {
    const slugs = new Set(SEED_SKILLS.map((s) => s.slug));
    for (const legacy of [
      "javascript", "typescript", "python", "java", "cpp", "go", "react", "nextjs", "nodejs",
      "flutter", "react-native", "sql", "docker", "kubernetes", "aws", "git", "figma", "solidity",
      "pytorch", "tensorflow", "pandas", "numpy",
    ]) {
      expect(slugs.has(legacy), legacy).toBe(true);
    }
  });

  it("marks every name of two characters or fewer as strictMatch", () => {
    for (const s of SEED_SKILLS.filter((s) => s.name.length <= 2)) {
      expect(s.strictMatch, s.name).toBe(true);
    }
  });

  it("covers the GitHub linguist names that should map onto existing skills", () => {
    const keys = new Set(SEED_SKILLS.flatMap((s) => computeKeys(s.slug, s.name, s.aliases ?? [])));
    for (const linguist of ["Jupyter Notebook", "Dockerfile", "HCL", "SCSS", "TeX", "Vue", "Shell", "TSQL", "PLpgSQL", "C++", "C#"]) {
      expect(keys.has(skillKey(linguist)), linguist).toBe(true);
    }
  });
});
