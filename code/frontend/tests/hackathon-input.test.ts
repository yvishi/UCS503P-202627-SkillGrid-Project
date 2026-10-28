import { describe, expect, it } from "vitest";
import { parseHackathonInput } from "@/lib/hackathon-input";

const form = {
  name: "Smart India Hackathon",
  startsAt: "2026-11-01T09:00",
  endsAt: "2026-11-03T18:00",
  teamSizeMin: "2",
  teamSizeMax: "4",
};

describe("parseHackathonInput", () => {
  it("parses a valid form and derives the slug", () => {
    const r = parseHackathonInput(form);
    expect(r).toMatchObject({
      ok: true,
      value: { name: "Smart India Hackathon", slug: "smart-india-hackathon", teamSizeMin: 2, teamSizeMax: 4 },
    });
    if (r.ok) {
      expect(r.value.startsAt).toBeInstanceOf(Date);
      expect(r.value.endsAt.getTime()).toBeGreaterThan(r.value.startsAt.getTime());
    }
  });
  it("uses a given slug", () => {
    const r = parseHackathonInput({ ...form, slug: "  sih-26 " });
    expect(r.ok && r.value.slug).toBe("sih-26");
  });
  it("reads a value with no offset as IST", () => {
    const r = parseHackathonInput({ ...form, startsAt: "2026-11-01T10:00", endsAt: "2026-11-01T12:00:30" });
    expect(r.ok && r.value.startsAt.toISOString()).toBe("2026-11-01T04:30:00.000Z");
    expect(r.ok && r.value.endsAt.toISOString()).toBe("2026-11-01T06:30:30.000Z");
  });
  it("leaves a value with Z or an explicit offset unchanged", () => {
    const r = parseHackathonInput({ ...form, startsAt: "2026-11-01T10:00:00Z", endsAt: "2026-11-01T18:00:00+01:00" });
    expect(r.ok && r.value.startsAt.toISOString()).toBe("2026-11-01T10:00:00.000Z");
    expect(r.ok && r.value.endsAt.toISOString()).toBe("2026-11-01T17:00:00.000Z");
  });
  it("rejects short and long names", () => {
    const err = { ok: false, error: "The name must be 3 to 80 characters." };
    expect(parseHackathonInput({ ...form, name: "ab" })).toEqual(err);
    expect(parseHackathonInput({ ...form, name: "x".repeat(81) })).toEqual(err);
  });
  it("rejects a name that gives an empty slug", () => {
    expect(parseHackathonInput({ ...form, name: "!!!" })).toEqual({
      ok: false,
      error: "Enter a slug using letters and numbers.",
    });
  });
  it("rejects invalid dates", () => {
    expect(parseHackathonInput({ ...form, startsAt: "" })).toEqual({ ok: false, error: "Enter a valid start date." });
    expect(parseHackathonInput({ ...form, endsAt: "nope" })).toEqual({ ok: false, error: "Enter a valid end date." });
  });
  it("rejects end before start, and equal", () => {
    const err = { ok: false, error: "The end must be after the start." };
    expect(parseHackathonInput({ ...form, endsAt: "2026-10-31T09:00" })).toEqual(err);
    expect(parseHackathonInput({ ...form, endsAt: form.startsAt })).toEqual(err);
  });
  it("rejects min greater than max", () => {
    expect(parseHackathonInput({ ...form, teamSizeMin: "5", teamSizeMax: "3" })).toEqual({
      ok: false,
      error: "The minimum team size can't be more than the maximum.",
    });
  });
  it("rejects sizes outside 1 to 8 or not whole numbers", () => {
    const err = { ok: false, error: "Team sizes must be whole numbers from 1 to 8." };
    expect(parseHackathonInput({ ...form, teamSizeMin: "0" })).toEqual(err);
    expect(parseHackathonInput({ ...form, teamSizeMax: "9" })).toEqual(err);
    expect(parseHackathonInput({ ...form, teamSizeMax: "2.5" })).toEqual(err);
    expect(parseHackathonInput({ ...form, teamSizeMin: "" })).toEqual(err);
  });
});
