import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createHackathonAction } from "@/app/admin/hackathons/actions";
import { prisma } from "@/lib/prisma";
import { createUser, resetDb, signInAs } from "./helpers";

beforeEach(async () => {
  await resetDb();
  signInAs(null);
});
afterAll(async () => {
  await prisma.$disconnect();
});

function form(overrides: Record<string, string> = {}) {
  const fields = {
    name: "HackThapar 2026",
    slug: "",
    startsAt: "2026-11-14T09:00",
    endsAt: "2026-11-15T18:00",
    teamSizeMin: "2",
    teamSizeMax: "4",
    ...overrides,
  };
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("createHackathonAction", () => {
  it("lets an admin create a hackathon, read in IST", async () => {
    const admin = await createUser({ admin: true });
    signInAs(admin);
    expect(await createHackathonAction({}, form())).toEqual({ ok: true });
    const row = await prisma.hackathon.findUniqueOrThrow({ where: { slug: "hackthapar-2026" } });
    expect(row.name).toBe("HackThapar 2026");
    expect(row.createdById).toBe(admin.id);
    expect(row.startsAt.toISOString()).toBe("2026-11-14T03:30:00.000Z");
    expect([row.teamSizeMin, row.teamSizeMax]).toEqual([2, 4]);
  });

  it("rejects a duplicate name", async () => {
    signInAs(await createUser({ admin: true }));
    await createHackathonAction({}, form());
    expect(await createHackathonAction({}, form())).toEqual({ error: "A hackathon with that name already exists." });
    expect(await prisma.hackathon.count()).toBe(1);
  });

  it("refuses a non-admin and writes nothing", async () => {
    signInAs(await createUser());
    const res = await createHackathonAction({}, form());
    expect(res.error).toBeTruthy();
    expect(res.ok).toBeUndefined();
    expect(await prisma.hackathon.count()).toBe(0);
  });

  it("returns the parser error for invalid dates", async () => {
    signInAs(await createUser({ admin: true }));
    const res = await createHackathonAction({}, form({ endsAt: "2026-11-13T09:00" }));
    expect(res).toEqual({ error: "The end must be after the start." });
    expect(await prisma.hackathon.count()).toBe(0);
  });
});
