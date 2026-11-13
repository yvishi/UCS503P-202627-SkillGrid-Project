import Link from "next/link";

import { auth, signOut } from "@/auth";
import { Avatar } from "@/app/ui/Avatar";
import { SecondaryButton } from "@/app/ui/primitives";
import { ThemeToggle } from "@/app/ui/ThemeToggle";
import { countPendingForUser } from "@/lib/teams";

import { NavLinks } from "./NavLinks";

// 2x2 cell mark: three levels of evidence plus one empty cell, the grid
// in miniature.
function CellMark() {
  return (
    <span aria-hidden="true" className="grid grid-cols-2 gap-[2px]">
      <span className="h-[7px] w-[7px] rounded-[2px] bg-cell-4" />
      <span className="h-[7px] w-[7px] rounded-[2px] bg-cell-2" />
      <span className="h-[7px] w-[7px] rounded-[2px] bg-cell-3" />
      <span className="h-[7px] w-[7px] rounded-[2px] bg-cell-0" />
    </span>
  );
}

export async function NavBar() {
  const session = await auth();
  const user = session?.user;
  const displayName = user?.name ?? user?.email ?? "You";
  const pendingInvites = user?.id ? await countPendingForUser(user.id) : 0;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-theme-sm text-ink"
            aria-label="SkillGrid, go to dashboard"
          >
            <CellMark />
            <span className="font-display text-base font-bold tracking-tight">SkillGrid</span>
          </Link>
          <NavLinks className="hidden sm:block" pendingInvites={pendingInvites} />
        </div>

        {user && (
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Avatar name={displayName} image={user.image ?? null} size="h-8 w-8 text-xs" />
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <SecondaryButton type="submit" className="px-3 py-1.5 text-xs">
                Sign out
              </SecondaryButton>
            </form>
          </div>
        )}
      </div>

      {/* Mobile: links get their own row so nothing has to squeeze at 375px. */}
      <div className="border-t border-border px-2 py-1 sm:hidden">
        <NavLinks pendingInvites={pendingInvites} />
      </div>
    </header>
  );
}
