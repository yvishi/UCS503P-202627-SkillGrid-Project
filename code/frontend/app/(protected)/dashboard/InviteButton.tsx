"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Pill, PrimaryButton, SecondaryButton } from "@/app/ui/primitives";
import { inviteChoice, type LeadTeamOption } from "@/lib/discovery-core";

import { inviteToTeamAction } from "../invites/actions";

const smallButton = "px-3 py-1.5 text-xs";
const selectClass =
  "min-w-0 flex-1 rounded-theme-md border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink";
const linkClass = "rounded-theme-sm text-ink underline-offset-2 hover:text-trust hover:underline";

/**
 * The Invite control on a teammate card. `teams` are the teams the viewer leads; `pendingTeamIds`
 * are the ones that already have an open invite or request with this person. With no team it
 * points to /hackathons, with one it invites straight away, with several it offers a select.
 */
export function InviteButton({
  userId,
  teams,
  pendingTeamIds,
}: {
  userId: string;
  teams: LeadTeamOption[];
  pendingTeamIds: string[];
}) {
  const [sent, setSent] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const choice = inviteChoice(teams, [...pendingTeamIds, ...sent]);

  function invite(team: LeadTeamOption) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await inviteToTeamAction(team.id, userId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSent((prev) => [...prev, team.id]);
      setSelected("");
      setNotice(`Invited to ${team.name}.`);
    });
  }

  const messages = (
    <>
      {notice && (
        <p role="status" className="text-xs text-ink-muted">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </>
  );

  if (choice.kind === "no-team") {
    return (
      <div className="flex flex-col gap-1">
        <SecondaryButton type="button" disabled className={`${smallButton} w-fit`}>
          Invite
        </SecondaryButton>
        <p className="text-xs text-ink-muted">
          Lead a team to invite people.{" "}
          <Link href="/hackathons" className={linkClass}>
            Browse hackathons
          </Link>
        </p>
      </div>
    );
  }

  if (choice.kind === "done") {
    return (
      <div className="flex flex-col gap-1">
        <span className="w-fit">
          <Pill tone="trust">Invited</Pill>
        </span>
        {messages}
      </div>
    );
  }

  if (choice.kind === "one") {
    return (
      <div className="flex flex-col gap-1">
        <PrimaryButton
          type="button"
          disabled={pending}
          className={`${smallButton} w-fit max-w-full`}
          onClick={() => invite(choice.team)}
        >
          <span className="truncate">Invite to {choice.team.name}</span>
        </PrimaryButton>
        {messages}
      </div>
    );
  }

  const team = choice.teams.find((t) => t.id === selected) ?? choice.teams[0];
  const selectId = `invite-team-${userId}`;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={selectId}>
          Team to invite to
        </label>
        <select
          id={selectId}
          value={team.id}
          onChange={(e) => setSelected(e.target.value)}
          disabled={pending}
          className={selectClass}
        >
          {choice.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.hackathonName})
            </option>
          ))}
        </select>
        <PrimaryButton type="button" disabled={pending} className={smallButton} onClick={() => invite(team)}>
          Invite
        </PrimaryButton>
      </div>
      {messages}
    </div>
  );
}
