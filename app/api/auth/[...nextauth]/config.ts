/**
 * Auth.js v5 Configuration
 *
 * 环境变量变化：
 * - `NEXTAUTH_SECRET` → `AUTH_SECRET`
 * - `NEXTAUTH_URL` → `AUTH_URL`
 */

import type { NextAuthConfig } from "next-auth";
import type { User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db, eq, users } from "@/db";

export const authConfig = {
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60,
  },

  pages: {
    signIn: "/login",
  },

  providers: [
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
              avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
            })
            .returning();
          user = newUser;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatarUrl,
        } satisfies User;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.name = token.name;
        session.user.email = token.email!;
        session.user.image = token.picture;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
