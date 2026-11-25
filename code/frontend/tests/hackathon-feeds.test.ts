import { describe, expect, it } from "vitest";

import {
  autoPublishSources,
  cleanName,
  isCurrent,
  isRelevant,
  parseDevfolio,
  parseDevpost,
  parseDevpostDates,
  parseUnstop,
  teamSizes,
  uniqueSlug,
} from "@/lib/hackathon-feeds-core";

// Shapes trimmed from real responses fetched on 2026-11-25.
const devfolioHit = {
  _source: {
    name: "MakerSpark",
    slug: "makerspark",
    uuid: "931ca9149c46417bb0526ce1eb44b920",
    starts_at: "2026-12-09T03:30:00+00:00",
    ends_at: "2026-12-09T11:30:00+00:00",
    team_min: 1,
    team_size: 4,
    is_online: false,
    city: "Thiruvananthapuram",
    location: "IIITMK Building, Technopark Campus, Thiruvananthapuram",
  },
};

const unstopItem = {
  id: 1827866,
  title: "CodePulse 48 - National Hackathon",
  public_url: "hackathons/codepulse-48-national-hackathon-wecodecoders-1827866",
  seo_url: "https://unstop.com/hackathons/codepulse-48-national-hackathon-wecodecoders-1827866",
  end_date: "2026-12-29T10:00:51+05:30",
  region: "online",
  regnRequirements: {
    start_regn_dt: "2026-11-24T18:30:05+05:30",
    end_regn_dt: "2026-12-25T06:06:26+05:30",
    min_team_size: 1,
    max_team_size: 4,
  },
};

const devpostItem = {
  id: 31667,
  title: "Kiroween 2026",
  url: "https://kiroween.devpost.com/",
  displayed_location: { icon: "globe", location: "Online" },
  submission_period_dates: "Oct 30 - Dec 04, 2026",
  invite_only: false,
};

describe("parseDevfolio", () => {
  it("reads a search hit", () => {
    expect(parseDevfolio(devfolioHit)).toEqual({
      source: "devfolio",
      externalId: "931ca9149c46417bb0526ce1eb44b920",
      name: "MakerSpark",
      url: "https://makerspark.devfolio.co/",
      location: "Thiruvananthapuram",
      startsAt: new Date("2026-12-09T03:30:00Z"),
      endsAt: new Date("2026-12-09T11:30:00Z"),
      teamSizeMin: 1,
      teamSizeMax: 4,
    });
  });

  it("labels online events and skips ones without dates", () => {
    expect(parseDevfolio({ _source: { ...devfolioHit._source, is_online: true } })?.location).toBe("Online");
    expect(parseDevfolio({ _source: { ...devfolioHit._source, starts_at: null } })).toBeNull();
    expect(parseDevfolio(null)).toBeNull();
  });
});

describe("parseUnstop", () => {
  it("runs from registration opening to the end date", () => {
    const h = parseUnstop(unstopItem)!;
    expect(h).toMatchObject({ source: "unstop", externalId: "1827866", location: "Online", teamSizeMin: 1, teamSizeMax: 4 });
    expect(h.url).toBe(unstopItem.seo_url);
    expect(h.startsAt.toISOString()).toBe("2026-11-24T13:00:05.000Z");
    expect(h.endsAt.toISOString()).toBe("2026-12-29T04:30:51.000Z");
  });

  it("builds the link from public_url when seo_url is missing", () => {
    expect(parseUnstop({ ...unstopItem, seo_url: undefined })?.url).toBe(`https://unstop.com/${unstopItem.public_url}`);
  });

  it("skips entries whose end isn't after the start", () => {
    expect(parseUnstop({ ...unstopItem, end_date: "2026-11-01T00:00:00+05:30" })).toBeNull();
  });
});

describe("parseDevpostDates", () => {
  const ist = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hourCycle: "h23" });

  it("reads a range across months", () => {
    const r = parseDevpostDates("Oct 30 - Dec 04, 2026")!;
    expect(ist(r.startsAt)).toBe("30/10/2026, 00:00:00");
    expect(ist(r.endsAt)).toBe("4/12/2026, 23:59:59");
  });

  it("reads a range inside one month", () => {
    const r = parseDevpostDates("Nov 11 - 30, 2026")!;
    expect(ist(r.startsAt)).toBe("11/11/2026, 00:00:00");
    expect(ist(r.endsAt)).toBe("30/11/2026, 23:59:59");
  });

  it("reads a range across years", () => {
    const r = parseDevpostDates("Nov 11, 2026 - Jan 11, 2027")!;
    expect(ist(r.startsAt)).toBe("11/11/2026, 00:00:00");
    expect(ist(r.endsAt)).toBe("11/1/2027, 23:59:59");
  });

  it("puts a yearless December start in the previous year", () => {
    expect(parseDevpostDates("Dec 20 - Jan 05, 2027")!.startsAt.getUTCFullYear()).toBe(2026);
  });

  it("reads a single day and rejects nonsense", () => {
    const r = parseDevpostDates("Dec 01, 2026")!;
    expect(r.endsAt.getTime() - r.startsAt.getTime()).toBe(24 * 60 * 60 * 1000 - 1000);
    expect(parseDevpostDates("Ongoing")).toBeNull();
    expect(parseDevpostDates("")).toBeNull();
  });
});

describe("parseDevpost", () => {
  it("reads an entry with the default team range", () => {
    expect(parseDevpost(devpostItem)).toMatchObject({
      source: "devpost",
      externalId: "31667",
      name: "Kiroween 2026",
      url: "https://kiroween.devpost.com/",
      location: "Online",
      teamSizeMin: 1,
      teamSizeMax: 4,
    });
  });

  it("skips invite-only hackathons", () => {
    expect(parseDevpost({ ...devpostItem, invite_only: true })).toBeNull();
  });
});

describe("filters", () => {
  const now = new Date("2026-11-25T00:00:00Z");
  const h = parseDevpost(devpostItem)!;

  it("keeps hackathons that haven't ended and start within the horizon", () => {
    expect(isCurrent(h, now)).toBe(true);
    expect(isCurrent(h, new Date("2026-12-31T00:00:00Z"))).toBe(false);
    expect(isCurrent({ ...h, startsAt: new Date("2027-09-01"), endsAt: new Date("2027-09-02") }, now)).toBe(false);
  });

  it("keeps only online Devpost events", () => {
    expect(isRelevant(h)).toBe(true);
    expect(isRelevant({ ...h, location: "San Francisco, CA" })).toBe(false);
    expect(isRelevant({ ...parseUnstop(unstopItem)!, location: "Offline" })).toBe(true);
  });
});

describe("helpers", () => {
  it("clamps and orders team sizes", () => {
    expect(teamSizes(2, 2)).toEqual({ teamSizeMin: 2, teamSizeMax: 2 });
    expect(teamSizes(0, 50)).toEqual({ teamSizeMin: 1, teamSizeMax: 8 });
    expect(teamSizes(5, 3)).toEqual({ teamSizeMin: 3, teamSizeMax: 5 });
    expect(teamSizes(undefined, undefined)).toEqual({ teamSizeMin: 1, teamSizeMax: 4 });
    expect(teamSizes("3", null)).toEqual({ teamSizeMin: 3, teamSizeMax: 4 });
  });

  it("cuts long names at a word", () => {
    const name = cleanName("Smart India Hackathon ".repeat(6))!;
    expect(name.length).toBeLessThanOrEqual(80);
    expect(name.endsWith("…")).toBe(true);
    expect(cleanName("  ab ")).toBeNull();
  });

  it("finds a free slug", () => {
    const taken = new Set(["hackfest", "hackfest-unstop"]);
    expect(uniqueSlug("hackfest", { source: "devfolio", externalId: "x" }, taken)).toBe("hackfest-devfolio");
    expect(uniqueSlug("hackfest", { source: "unstop", externalId: "123" }, taken)).toBe("hackfest-unstop-123");
    expect(uniqueSlug("hackfest", { source: "unstop", externalId: "123" }, taken)).toBe("hackfest-unstop-123-2");
  });

  it("reads which sources auto-publish", () => {
    expect([...autoPublishSources(undefined)]).toEqual(["devfolio"]);
    expect([...autoPublishSources("")]).toEqual([]);
    expect([...autoPublishSources(" Unstop, devpost,nope")]).toEqual(["unstop", "devpost"]);
  });
});
