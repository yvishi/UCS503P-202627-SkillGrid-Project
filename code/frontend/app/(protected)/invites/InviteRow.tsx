"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Pill, PrimaryButton, SecondaryButton } from "@/app/ui/primitives";
import type { RuleResult } from "@/lib/team-rules";
import type { InviteListRow } from "@/lib/teams";

import { cancelInviteAction, respondToInviteAction } from "./actions";

const STATUS_LABEL: Record<InviteListRow["status"], string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
};

const smallButton = "px-3 py-1.5 text-xs";

/**
 * One invite or request. `mode` decides the buttons: "respond" shows Accept and Decline,
 * "cancel" shows Cancel while the row is pending. `line` is the sentence describing the row.
 */
export function InviteRow({
  invite,
  line,
  mode,
}: {
  invite: InviteListRow;
  line: string;
  mode: "respond" | "cancel";
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function act(call: () => Promise<RuleResult>) {
    setError(null);
    startTransition(async () => {
      const res = await call();
      if (!res.ok) setError(res.error);
    });
  }

  const open = invite.status === "PENDING";

  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm text-ink">{line}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          <span className="font-medium text-ink">{invite.teamName}</span> in{" "}
          <Link href={`/hackathons/${invite.hackathonSlug}`} className="rounded-theme-sm hover:text-trust">
            {invite.hackathonName}
          </Link>
        </p>
        {error && (
          <p role="alert" className="mt-1 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!open && <Pill tone={invite.status === "ACCEPTED" ? "trust" : "neutral"}>{STATUS_LABEL[invite.status]}</Pill>}
        {open && mode === "respond" && (
          <>
            <PrimaryButton
              type="button"
              disabled={pending}
              className={smallButton}
              onClick={() => act(() => respondToInviteAction(invite.id, true))}
            >
              Accept
            </PrimaryButton>
            <SecondaryButton
              type="button"
              disabled={pending}
              className={smallButton}
              onClick={() => act(() => respondToInviteAction(invite.id, false))}
            >
              Decline
            </SecondaryButton>
          </>
        )}
        {open && mode === "cancel" && (
          <>
            <Pill>Pending</Pill>
            <SecondaryButton
              type="button"
              disabled={pending}
              className={smallButton}
              onClick={() => act(() => cancelInviteAction(invite.id))}
            >
              Cancel
            </SecondaryButton>
          </>
        )}
      </div>
    </li>
  );
}
