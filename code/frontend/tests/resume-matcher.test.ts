import { describe, expect, it } from "vitest";

import { matchSkillsInText, skillsSectionText, type MatchableSkill } from "@/lib/resume-matcher";

function skill(slug: string, name: string, aliases: string[] = [], strictMatch = false): MatchableSkill {
  return { slug, name, aliases, strictMatch };
}

const CATALOG: MatchableSkill[] = [
  skill("javascript", "JavaScript", ["JS"]),
  skill("typescript", "TypeScript", ["TS"]),
  skill("java", "Java"),
  skill("git", "Git", ["GitHub"]),
  skill("cpp", "C++", ["CPP"]),
  skill("csharp", "C#"),
  skill("c", "C", [], true),
  skill("r", "R", [], true),
  skill("go", "Go", ["Golang", "golang"], true),
  skill("nodejs", "Node.js", ["Node"]),
  skill("react", "React", ["ReactJS"], true),
  skill("sql", "SQL"),
  skill("mysql", "MySQL"),
  skill("dotnet", ".NET", [".NET Core"]),
  skill("aspnet", "ASP.NET", ["ASP.NET Core"]),
  skill("python", "Python"),
  skill("uiux", "UI/UX Design", ["UI/UX"]),
  skill("weird", "A+ (cert)?"),
];

const match = (text: string) => matchSkillsInText(text, CATALOG).sort();

describe("matchSkillsInText", () => {
  it("matches punctuation-heavy names", () => {
    expect(match("Built with React, Node.js and C++.")).toEqual(["cpp", "nodejs", "react"]);
  });

  it("does not read the .js suffix of a framework as JavaScript", () => {
    expect(match("Frontend in Vue.js")).toEqual([]);
  });

  it("does not match inside other words", () => {
    expect(match("Led projects in digital marketing")).toEqual([]);
    expect(match("JavaScript developer")).toEqual(["javascript"]);
    expect(match("Databases: MySQL")).toEqual(["mysql"]);
  });

  it("is case-sensitive for strictMatch skills", () => {
    expect(match("Wrote services in Go and Python")).toEqual(["go", "python"]);
    expect(match("ready to go the extra mile")).toEqual([]);
    expect(match("I react quickly to feedback")).toEqual([]);
  });

  it("lets strictMatch skills match their ALL-CAPS form but never lowercase", () => {
    expect(match("Skills: REACT, GO")).toEqual(["go", "react"]);
    expect(match("I react quickly")).toEqual([]);
  });

  it("only counts single-letter skills inside a Skills section", () => {
    expect(match("Grade: C in Chemistry\nSKILLS\nPython, R\nEducation\nC programming course")).toEqual(["python", "r"]);
  });

  it("reads inline Skills: lines and keeps C, C++ and C# apart", () => {
    expect(match("Technical Skills: C, C#")).toEqual(["c", "csharp"]);
  });

  it("does not see .NET inside ASP.NET", () => {
    expect(match("APIs with ASP.NET Core")).toEqual(["aspnet"]);
    expect(match("Desktop apps on .NET")).toEqual(["dotnet"]);
  });

  it("handles regex metacharacters in names without throwing", () => {
    expect(match("Certified A+ (cert)? holder, UI/UX work")).toEqual(["uiux", "weird"]);
  });
});

describe("skillsSectionText", () => {
  it("returns only the lines between a Skills heading and the next section", () => {
    expect(skillsSectionText("Summary\nhi\nSkills\nPython\nGo\nProjects\nX").trim()).toBe("Python\nGo");
  });
});
