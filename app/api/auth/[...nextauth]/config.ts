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
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Resend from "next-auth/providers/resend";
import { db, eq, users } from "@/db";
import { accounts, sessions, verificationTokens } from "@/db/schema";

function readBooleanEnv(name: string): boolean | null {
  const value = process.env[name];
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

const runtimeEnvironment = process.env.APP_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV;
const isProductionEnvironment = runtimeEnvironment === "production";
const isDevLoginEnabled = readBooleanEnv("AUTH_DEV_LOGIN_ENABLED") ?? !isProductionEnvironment;
const isResendEnabled = readBooleanEnv("AUTH_RESEND_ENABLED") ?? !isDevLoginEnabled;

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
    strategy: "database" as const,
    maxAge: 30 * 24 * 60 * 60,
  },

  pages: {
    signIn: "/login",
    verifyRequest: "/login?verify=1",
  },

  providers: [
    ...(isResendEnabled
      ? [
          Resend({
            apiKey: process.env.RESEND_API_KEY,
            from: process.env.EMAIL_FROM ?? "NexusNote <noreply@nexusnote.app>",
          }),
        ]
      : []),

    ...(process.env.AUTH_GITHUB_ID
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
    async session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
} satisfies NextAuthConfig;
