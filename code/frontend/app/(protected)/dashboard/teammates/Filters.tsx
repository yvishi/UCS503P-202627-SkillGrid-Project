import Link from "next/link";

import { PrimaryButton, secondaryButtonClass, buttonBase } from "@/app/ui/primitives";
import type { TeammateFilters } from "@/lib/discovery-core";
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_OPTIONS,
  INTEREST_TAGS,
  labelize,
} from "@/lib/onboarding-options";

const fieldClass =
  "w-full rounded-theme-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink";

// A plain GET form: every filter lives in the URL, so views can be linked.
// Skills are typed as catalog slugs (up to 3) rather than using the
// SkillPicker search, which is built around client-side state and actions.
export function Filters({
  filters,
  hackathons,
}: {
  filters: TeammateFilters;
  hackathons: { slug: string; name: string }[];
}) {
  const skillValues = [0, 1, 2].map((i) => filters.skills[i] ?? "");
  return (
    <form
      method="get"
      className="grid grid-cols-1 gap-4 rounded-theme-lg border border-border bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4"
    >
      <fieldset className="flex flex-col gap-2 sm:col-span-2 lg:col-span-4">
        <legend className="text-xs font-medium text-ink-muted">
          Skills (catalog slugs, such as react or python; a person must have all of them)
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {skillValues.map((value, i) => (
            <input
              key={i}
              type="text"
              name="skill"
              defaultValue={value}
              aria-label={`Skill ${i + 1}`}
              placeholder="Skill slug"
              maxLength={60}
              className={fieldClass}
            />
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted">
        Interest
        <select name="interest" defaultValue={filters.interest ?? ""} className={fieldClass}>
          <option value="">Any</option>
          {INTEREST_TAGS.map((t) => (
            <option key={t} value={t}>
              {labelize(t)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted">
        Availability
        <select name="availability" defaultValue={filters.availability ?? ""} className={fieldClass}>
          <option value="">Any</option>
          {AVAILABILITY_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {AVAILABILITY_LABELS[a]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted sm:col-span-2">
        Looking for a team at
        <select name="hackathon" defaultValue={filters.hackathon ?? ""} className={fieldClass}>
          <option value="">Any</option>
          {hackathons.map((h) => (
            <option key={h.slug} value={h.slug}>
              {h.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
        <PrimaryButton type="submit" className="px-4 py-2 text-xs">
          Apply filters
        </PrimaryButton>
        <Link
          href="/dashboard/teammates"
          className={`${buttonBase} ${secondaryButtonClass} px-4 py-2 text-xs`}
        >
          Clear
        </Link>
      </div>
    </form>
  );
}
