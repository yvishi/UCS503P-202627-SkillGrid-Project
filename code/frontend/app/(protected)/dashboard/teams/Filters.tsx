import Link from "next/link";

import { PrimaryButton, secondaryButtonClass, buttonBase } from "@/app/ui/primitives";
import type { TeamFilters } from "@/lib/discovery-core";

const fieldClass =
  "w-full rounded-theme-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink";

// A plain GET form, like the teammates one: every filter lives in the URL.
export function Filters({
  filters,
  hackathons,
}: {
  filters: TeamFilters;
  hackathons: { slug: string; name: string }[];
}) {
  return (
    <form
      method="get"
      className="grid grid-cols-1 gap-4 rounded-theme-lg border border-border bg-surface p-5 sm:grid-cols-2"
    >
      <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted">
        Hackathon
        <select name="hackathon" defaultValue={filters.hackathon ?? ""} className={fieldClass}>
          <option value="">Any</option>
          {hackathons.map((h) => (
            <option key={h.slug} value={h.slug}>
              {h.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted">
        Looking for (catalog slug, such as react or python)
        <input
          type="text"
          name="skill"
          defaultValue={filters.skill ?? ""}
          placeholder="Skill slug"
          maxLength={60}
          className={fieldClass}
        />
      </label>

      <div className="flex gap-2 sm:col-span-2">
        <PrimaryButton type="submit" className="px-4 py-2 text-xs">
          Apply filters
        </PrimaryButton>
        <Link href="/dashboard/teams" className={`${buttonBase} ${secondaryButtonClass} px-4 py-2 text-xs`}>
          Clear
        </Link>
      </div>
    </form>
  );
}
