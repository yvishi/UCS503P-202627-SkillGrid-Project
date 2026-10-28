import { prisma } from "@/lib/prisma";

export const ADMIN_EMAIL = "admin@thapar.edu";

type TestUser = { id: string; email: string };
const holder = globalThis as unknown as {
  __sgSession?: { user: TestUser } | null;
};

/** Empties every app table except the skills catalog, and drops skills created by admin approval. */
export async function resetDb(): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN ('skills', '_prisma_migrations')`;
  if (rows.length > 0) {
    const list = rows.map((r) => `"${r.tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
  await prisma.skill.deleteMany({ where: { origin: "REQUESTED" } });
}

let counter = 0;

export async function createUser(
  opts: { email?: string; onboarded?: boolean; admin?: boolean } = {},
): Promise<TestUser> {
  counter += 1;
  const email = opts.email ?? (opts.admin ? ADMIN_EMAIL : `user${counter}-${Date.now()}@thapar.edu`);
  const user = await prisma.user.create({
    data: {
      email,
      name: email.split("@")[0],
      ...(opts.onboarded ? { profile: { create: { onboardingCompletedAt: new Date() } } } : {}),
    },
    select: { id: true, email: true },
  });
  return { id: user.id, email: user.email! };
}

/** Sets what the mocked auth() returns. null means signed out. */
export function signInAs(user: TestUser | null): void {
  holder.__sgSession = user ? { user: { id: user.id, email: user.email } } : null;
}
