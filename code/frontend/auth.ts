import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";

// Only accounts on the college's Google Workspace domain may sign in.
// GitHub is intentionally NOT an auth provider here — it's connected
// later, per-user, as an evidence source (see feature/github-evidence).
const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: {
    // database sessions (not JWT) so PrismaAdapter's Session table is
    // the source of truth, matching the schema in prisma/schema.prisma
    strategy: "database",
  },
  callbacks: {
    async signIn({ user }) {
      if (!ALLOWED_EMAIL_DOMAIN) return true; // not configured, allow all (dev)
      return Boolean(user.email?.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`));
    },
  },
  // Vercel preview deployments get a new URL per deploy; without this,
  // Auth.js rejects the request host as untrusted.
  trustHost: true,
});
