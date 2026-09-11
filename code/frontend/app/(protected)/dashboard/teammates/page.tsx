import type { Metadata } from "next";
import Link from "next/link";

import { TEAMMATE_FIXTURES } from "@/lib/dashboard-fixtures";
import { Eyebrow } from "@/app/ui/primitives";
import { TeammateCard } from "../MatchCards";

export const metadata: Metadata = {
  title: "SkillGrid – Find Teammates",
};

export default function TeammatesPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <Link
          href="/dashboard"
          className="font-display text-sm font-medium text-ink-muted transition hover:text-trust"
        >
          ← Dashboard
        </Link>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <Eyebrow>People</Eyebrow>
            <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight">
              Find teammates
            </h1>
          </div>
          <span className="text-xs text-ink-muted">Sample listing</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {TEAMMATE_FIXTURES.map((teammate) => (
          <TeammateCard key={teammate.id} teammate={teammate} />
        ))}
      </div>
    </main>
  );
}
