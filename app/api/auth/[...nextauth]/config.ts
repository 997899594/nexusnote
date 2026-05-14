/**
 * Auth.js v5 Configuration
 *
 * Providers:
 * - Resend (Magic Link) - production by default
 * - GitHub OAuth - optional
 * - Credentials - non-production by default
 */

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { NextAuthConfig, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Resend from "next-auth/providers/resend";
import { db, eq, users } from "@/db";
import { accounts, sessions, verificationTokens } from "@/db/schema";
import { getAuthProviderFlags } from "@/lib/auth/provider-flags";

const { isDevLoginEnabled, isResendLoginEnabled, isGithubLoginEnabled } = getAuthProviderFlags();
const sessionStrategy = isDevLoginEnabled ? "jwt" : "database";

function applyUserToToken(token: JWT, user: User): JWT {
  token.sub = user.id;
  token.email = user.email;
  token.name = user.name;
  token.picture = user.image;
  return token;
}

export const authConfig = {
  trustHost: true,

  // Only initialize adapter when db is available (runtime)
  // Build phase with no DATABASE_URL: db is null, skip adapter
  ...(db
    ? {
        adapter: DrizzleAdapter(db, {
          usersTable: users,
          accountsTable: accounts,
          sessionsTable: sessions,
          verificationTokensTable: verificationTokens,
        }),
      }
    : {}),

  session: {
    // Auth.js credentials provider is intentionally JWT-only. Production email/OAuth keeps
    // database sessions; non-production direct login uses JWT to avoid Resend/domain setup.
    strategy: sessionStrategy,
    maxAge: 30 * 24 * 60 * 60,
  },

  pages: {
    signIn: "/login",
    verifyRequest: "/login?verify=1",
  },

  providers: [
    ...(isResendLoginEnabled
      ? [
          Resend({
            apiKey: process.env.RESEND_API_KEY,
            from: process.env.EMAIL_FROM ?? "NexusNote <noreply@nexusnote.app>",
          }),
        ]
      : []),

    ...(isGithubLoginEnabled
      ? [
          GitHub({
            clientId: process.env.AUTH_GITHUB_ID,
            clientSecret: process.env.AUTH_GITHUB_SECRET!,
          }),
        ]
      : []),

    // Non-production: bypass email/domain setup.
    ...(isDevLoginEnabled
      ? [
          Credentials({
            name: "Development",
            credentials: {
              email: { label: "Email", type: "email" },
              name: { label: "Name", type: "text" },
            },
            async authorize(credentials) {
              if (!db) return null;
              if (!credentials?.email) return null;

              const email = credentials.email as string;
              const name = (credentials.name as string | undefined) || email.split("@")[0];

              const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
              let user = existing[0];

              if (!user) {
                const [newUser] = await db
                  .insert(users)
                  .values({
                    email,
                    name,
                    image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
                  })
                  .returning();
                user = newUser;
              }

              return {
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
              } satisfies User;
            },
          }),
        ]
      : []),
  ],

  callbacks: {
    async jwt({ token, user }) {
      return user ? applyUserToToken(token, user) : token;
    },
    async session({ session, token, user }) {
      const sessionUserId = user?.id ?? token.sub;
      if (sessionUserId) {
        session.user.id = sessionUserId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
