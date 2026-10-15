import type { Metadata } from "next";

import { Empty, Eyebrow } from "@/app/ui/primitives";
import { listReviewQueue } from "@/lib/skill-review";

import { ReviewGroupCard } from "./ReviewGroupCard";

export const metadata: Metadata = {
  title: "SkillGrid – Skill reports",
};

// Access is enforced by app/admin/layout.tsx (404 for non-admins) and
// re-checked in every action.
export default async function SkillRequestsPage() {
  const groups = await listReviewQueue();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header>
        <Eyebrow>Admin</Eyebrow>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">Skill reports</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {groups.length} {groups.length === 1 ? "skill" : "skills"} waiting for review. Approving or merging adds the
          skill to everyone who reported it.
        </p>
      </header>
      {groups.length === 0 ? (
        <Empty message="Nothing to review." />
      ) : (
        <ul className="flex flex-col gap-4">
          {groups.map((group) => (
            <li key={group.key}>
              <ReviewGroupCard group={group} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
