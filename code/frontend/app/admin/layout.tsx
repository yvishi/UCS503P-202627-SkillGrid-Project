import { notFound } from "next/navigation";

import { getAdminUser } from "@/lib/admin";

// Admin pages 404 for everyone not in ADMIN_EMAILS -- not a redirect, so
// the route's existence isn't advertised.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await getAdminUser())) notFound();
  return <div className="bg-graph flex min-h-full flex-1 flex-col">{children}</div>;
}
