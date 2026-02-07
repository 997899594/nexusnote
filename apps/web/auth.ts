import NextAuth from "next-auth";
import { env, clientEnv } from "@nexusnote/config";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { SignJWT, jwtVerify } from "jose";
import { db, users, eq } from "@nexusnote/db";

// Read JWT settings from env or use defaults to match NestJS
const JWT_SECRET = env.JWT_SECRET;
const JWT_ISSUER = env.JWT_ISSUER;
const JWT_EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days (seconds)
const ENCODED_SECRET = new TextEncoder().encode(JWT_SECRET);

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: env.AUTH_SECRET,
  providers: [
    GitHub({
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
    }),
    // Development Credentials Provider
    Credentials({
      name: "Development Login",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "demo@example.com",
        },
        name: { label: "Name", type: "text", placeholder: "Demo User" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        // In production, you would verify password here.
        // For this demo/dev setup, we'll auto-register/login any email.
        const email = credentials.email as string;
        const name = (credentials.name as string) || email.split("@")[0];

        // Check if user exists
        const existingUsers = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        let user = existingUsers[0];

        // If not, create one
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
  session: {
    strategy: "jwt",
  },
  jwt: {
    // Override encode/decode to use raw HS256 JWT compatible with NestJS backend
    async encode({ token, secret, maxAge }) {
      if (!token) return "";

      const now = Math.floor(Date.now() / 1000);
      const expiry = maxAge ?? JWT_EXPIRES_IN;
      return new SignJWT(token as any)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(now)
        .setIssuer(JWT_ISSUER)
        .setExpirationTime(now + expiry)
        .sign(ENCODED_SECRET);
    },
    async decode({ token, secret }) {
      if (!token) return null;
      try {
        const { payload } = await jwtVerify(token, ENCODED_SECRET);
        return payload;
      } catch (e) {
        return null;
      }
    },
  },
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
      if (token && session.user) {
        session.user.id = token.sub as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.image = token.picture as string;

        // Sign a raw JWT for the backend/WebSocket to verify
        const now = Math.floor(Date.now() / 1000);
        const accessToken = await new SignJWT(token as any)
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt(now)
          .setIssuer(JWT_ISSUER)
          .setExpirationTime(now + JWT_EXPIRES_IN)
          .sign(ENCODED_SECRET);

        // Expose to client (requires types extension if using Strict TS)
        (session as any).accessToken = accessToken;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
