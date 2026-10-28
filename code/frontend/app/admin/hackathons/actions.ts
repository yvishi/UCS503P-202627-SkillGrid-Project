"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/admin";
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
