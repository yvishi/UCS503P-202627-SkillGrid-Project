"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/admin";
import { syncAndRevalidate } from "@/lib/hackathon-feeds";
import { SOURCE_LABEL, isFeedSource } from "@/lib/hackathon-feeds-core";
import { parseHackathonInput } from "@/lib/hackathon-input";
import { prisma } from "@/lib/prisma";
import { isUniqueViolation } from "@/lib/skill-catalog";

export type HackathonFormState = { error?: string; ok?: boolean };

const FIELDS = ["name", "slug", "startsAt", "endsAt", "teamSizeMin", "teamSizeMax"] as const;

export async function createHackathonAction(_prev: HackathonFormState, form: FormData): Promise<HackathonFormState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not allowed." };

  const raw: Record<string, string> = {};
  for (const key of FIELDS) raw[key] = String(form.get(key) ?? "");
  const parsed = parseHackathonInput(raw);
  if (!parsed.ok) return { error: parsed.error };

  try {
    await prisma.hackathon.create({ data: { ...parsed.value, createdById: admin.id } });
  } catch (err) {
    if (isUniqueViolation(err)) return { error: "A hackathon with that name already exists." };
    throw err;
  }
  revalidatePath("/admin/hackathons");
  revalidatePath("/hackathons");
  return { ok: true };
}

export type SyncState = { message?: string; error?: string };

export async function syncHackathonsAction(): Promise<SyncState> {
  if (!(await getAdminUser())) return { error: "Not allowed." };
  const { sources } = await syncAndRevalidate();
  const parts = sources.map((s) =>
    s.error
      ? `${SOURCE_LABEL[s.source]}: failed (${s.error})`
      : `${SOURCE_LABEL[s.source]}: ${s.created} new, ${s.updated} updated`,
  );
  const failed = sources.filter((s) => s.error).length;
  return failed === sources.length ? { error: parts.join(" · ") } : { message: parts.join(" · ") };
}

const VISIBILITIES = ["PUBLISHED", "PENDING", "HIDDEN"] as const;

/** Publishes, hides or restores one hackathon. A bound form action: no state returned. */
export async function setVisibilityAction(form: FormData): Promise<void> {
  if (!(await getAdminUser())) return;
  const id = String(form.get("id") ?? "");
  const visibility = String(form.get("visibility") ?? "");
  if (!id || !(VISIBILITIES as readonly string[]).includes(visibility)) return;
  await prisma.hackathon.updateMany({
    where: { id },
    data: { visibility: visibility as (typeof VISIBILITIES)[number] },
  });
  for (const path of ["/admin/hackathons", "/hackathons", "/dashboard/teams", "/dashboard/teammates", "/teams"]) {
    revalidatePath(path);
  }
}

/** Publishes every pending hackathon from one source (or all sources) at once. */
export async function publishAllPendingAction(form: FormData): Promise<void> {
  if (!(await getAdminUser())) return;
  const source = String(form.get("source") ?? "");
  await prisma.hackathon.updateMany({
    where: { visibility: "PENDING", ...(isFeedSource(source) ? { source } : {}) },
    data: { visibility: "PUBLISHED" },
  });
  for (const path of ["/admin/hackathons", "/hackathons", "/dashboard/teams", "/dashboard/teammates", "/teams"]) {
    revalidatePath(path);
  }
}
