import { describe, expect, it } from "vitest";
import {
  PAGE_SIZE,
  headline,
  inviteChoice,
  joinState,
  parseTeamFilters,
  parseTeammateFilters,
} from "@/lib/discovery-core";

describe("parseTeammateFilters", () => {
  it("returns defaults for empty params", () => {
    expect(parseTeammateFilters({})).toEqual({
      skills: [],
      interest: null,
      availability: null,
      hackathon: null,
      page: 1,
    });
  });

  it("accepts skill as string or array, lowercased, de-duplicated, capped at 3", () => {
    expect(parseTeammateFilters({ skill: "React" }).skills).toEqual(["react"]);
    expect(
      parseTeammateFilters({ skill: ["React", "react", "Node", "Go", "Rust"] }).skills,
    ).toEqual(["react", "node", "go"]);
  });

  it("ignores empty skill values", () => {
    expect(parseTeammateFilters({ skill: ["", " ", "go"] }).skills).toEqual(["go"]);
  });

  it("nulls unknown availability and interest", () => {
    const f = parseTeammateFilters({ availability: "FOO", interest: "Nope" });
    expect(f.availability).toBeNull();
    expect(f.interest).toBeNull();
  });

  it("keeps valid availability and interest", () => {
    const f = parseTeammateFilters({ availability: "BOTH", interest: "Backend" });
    expect(f.availability).toBe("BOTH");
    expect(f.interest).toBe("Backend");
  });

  it("parses hackathon, empty becomes null", () => {
    expect(parseTeammateFilters({ hackathon: "Hack-1" }).hackathon).toBe("hack-1");
    expect(parseTeammateFilters({ hackathon: "" }).hackathon).toBeNull();
  });

  it("falls back to page 1 for junk", () => {
    expect(parseTeammateFilters({ page: "-3" }).page).toBe(1);
    expect(parseTeammateFilters({ page: "abc" }).page).toBe(1);
    expect(parseTeammateFilters({ page: "0" }).page).toBe(1);
    expect(parseTeammateFilters({ page: "1.5" }).page).toBe(1);
    expect(parseTeammateFilters({}).page).toBe(1);
    expect(parseTeammateFilters({ page: "2" }).page).toBe(2);
  });
});

describe("parseTeamFilters", () => {
  it("returns defaults", () => {
    expect(parseTeamFilters({})).toEqual({ hackathon: null, skill: null, page: 1 });
  });

  it("lowercases slugs and nulls empty values", () => {
    expect(parseTeamFilters({ hackathon: "SIH", skill: "React" })).toEqual({
      hackathon: "sih",
      skill: "react",
      page: 1,
    });
    expect(parseTeamFilters({ hackathon: "", skill: [] })).toEqual({
      hackathon: null,
      skill: null,
      page: 1,
    });
  });

  it("tolerates junk page", () => {
    expect(parseTeamFilters({ page: "-3" }).page).toBe(1);
    expect(parseTeamFilters({ page: "4" }).page).toBe(4);
  });
});

describe("headline", () => {
  it("handles no skills", () => {
    expect(headline([])).toBe("New to SkillGrid");
  });
  it("joins the top two skills", () => {
    expect(
      headline([
        { name: "React", score: 80 },
        { name: "Go", score: 60 },
        { name: "SQL", score: 40 },
      ]),
    ).toBe("React · Go");
    expect(headline([{ name: "React", score: 80 }])).toBe("React");
  });
});

describe("PAGE_SIZE", () => {
  it("is 24", () => expect(PAGE_SIZE).toBe(24));
});

describe("inviteChoice", () => {
  const a = { id: "a", name: "Alpha", hackathonName: "Hack one" };
  const b = { id: "b", name: "Beta", hackathonName: "Hack two" };

  it("is no-team when the viewer leads nothing", () => {
    expect(inviteChoice([], [])).toEqual({ kind: "no-team" });
  });

  it("is one when a single team can still invite", () => {
    expect(inviteChoice([a], [])).toEqual({ kind: "one", team: a });
    expect(inviteChoice([a, b], ["a"])).toEqual({ kind: "one", team: b });
  });

  it("is many when several teams can invite, keeping their order", () => {
    expect(inviteChoice([a, b], [])).toEqual({ kind: "many", teams: [a, b] });
  });

  it("is done when every led team already has a pending row with the person", () => {
    expect(inviteChoice([a, b], ["b", "a"])).toEqual({ kind: "done" });
  });
});

describe("joinState", () => {
  const team = { id: "t1", hackathonSlug: "hack-1" };
  const none = { memberHackathonSlugs: [], requestedTeamIds: [], invitedTeamIds: [] };

  it("is open with no history", () => {
    expect(joinState(team, none)).toBe("open");
  });

  it("reports a pending request or invite for this team only", () => {
    expect(joinState(team, { ...none, requestedTeamIds: ["t1"] })).toBe("requested");
    expect(joinState(team, { ...none, invitedTeamIds: ["t1"] })).toBe("invited");
    expect(joinState(team, { ...none, requestedTeamIds: ["t2"], invitedTeamIds: ["t3"] })).toBe("open");
  });

  it("puts already having a team in the hackathon first", () => {
    expect(
      joinState(team, { memberHackathonSlugs: ["hack-1"], requestedTeamIds: ["t1"], invitedTeamIds: ["t1"] }),
    ).toBe("in-hackathon");
    expect(joinState(team, { ...none, memberHackathonSlugs: ["hack-2"] })).toBe("open");
  });
});
