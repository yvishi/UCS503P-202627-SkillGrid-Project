import type { Metadata } from "next";

import { auth } from "@/auth";
import { Empty, Eyebrow, SectionCard } from "@/app/ui/primitives";
import { listInvitesForUser, type InviteListRow } from "@/lib/teams";

import { InviteRow } from "./InviteRow";

export const metadata: Metadata = {
  title: "SkillGrid – Invites",
};

function sentLine(row: InviteListRow): string {
  return row.kind === "INVITE"
    ? `You invited ${row.otherName} to join.`
    : `You asked to join. ${row.otherName} leads this team.`;
}

function Section({
  title,
  empty,
  rows,
  line,
  mode,
}: {
  title: string;
  empty: string;
  rows: InviteListRow[];
  line: (row: InviteListRow) => string;
  mode: "respond" | "cancel";
}) {
  return (
    <SectionCard
      title={title}
      action={rows.length > 0 ? <span className="font-mono text-xs text-ink-muted">{rows.length}</span> : undefined}
    >
      {rows.length === 0 ? (
        <Empty message={empty} />
      ) : (
        <ul className="-my-3 flex flex-col">
          {rows.map((row) => (
            <InviteRow key={row.id} invite={row} line={line(row)} mode={mode} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export default async function InvitesPage() {
  // The (protected) layout guarantees a signed-in, onboarded user.
  const userId = (await auth())!.user!.id!;
  const { toMe, toMyTeams, sent } = await listInvitesForUser(userId);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header>
        <Eyebrow>Teams</Eyebrow>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Invites</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">
          Answer invitations to join a team, and requests to join the teams you lead.
        </p>
      </header>

      <Section
        title="Invitations to you"
        empty="No one has invited you to a team yet."
        rows={toMe}
        line={(row) => `${row.otherName} invited you to join.`}
        mode="respond"
      />
      <Section
        title="Requests to your teams"
        empty="No one has asked to join your teams."
        rows={toMyTeams}
        line={(row) => `${row.otherName} asked to join.`}
        mode="respond"
      />
      <Section
        title="Sent by you"
        empty="You haven't sent any invites or requests."
        rows={sent}
        line={sentLine}
        mode="cancel"
      />
    </main>
  );
}
