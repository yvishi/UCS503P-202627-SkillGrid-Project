import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { setVisibilityAction } from "@/app/admin/hackathons/actions";
import { syncHackathons } from "@/lib/hackathon-feeds";
import type { FeedHackathon, FeedSource } from "@/lib/hackathon-feeds-core";
import { prisma } from "@/lib/prisma";
import { createTeam, listHackathons } from "@/lib/teams";
import { createUser, resetDb, signInAs } from "./helpers";

beforeEach(async () => {
  await resetDb();
  signInAs(null);
});
afterAll(async () => {
  await prisma.$disconnect();
});

const now = new Date("2026-11-25T00:00:00Z");

function feed(source: FeedSource, externalId: string, over: Partial<FeedHackathon> = {}): FeedHackathon {
  return {
    source,
    externalId,
    name: `Hack ${externalId}`,
    url: `https://example.com/${externalId}`,
    location: "Online",
    startsAt: new Date("2026-12-01T00:00:00Z"),
    endsAt: new Date("2026-12-03T00:00:00Z"),
    teamSizeMin: 2,
    teamSizeMax: 4,
    ...over,
  };
}

function fetcher(items: Partial<Record<FeedSource, FeedHackathon[] | Error>>) {
  return async (source: FeedSource) => {
    const v = items[source] ?? [];
    if (v instanceof Error) throw v;
    return v;
  };
}

describe("syncHackathons", () => {
  it("publishes auto-publish sources and queues the rest", async () => {
    const result = await syncHackathons({
      now,
      autoPublish: "devfolio",
      fetcher: fetcher({ devfolio: [feed("devfolio", "a")], unstop: [feed("unstop", "b")] }),
    });
    expect(result.sources.find((s) => s.source === "devfolio")).toMatchObject({ created: 1, updated: 0 });
    const rows = await prisma.hackathon.findMany({ orderBy: { externalId: "asc" } });
    expect(rows.map((r) => [r.externalId, r.visibility, r.createdById])).toEqual([
      ["a", "PUBLISHED", null],
      ["b", "PENDING", null],
    ]);
    expect((await listHackathons(now)).map((h) => h.name)).toEqual(["Hack a"]);
  });

  it("updates on re-sync without duplicating or un-hiding", async () => {
    await syncHackathons({ now, autoPublish: "unstop", fetcher: fetcher({ unstop: [feed("unstop", "1")] }) });
    const row = await prisma.hackathon.findFirstOrThrow();
    await prisma.hackathon.update({ where: { id: row.id }, data: { visibility: "HIDDEN" } });

    const later = new Date("2026-12-05T00:00:00Z");
    const result = await syncHackathons({
      now,
      autoPublish: "unstop",
      fetcher: fetcher({ unstop: [feed("unstop", "1", { name: "Renamed", endsAt: later })] }),
    });
    expect(result.sources.find((s) => s.source === "unstop")).toMatchObject({ created: 0, updated: 1 });
    const after = await prisma.hackathon.findMany();
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ name: "Renamed", endsAt: later, visibility: "HIDDEN", slug: row.slug });
  });

  it("skips ended events, dedupes within a feed and gives clashing names their own slugs", async () => {
    await syncHackathons({
      now,
      autoPublish: "devfolio,unstop",
      fetcher: fetcher({
        devfolio: [feed("devfolio", "x", { name: "HackFest" }), feed("devfolio", "x", { name: "HackFest" })],
        unstop: [
          feed("unstop", "y", { name: "HackFest" }),
          feed("unstop", "old", { startsAt: new Date("2026-10-01"), endsAt: new Date("2026-10-02") }),
        ],
      }),
    });
    const slugs = (await prisma.hackathon.findMany({ select: { slug: true } })).map((r) => r.slug).sort();
    expect(slugs).toEqual(["hackfest", "hackfest-unstop"]);
  });

  it("keeps team sizes once a team has formed", async () => {
    await syncHackathons({ now, autoPublish: "devfolio", fetcher: fetcher({ devfolio: [feed("devfolio", "t")] }) });
    const h = await prisma.hackathon.findFirstOrThrow();
    const lead = await createUser({ onboarded: true });
    expect((await createTeam(lead.id, h.id, { name: "Alpha", lookingFor: [] })).ok).toBe(true);

    await syncHackathons({
      now,
      autoPublish: "devfolio",
      fetcher: fetcher({ devfolio: [feed("devfolio", "t", { teamSizeMin: 1, teamSizeMax: 2, name: "New name" })] }),
    });
    expect(await prisma.hackathon.findFirstOrThrow()).toMatchObject({ name: "New name", teamSizeMin: 2, teamSizeMax: 4 });
  });

  it("reports a failing source and still saves the others", async () => {
    const result = await syncHackathons({
      now,
      fetcher: fetcher({ devfolio: [feed("devfolio", "ok")], devpost: new Error("devpost.com answered 503") }),
    });
    expect(result.sources.find((s) => s.source === "devpost")?.error).toBe("devpost.com answered 503");
    expect(await prisma.hackathon.count()).toBe(1);
  });

  it("doesn't let teams start in a pending hackathon", async () => {
    await syncHackathons({ now, autoPublish: "", fetcher: fetcher({ unstop: [feed("unstop", "p")] }) });
    const h = await prisma.hackathon.findFirstOrThrow();
    const lead = await createUser({ onboarded: true });
    expect((await createTeam(lead.id, h.id, { name: "Early", lookingFor: [] })).ok).toBe(false);
  });
});

describe("setVisibilityAction", () => {
  it("lets only admins publish", async () => {
    await syncHackathons({ now, autoPublish: "", fetcher: fetcher({ unstop: [feed("unstop", "q")] }) });
    const h = await prisma.hackathon.findFirstOrThrow();
    const fd = new FormData();
    fd.set("id", h.id);
    fd.set("visibility", "PUBLISHED");

    signInAs(await createUser());
    await setVisibilityAction(fd);
    expect((await prisma.hackathon.findFirstOrThrow()).visibility).toBe("PENDING");

    signInAs(await createUser({ admin: true }));
    await setVisibilityAction(fd);
    expect((await prisma.hackathon.findFirstOrThrow()).visibility).toBe("PUBLISHED");
  });
});
