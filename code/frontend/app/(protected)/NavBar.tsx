import Link from "next/link";

import { auth, signOut } from "@/auth";

import { Avatar } from "./Avatar";

export async function NavBar() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            SkillGrid
          </Link>
          <nav className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
            <Link
              href="/dashboard"
              className="transition hover:text-neutral-900 dark:hover:text-white"
            >
              Dashboard
            </Link>
            <Link
              href="/profile"
              className="transition hover:text-neutral-900 dark:hover:text-white"
            >
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
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
