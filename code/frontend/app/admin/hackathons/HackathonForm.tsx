"use client";

import { useActionState } from "react";

import { PrimaryButton } from "@/app/ui/primitives";

import { createHackathonAction, type HackathonFormState } from "./actions";

const inputClass =
  "rounded-theme-sm border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/25";

export function HackathonForm() {
  const [state, action, pending] = useActionState<HackathonFormState, FormData>(createHackathonAction, {});

  return (
    <form action={action} className="flex flex-col gap-3 rounded-theme-lg border border-border bg-surface p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-2">
          Name
          <input name="name" className={inputClass} required minLength={3} maxLength={80} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-2">
          Slug (optional, taken from the name)
          <input name="slug" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Starts (IST)
          <input type="datetime-local" name="startsAt" className={inputClass} required />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Ends (IST)
          <input type="datetime-local" name="endsAt" className={inputClass} required />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Smallest team
          <input type="number" name="teamSizeMin" defaultValue={2} min={1} max={8} className={inputClass} required />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Largest team
          <input type="number" name="teamSizeMax" defaultValue={4} min={1} max={8} className={inputClass} required />
        </label>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-trust-strong">
          Hackathon created.
        </p>
      )}
      <PrimaryButton type="submit" disabled={pending} className="self-start">
        {pending ? "Creating…" : "Create hackathon"}
      </PrimaryButton>
    </form>
  );
}
