import { auth, signIn, signOut } from "@/auth";

export default async function Home({
  searchParams,
}: PageProps<"/">) {
  const session = await auth();
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">SkillGrid</h1>
        <p className="max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
          Trust through evidence, not self-report.
        </p>
      </div>

      {error === "AccessDenied" && (
        <p className="max-w-sm rounded-md bg-red-50 px-4 py-2 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Sign-in is restricted to college email accounts. Please use your
          college Google account.
        </p>
      )}

      {session?.user ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-neutral-200 bg-neutral-50 px-8 py-6 dark:border-neutral-800 dark:bg-neutral-900">
          {session.user.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt={session.user.name ?? "Profile picture"}
              className="h-16 w-16 rounded-full"
            />
          )}
          <p className="text-sm font-medium">
            Signed in as {session.user.name ?? session.user.email}
          </p>
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <form
          action={async () => {
            "use server";
            await signIn("google");
          }}
        >
          <button
            type="submit"
            className="flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium text-neutral-900 shadow-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.89c2.27-2.09 3.58-5.17 3.58-8.82Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.89-3c-1.08.73-2.46 1.16-4.06 1.16-3.12 0-5.77-2.11-6.71-4.94H1.28v3.1A12 12 0 0 0 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.29 14.31A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.58.38-2.31v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.41l4.01-3.1Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.59l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75Z"
              />
            </svg>
            Sign in with college Google account
          </button>
        </form>
      )}
    </main>
  );
}
