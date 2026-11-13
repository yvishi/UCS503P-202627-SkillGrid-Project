import { describe, expect, it } from "vitest";

import {
  editDistance,
  expandLegacySlugs,
  maxTypoDistance,
  skillKey,
  toSlug,
  validateSkillName,
} from "@/lib/skill-normalize";

describe("skillKey", () => {
  it.each([
    ["React.js", "reactjs"],
    ["react js", "reactjs"],
    ["ReactJS", "reactjs"],
    ["  Node JS ", "nodejs"],
    ["C++", "c++"],
    ["C#", "c#"],
    ["c", "c"],
    ["Ruby_on-Rails", "rubyonrails"],
    ["   ", ""],
  ])("%j -> %j", (input, expected) => {
    expect(skillKey(input)).toBe(expected);
  });

  it("keeps C, C++ and C# distinct", () => {
    expect(new Set(["C", "C++", "C#"].map(skillKey)).size).toBe(3);
  });
});

describe("toSlug", () => {
  it.each([
    ["C++", "cplusplus"],
    ["C#", "csharp"],
    ["F#", "fsharp"],
    ["Vue.js", "vue-js"],
    ["  Ruby on Rails ", "ruby-on-rails"],
    ["---", ""],
  ])("%j -> %j", (input, expected) => {
    expect(toSlug(input)).toBe(expected);
  });
});

describe("validateSkillName", () => {
  it("accepts a name and tidies whitespace", () => {
    expect(validateSkillName("  Svelte   Kit ")).toEqual({ ok: true, name: "Svelte Kit" });
  });

  it("accepts names with symbols", () => {
    expect(validateSkillName("C++")).toEqual({ ok: true, name: "C++" });
  });

  it("accepts exactly 40 characters", () => {
    expect(validateSkillName("x".repeat(40)).ok).toBe(true);
  });

  it.each(["", "   ", "x".repeat(41), "https://svelte.dev", "www.svelte.dev", "github.com/user/repo", "+++", "123"])(
    "rejects %j",
    (input) => {
      expect(validateSkillName(input).ok).toBe(false);
    },
  );
});

describe("editDistance", () => {
  it("counts a transposition as one edit", () => {
    expect(editDistance("raect", "react")).toBe(1);
  });

  it.each([
    ["pyhton", "python", 1],
    ["kubernets", "kubernetes", 1],
    ["", "abc", 3],
    ["same", "same", 0],
    ["rust", "ruby", 2],
  ])("%j vs %j = %d", (a, b, expected) => {
    expect(editDistance(a, b)).toBe(expected);
  });
});

describe("maxTypoDistance", () => {
  it.each([
    ["go", 1],
    ["react", 1],
    ["kubernetes", 2],
  ])("%j allows %d", (key, expected) => {
    expect(maxTypoDistance(key)).toBe(expected);
  });
});

describe("expandLegacySlugs", () => {
  it("splits retired combined slugs and de-duplicates", () => {
    expect(expandLegacySlugs(["react", "pytorch-tensorflow", "pytorch", "pandas-numpy"])).toEqual([
      "react",
      "pytorch",
      "tensorflow",
      "pandas",
      "numpy",
    ]);
  });
});
