"use client";

import { useActionState, useState } from "react";

import {
  AVAILABILITY_OPTIONS,
  COMFORT_LEVELS,
  INTEREST_TAGS,
  labelize,
} from "@/lib/onboarding-options";

import { completeOnboardingPathA, completeOnboardingPathB } from "./actions";

type Path = "A" | "B" | null;

const cardBase =
  "rounded-lg border p-4 text-left transition border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900";
const cardSelected =
  "rounded-lg border p-4 text-left transition border-neutral-900 bg-neutral-50 dark:border-white dark:bg-neutral-900";
const fieldClass =
  "mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const submitClass =
  "rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900";

const ALLOWED_RESUME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export function OnboardingForm() {
  const [path, setPath] = useState<Path>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [stateA, formActionA] = useActionState(completeOnboardingPathA, null);
  const [stateB, formActionB] = useActionState(completeOnboardingPathB, null);
  const [clientFileError, setClientFileError] = useState<string | null>(null);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function handleResumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setClientFileError(null);
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      setClientFileError("Resume must be 5MB or smaller.");
    } else if (!ALLOWED_RESUME_TYPES.includes(file.type)) {
      setClientFileError("Resume must be a PDF or DOCX file.");
    } else {
      setClientFileError(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Set up your profile
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          How do you want to build it?
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setPath("A")}
          className={path === "A" ? cardSelected : cardBase}
        >
          <p className="font-medium">I have a resume or GitHub</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Build your profile from real evidence.
          </p>
        </button>
        <button
          type="button"
          onClick={() => setPath("B")}
          className={path === "B" ? cardSelected : cardBase}
        >
          <p className="font-medium">I&apos;ll set it up manually</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Tell us a bit about yourself instead.
          </p>
        </button>
      </div>

      {path === "A" && (
        <form
          action={formActionA}
          className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
        >
          <div>
            <label htmlFor="resume" className="text-sm font-medium">
              Resume (PDF or DOCX, max 5MB)
            </label>
            <input
              id="resume"
              name="resume"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              required
              onChange={handleResumeChange}
              className="mt-1 block w-full text-sm"
            />
          </div>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="flex items-center justify-center gap-2 rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-400 dark:border-neutral-700"
          >
            Connect GitHub (coming soon)
          </button>
          {clientFileError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {clientFileError}
            </p>
          )}
          {stateA?.error && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {stateA.error}
            </p>
          )}
          <button type="submit" className={submitClass}>
            Continue
          </button>
        </form>
      )}

      {path === "B" && (
        <form
          action={formActionB}
          className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
        >
          <div>
            <label htmlFor="comfortLevel" className="text-sm font-medium">
              Comfort level
            </label>
            <select
              id="comfortLevel"
              name="comfortLevel"
              required
              defaultValue=""
              className={fieldClass}
            >
              <option value="" disabled>
                Select one
              </option>
              {COMFORT_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {labelize(level)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="text-sm font-medium">Interests</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {INTEREST_TAGS.map((tag) => (
                <label
                  key={tag}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition ${
                    selectedTags.includes(tag)
                      ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                      : "border-neutral-300 dark:border-neutral-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="interestTags"
                    value={tag}
                    checked={selectedTags.includes(tag)}
                    onChange={() => toggleTag(tag)}
                    className="hidden"
                  />
                  {tag}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="availability" className="text-sm font-medium">
              Availability
            </label>
            <select
              id="availability"
              name="availability"
              required
              defaultValue=""
              className={fieldClass}
            >
              <option value="" disabled>
                Select one
              </option>
              {AVAILABILITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {labelize(option)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">
              Project links (optional, up to 3)
            </span>
            <input name="projectLink1" type="url" placeholder="https://..." className={fieldClass} />
            <input name="projectLink2" type="url" placeholder="https://..." className={fieldClass} />
            <input name="projectLink3" type="url" placeholder="https://..." className={fieldClass} />
          </div>

          {stateB?.error && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {stateB.error}
            </p>
          )}
          <button type="submit" className={submitClass}>
            Continue
          </button>
        </form>
      )}
    </div>
  );
}
