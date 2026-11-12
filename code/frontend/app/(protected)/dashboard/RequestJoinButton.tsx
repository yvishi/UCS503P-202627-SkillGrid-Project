"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Pill, PrimaryButton } from "@/app/ui/primitives";
import type { JoinState } from "@/lib/discovery-core";

import { requestToJoinAction } from "../invites/actions";

const linkClass = "rounded-theme-sm text-ink underline-offset-2 hover:text-trust hover:underline";

/**
 * The Request to join control on a team card. `state` comes from the server (see joinState):
 * "requested" when the viewer already asked, "invited" when the team already invited them,
 * "in-hackathon" when they already have a team in this hackathon, so a request would be refused.
 */
export function RequestJoinButton({ teamId, state }: { teamId: string; state: JoinState }) {
  const [requested, setRequested] = useState(state === "requested");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function request() {
    setError(null);
    startTransition(async () => {
      const res = await requestToJoinAction(teamId);
      if (res.ok) setRequested(true);
      else setError(res.error);
    });
  }

  if (state === "in-hackathon") {
    return <p className="text-xs text-ink-muted">You&apos;re already in a team for this hackathon.</p>;
  }

  if (state === "invited") {
    return (
      <p className="text-xs text-ink-muted">
        This team invited you.{" "}
        <Link href="/invites" className={linkClass}>
          Answer in invites
        </Link>
      </p>
    );
  }

  if (requested) {
    return (
      <span className="w-fit">
        <Pill tone="trust">Requested</Pill>
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <PrimaryButton type="button" disabled={pending} className="w-fit px-3 py-1.5 text-xs" onClick={request}>
        Request to join
      </PrimaryButton>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
