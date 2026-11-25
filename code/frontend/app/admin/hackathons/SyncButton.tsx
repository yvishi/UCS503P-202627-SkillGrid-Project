"use client";

import { useActionState } from "react";

import { SecondaryButton } from "@/app/ui/primitives";

import { syncHackathonsAction, type SyncState } from "./actions";

export function SyncButton() {
  const [state, action, pending] = useActionState<SyncState, FormData>(syncHackathonsAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <SecondaryButton type="submit" disabled={pending} className="self-start">
        {pending ? "Fetching Devfolio, Unstop and Devpost…" : "Sync now"}
      </SecondaryButton>
      {state.message && (
        <p role="status" className="text-sm text-trust-strong">
          {state.message}
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
