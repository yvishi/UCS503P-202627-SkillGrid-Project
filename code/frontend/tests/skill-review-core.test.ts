import { describe, expect, it } from "vitest";

import { groupRequests, parseApproval, pickDisplayName, type RequestRow } from "@/lib/skill-review-core";

const at = (day: number) => new Date(Date.UTC(2026, 9, day));

const ROWS: RequestRow[] = [
  { id: "1", userId: "u1", rawName: "SvelteKit", key: "sveltekit", note: "https://kit.svelte.dev", createdAt: at(3) },
  { id: "2", userId: "u2", rawName: "Svelte Kit", key: "sveltekit", note: null, createdAt: at(1) },
  { id: "3", userId: "u3", rawName: "SvelteKit", key: "sveltekit", note: null, createdAt: at(2) },
  { id: "4", userId: "u1", rawName: "Hono", key: "hono", note: null, createdAt: at(4) },
];

describe("groupRequests", () => {
  it("groups by key, most reporters first, spellings by frequency", () => {
    const [svelte, hono] = groupRequests(ROWS);
    expect(svelte).toMatchObject({
      key: "sveltekit",
      reporters: 3,
      spellings: [
        { rawName: "SvelteKit", count: 2 },
        { rawName: "Svelte Kit", count: 1 },
      ],
      notes: ["https://kit.svelte.dev"],
      oldest: at(1),
      requestIds: ["1", "2", "3"],
    });
    expect(hono.key).toBe("hono");
    expect(pickDisplayName(svelte)).toBe("SvelteKit");
  });
});

describe("parseApproval", () => {
  it("accepts a clean approval and splits aliases", () => {
    expect(
      parseApproval({ name: "SvelteKit", slug: "sveltekit", category: "FRAMEWORK", aliases: "Svelte Kit, , Kit", strictMatch: false }),
    ).toEqual({
      ok: true,
      value: { name: "SvelteKit", slug: "sveltekit", category: "FRAMEWORK", aliases: ["Svelte Kit", "Kit"], strictMatch: false },
    });
  });

  it.each([
    [{ name: "", slug: "x", category: "TOOL", aliases: "", strictMatch: false }],
    [{ name: "X", slug: "Bad Slug", category: "TOOL", aliases: "", strictMatch: false }],
    [{ name: "X", slug: "x", category: "NOPE", aliases: "", strictMatch: false }],
    [{ name: "X", slug: "x", category: "TOOL", aliases: "https://x.dev", strictMatch: false }],
  ])("rejects %j", (input) => {
    expect(parseApproval(input).ok).toBe(false);
  });
});
