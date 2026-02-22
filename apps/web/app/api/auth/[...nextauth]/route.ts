/**
 * NextAuth v4 Configuration
 */

import { db, eq, users } from "@/db";
import NextAuth, { type Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const authOptions = {
  providers: [
    Credentials({
      name: "Development",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials: any) {
        if (!credentials?.email) return null;

        const email = credentials.email as string;
        const name = (credentials.name as string) || email.split("@")[0];

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
        };
      },
    }),
  ],
  session: { strategy: "jwt" as const },
  callbacks: {
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: any }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.sub,
          name: token.name,
          email: token.email,
          image: token.picture,
        },
      };
    },
  },
  pages: { signIn: "/login" },
};

const handler = NextAuth(authOptions as any);

export { handler as GET, handler as POST };
