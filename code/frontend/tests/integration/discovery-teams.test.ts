import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { findOpenTeams } from "@/lib/discovery";
import { prisma } from "@/lib/prisma";
import { createUser, resetDb } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;
const none = { hackathon: null, skill: null, page: 1 };

beforeEach(resetDb);
afterAll(async () => {
  await prisma.$disconnect();
});

async function hackathon(slug: string, opts: { ended?: boolean; max?: number } = {}) {
  const createdBy = await createUser();
  const now = Date.now();
  return prisma.hackathon.create({
    data: {
      slug,
      name: `Hack ${slug}`,
      startsAt: new Date(now - 10 * DAY),
      endsAt: new Date(now + (opts.ended ? -DAY : 10 * DAY)),
      teamSizeMax: opts.max ?? 4,
      createdById: createdBy.id,
    },
  });
}

async function team(
  h: { id: string },
  name: string,
  memberIds: string[],
  lookingFor: string[] = [],
) {
  const t = await prisma.team.create({
    data: { hackathonId: h.id, name, lookingFor, createdById: memberIds[0] },
  });
  for (const [i, userId] of memberIds.entries()) {
    await prisma.teamMember.create({
      data: { teamId: t.id, userId, hackathonId: h.id, role: i === 0 ? "LEAD" : "MEMBER" },
    });
  }
  return t;
}

describe("findOpenTeams", () => {
  it("does not list a full team", async () => {
    const viewer = await createUser();
    const h = await hackathon("full", { max: 2 });
    const [a, b, c] = [await createUser(), await createUser(), await createUser()];
    await team(h, "Full", [a.id, b.id]);
    await team(h, "Has room", [c.id]);

    const { items } = await findOpenTeams(viewer.id, none);
    expect(items.map((t) => t.name)).toEqual(["Has room"]);
  });

  it("does not list a team of an ended hackathon", async () => {
    const viewer = await createUser();
    const ended = await hackathon("old", { ended: true });
    const live = await hackathon("live");
    await team(ended, "Old", [(await createUser()).id]);
    await team(live, "Live", [(await createUser()).id]);

    const { items } = await findOpenTeams(viewer.id, none);
    expect(items.map((t) => t.name)).toEqual(["Live"]);
  });

  it("excludes the viewer's own team", async () => {
    const viewer = await createUser();
    const h = await hackathon("mine");
    await team(h, "Mine", [viewer.id]);
    await team(h, "Theirs", [(await createUser()).id]);

    const { items } = await findOpenTeams(viewer.id, none);
    expect(items.map((t) => t.name)).toEqual(["Theirs"]);
  });

  it("filters by skill slug and hackathon", async () => {
    const viewer = await createUser();
    const h1 = await hackathon("h1");
    const h2 = await hackathon("h2");
    await team(h1, "Wants react", [(await createUser()).id], ["react"]);
    await team(h1, "Wants python", [(await createUser()).id], ["python"]);
    await team(h2, "Also react", [(await createUser()).id], ["react", "python"]);

    const bySkill = await findOpenTeams(viewer.id, { ...none, skill: "react" });
    expect(bySkill.items.map((t) => t.name).sort()).toEqual(["Also react", "Wants react"]);

    const both = await findOpenTeams(viewer.id, { hackathon: "h1", skill: "react", page: 1 });
    expect(both.items.map((t) => t.name)).toEqual(["Wants react"]);
  });

  it("computes openSlots, names members, and turns slugs into skill names", async () => {
    const viewer = await createUser();
    const h = await hackathon("slots", { max: 4 });
    const [a, b] = [await createUser(), await createUser()];
    await team(h, "Duo", [a.id, b.id], ["react", "no-such-skill-xyz"]);

    const { items, hasMore } = await findOpenTeams(viewer.id, none);
    expect(hasMore).toBe(false);
    expect(items).toHaveLength(1);
    const t = items[0];
    expect(t.openSlots).toBe(2);
    expect(t.hackathonSlug).toBe("slots");
    expect(t.hackathonName).toBe("Hack slots");
    expect(t.members).toHaveLength(2);
    expect(t.members[0]).toBe(a.email.split("@")[0]);
    const react = await prisma.skill.findUniqueOrThrow({ where: { slug: "react" } });
    expect(t.lookingFor).toEqual([react.name]); // unknown slug dropped
  });

  it("lists newest first and pages with hasMore", async () => {
    const viewer = await createUser();
    const h = await hackathon("paging");
    for (let i = 0; i < 25; i++) {
      await team(h, `T${String(i).padStart(2, "0")}`, [(await createUser()).id]);
    }
    const p1 = await findOpenTeams(viewer.id, none);
    expect(p1.items).toHaveLength(24);
    expect(p1.hasMore).toBe(true);
    expect(p1.items[0].name).toBe("T24");
    const p2 = await findOpenTeams(viewer.id, { ...none, page: 2 });
    expect(p2.items.map((t) => t.name)).toEqual(["T00"]);
    expect(p2.hasMore).toBe(false);
  });
});
