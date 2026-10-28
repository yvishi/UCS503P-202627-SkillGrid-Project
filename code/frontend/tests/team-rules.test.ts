import { describe, expect, it } from "vitest";
import { canAccept, canCreateTeam, canInvite, canRequest, nextLead } from "@/lib/team-rules";

const now = new Date("2026-11-01T10:00:00Z");
const future = new Date("2026-12-01T10:00:00Z");
const past = new Date("2026-10-01T10:00:00Z");
const team = { size: 2, max: 4, endsAt: future };
const ENDED = { ok: false, error: "This hackathon has ended." };
const IN_TEAM = { ok: false, error: "You're already in a team for this hackathon." };
const FULL = { ok: false, error: "This team is full." };

describe("canCreateTeam", () => {
  it("allows a free user before the end", () => {
    expect(canCreateTeam({ now, endsAt: future, alreadyInTeam: false })).toEqual({ ok: true });
  });
  it("rejects at or after the end", () => {
    expect(canCreateTeam({ now, endsAt: now, alreadyInTeam: false })).toEqual(ENDED);
    expect(canCreateTeam({ now, endsAt: past, alreadyInTeam: false })).toEqual(ENDED);
  });
  it("rejects a user already in a team", () => {
    expect(canCreateTeam({ now, endsAt: future, alreadyInTeam: true })).toEqual(IN_TEAM);
  });
  it("reports ended before already-in-team", () => {
    expect(canCreateTeam({ now, endsAt: past, alreadyInTeam: true })).toEqual(ENDED);
  });
});

describe("canInvite", () => {
  const base = { now, team, actorIsLead: true, targetInTeam: false, pendingExists: false, targetIsSelf: false };
  it("allows a lead to invite a free user", () => {
    expect(canInvite(base)).toEqual({ ok: true });
  });
  it("rejects after the end", () => {
    expect(canInvite({ ...base, team: { ...team, endsAt: now } })).toEqual(ENDED);
  });
  it("rejects a non-lead", () => {
    expect(canInvite({ ...base, actorIsLead: false })).toEqual({
      ok: false,
      error: "Only the team lead can invite people.",
    });
  });
  it("rejects inviting yourself", () => {
    expect(canInvite({ ...base, targetIsSelf: true })).toEqual({ ok: false, error: "You can't invite yourself." });
  });
  it("rejects a target already in a team", () => {
    expect(canInvite({ ...base, targetInTeam: true })).toEqual({
      ok: false,
      error: "That person is already in a team for this hackathon.",
    });
  });
  it("rejects a full team", () => {
    expect(canInvite({ ...base, team: { ...team, size: 4 } })).toEqual(FULL);
  });
  it("rejects a duplicate pending invite", () => {
    expect(canInvite({ ...base, pendingExists: true })).toEqual({
      ok: false,
      error: "There is already a pending invite for that person.",
    });
  });
  it("checks ended, permission, self, membership, full, pending in that order", () => {
    const open = { size: 4, max: 4, endsAt: future };
    const all = {
      now,
      team: { ...open, endsAt: past },
      actorIsLead: false,
      targetIsSelf: true,
      targetInTeam: true,
      pendingExists: true,
    };
    expect(canInvite(all)).toEqual(ENDED);
    const a = { ...all, team: open };
    expect(canInvite(a)).toEqual({ ok: false, error: "Only the team lead can invite people." });
    const b = { ...a, actorIsLead: true };
    expect(canInvite(b)).toEqual({ ok: false, error: "You can't invite yourself." });
    const c = { ...b, targetIsSelf: false };
    expect(canInvite(c)).toEqual({ ok: false, error: "That person is already in a team for this hackathon." });
    const d = { ...c, targetInTeam: false };
    expect(canInvite(d)).toEqual(FULL);
    expect(canInvite({ ...d, team: { ...open, size: 3 } })).toEqual({
      ok: false,
      error: "There is already a pending invite for that person.",
    });
  });
});

describe("canRequest", () => {
  const base = { now, team, alreadyInTeam: false, pendingExists: false };
  it("allows a free user", () => {
    expect(canRequest(base)).toEqual({ ok: true });
  });
  it("rejects after the end", () => {
    expect(canRequest({ ...base, team: { ...team, endsAt: past } })).toEqual(ENDED);
  });
  it("rejects a user already in a team", () => {
    expect(canRequest({ ...base, alreadyInTeam: true })).toEqual(IN_TEAM);
  });
  it("rejects a full team", () => {
    expect(canRequest({ ...base, team: { ...team, size: 4 } })).toEqual(FULL);
  });
  it("rejects a duplicate pending request", () => {
    expect(canRequest({ ...base, pendingExists: true })).toEqual({
      ok: false,
      error: "You already have a pending request to this team.",
    });
  });
});

describe("canAccept", () => {
  const base = { now, team, joinerInTeam: false, actorMayRespond: true };
  it("allows a valid accept", () => {
    expect(canAccept(base)).toEqual({ ok: true });
  });
  it("rejects after the end", () => {
    expect(canAccept({ ...base, team: { ...team, endsAt: now } })).toEqual(ENDED);
  });
  it("rejects an actor who may not respond", () => {
    expect(canAccept({ ...base, actorMayRespond: false })).toEqual({
      ok: false,
      error: "You can't respond to this one.",
    });
  });
  it("rejects a joiner already in a team", () => {
    expect(canAccept({ ...base, joinerInTeam: true })).toEqual(IN_TEAM);
  });
  it("rejects a full team", () => {
    expect(canAccept({ ...base, team: { ...team, size: 4 } })).toEqual(FULL);
  });
  it("reports already-in-team before full", () => {
    expect(canAccept({ ...base, joinerInTeam: true, team: { ...team, size: 4 } })).toEqual(IN_TEAM);
  });
});

describe("nextLead", () => {
  const m = (userId: string, role: "LEAD" | "MEMBER", day: number) => ({
    userId,
    role,
    joinedAt: new Date(2026, 9, day),
  });
  it("hands over to the earliest-joined remaining member", () => {
    expect(nextLead([m("A", "LEAD", 1), m("C", "MEMBER", 3), m("B", "MEMBER", 2)], "A")).toBe("B");
  });
  it("returns null when nobody remains", () => {
    expect(nextLead([m("A", "LEAD", 1)], "A")).toBeNull();
  });
  it("keeps the current lead when a plain member leaves", () => {
    expect(nextLead([m("A", "LEAD", 1), m("B", "MEMBER", 2)], "B")).toBe("A");
  });
});
