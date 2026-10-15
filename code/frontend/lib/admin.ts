import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin-emails";

/** The signed-in admin, or null. Every admin page and action checks this itself. */
export async function getAdminUser(): Promise<{ id: string; email: string } | null> {
  const session = await auth();
  const id = session?.user?.id;
  const email = session?.user?.email;
  if (!id || !email || !isAdminEmail(email, process.env.ADMIN_EMAILS)) return null;
  return { id, email };
}
