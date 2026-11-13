import { describe, expect, it } from "vitest";

import {
  computeKeys,
  findInCatalog,
  popularIn,
  rankSkills,
  suggestSimilarIn,
  type CatalogSkill,
  type SkillCategoryName,
} from "@/lib/skill-catalog-core";

function skill(
  slug: string,
  name: string,
  aliases: string[] = [],
  users = 0,
  category: SkillCategoryName = "FRAMEWORK",
): CatalogSkill {
  return { slug, name, aliases, keys: computeKeys(slug, name, aliases), category, strictMatch: false, users };
}

const CATALOG: CatalogSkill[] = [
  skill("react", "React", ["ReactJS", "React.js"], 50),
  skill("react-native", "React Native", [], 10),
  skill("redux", "Redux", [], 5, "LIBRARY"),
  skill("preact", "Preact", [], 1),
  skill("nodejs", "Node.js", ["Node", "NodeJS"], 30),
  skill("cpp", "C++", ["CPP"], 20, "LANGUAGE"),
  skill("c", "C", [], 15, "LANGUAGE"),
  skill("csharp", "C#", [], 12, "LANGUAGE"),
  skill("python", "Python", [], 60, "LANGUAGE"),
  skill("kubernetes", "Kubernetes", ["K8s"], 8, "TOOL"),
];

const slugs = (results: { slug: string }[]) => results.map((r) => r.slug);

describe("rankSkills", () => {
  it("puts the exact match first, then prefixes, then substrings", () => {
    expect(slugs(rankSkills(CATALOG, "react"))).toEqual(["react", "react-native", "preact"]);
  });

  it("reports the alias that matched", () => {
    const [top] = rankSkills(CATALOG, "reactjs");
    expect(top).toMatchObject({ slug: "react", matchedAlias: "ReactJS" });
  });

  it("does not report an alias when the name itself matched", () => {
    expect(rankSkills(CATALOG, "node js")[0]).toMatchObject({ slug: "nodejs", matchedAlias: null });
  });

  it("orders each tier by popularity and respects the limit", () => {
    expect(slugs(rankSkills(CATALOG, "c", 3))).toEqual(["c", "cpp", "csharp"]);
  });

  it("returns nothing for blank input", () => {
    expect(rankSkills(CATALOG, "   ")).toEqual([]);
  });
});

describe("findInCatalog", () => {
  it("finds by alias regardless of spacing or case", () => {
    expect(findInCatalog(CATALOG, "k8s")?.slug).toBe("kubernetes");
    expect(findInCatalog(CATALOG, "React.JS")?.slug).toBe("react");
  });

  it("returns null when nothing matches", () => {
    expect(findInCatalog(CATALOG, "Rust")).toBeNull();
  });
});

describe("suggestSimilarIn", () => {
  it("catches transposed letters", () => {
    expect(slugs(suggestSimilarIn(CATALOG, "raect"))).toEqual(["react"]);
    expect(slugs(suggestSimilarIn(CATALOG, "pyhton"))).toEqual(["python"]);
  });

  it("suggests nothing for unrelated text", () => {
    expect(suggestSimilarIn(CATALOG, "zzzzzz")).toEqual([]);
  });
});

describe("popularIn", () => {
  it("returns the most-used skills in one category", () => {
    expect(slugs(popularIn(CATALOG, "LANGUAGE", 2))).toEqual(["python", "cpp"]);
  });
});
