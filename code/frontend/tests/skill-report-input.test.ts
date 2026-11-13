import { describe, expect, it } from "vitest";

import { computeKeys } from "@/lib/skill-catalog-core";
import { parseReportInput } from "@/lib/skill-report-input";

describe("parseReportInput", () => {
  it("normalises the name and derives the lookup key", () => {
    expect(parseReportInput({ rawName: "  Svelte   Kit ", level: "ADVANCED", note: "  https://svelte.dev " })).toEqual({
      ok: true,
      value: { rawName: "Svelte Kit", key: "sveltekit", level: "ADVANCED", note: "https://svelte.dev" },
    });
  });

  it("gives a case/punctuation variant the same key as the catalog entry", () => {
    const parsed = parseReportInput({ rawName: "react.JS", level: "INTERMEDIATE" });
    expect(parsed.ok && computeKeys("react", "React", ["React.js"]).includes(parsed.value.key)).toBe(true);
  });

  it("treats a blank note as no note", () => {
    const parsed = parseReportInput({ rawName: "Svelte", level: "BEGINNER", note: "   " });
    expect(parsed.ok && parsed.value.note).toBeNull();
  });

  it.each([
    [{ rawName: "", level: "BEGINNER" }],
    [{ rawName: "https://x.dev", level: "BEGINNER" }],
    [{ rawName: "Svelte", level: "EXPERT" }],
    [{ rawName: "Svelte", level: "BEGINNER", note: "x".repeat(201) }],
  ])("rejects %j", (input) => {
    expect(parseReportInput(input).ok).toBe(false);
  });
});
