import { vi } from "vitest";

// Safety guard: these tests TRUNCATE tables, so refuse to run unless the
// database name says "test". This keeps them away from Neon production.
const url = process.env.DATABASE_URL ?? "";
let dbName = "";
try {
  dbName = new URL(url).pathname.replace(/^\//, "");
} catch {
  // fall through to the refusal below
}
if (!dbName.toLowerCase().includes("test")) {
  throw new Error(
    `Refusing to run integration tests: DATABASE_URL database "${dbName}" must contain "test".`,
  );
}

process.env.ADMIN_EMAILS = "admin@thapar.edu";

// Current mocked session, set through signInAs() in helpers.ts.
type TestSession = { user: { id: string; email: string } } | null;
const holder = globalThis as unknown as { __sgSession?: TestSession };
holder.__sgSession = null;

vi.mock("@/auth", () => ({
  auth: async () => holder.__sgSession ?? null,
}));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));
