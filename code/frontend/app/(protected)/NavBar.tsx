import Link from "next/link";

import { auth, signOut } from "@/auth";
import { Avatar } from "@/app/ui/Avatar";
import { SecondaryButton } from "@/app/ui/primitives";

export async function NavBar() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-display text-sm font-bold tracking-tight">
            SkillGrid
          </Link>
          <nav className="font-display flex items-center gap-5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
            <Link href="/dashboard" className="transition hover:text-ink">
              Dashboard
            </Link>
            <Link href="/profile" className="transition hover:text-ink">
              Profile
            </Link>
          </nav>
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <Avatar
              name={user.name ?? user.email ?? "You"}
              image={user.image ?? null}
              size="h-8 w-8 text-xs"
            />
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <SecondaryButton
                type="submit"
                className="px-3 py-1.5 text-xs"
              >
                Sign out
              </SecondaryButton>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
