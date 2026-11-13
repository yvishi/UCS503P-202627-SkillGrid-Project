// Admins are listed in ADMIN_EMAILS (comma-separated) rather than a roles
// table -- a handful of maintainers, managed in the Vercel env settings.
export function isAdminEmail(email: string | null | undefined, list: string | undefined): boolean {
  if (!email || !list) return false;
  const admins = list
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}
