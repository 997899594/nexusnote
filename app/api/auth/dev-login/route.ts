import { eq } from "drizzle-orm";
import { connection, type NextRequest, NextResponse } from "next/server";
import { db, sessions, users } from "@/db";

const DEV_LOGIN_EMAIL = "dev@nexusnote.local";
const DEV_LOGIN_NAME = "开发账户";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const SESSION_COOKIE_NAME = "authjs.session-token";

function getSafeCallbackPath(value: string | null): string {
  if (!value) {
    return "/";
  }

  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function getSafeEmail(value: string | null): string {
  const normalized = value?.trim().toLowerCase();

  if (!normalized || !normalized.includes("@")) {
    return DEV_LOGIN_EMAIL;
  }

  return normalized;
}

async function getOrCreateDevUser(email: string) {
  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existingUser) {
    await db
      .update(users)
      .set({
        emailVerified: existingUser.emailVerified ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser.id));

    return existingUser;
  }

  const [createdUser] = await db
    .insert(users)
    .values({
      email,
      name: DEV_LOGIN_NAME,
      emailVerified: new Date(),
    })
    .returning();

  if (!createdUser) {
    throw new Error("Failed to create development user.");
  }

  return createdUser;
}

export async function GET(request: NextRequest) {
  await connection();

  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const callbackUrl = getSafeCallbackPath(request.nextUrl.searchParams.get("callbackUrl"));
  const email = getSafeEmail(request.nextUrl.searchParams.get("email"));
  const user = await getOrCreateDevUser(email);
  const sessionToken = crypto.randomUUID();
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.insert(sessions).values({
    sessionToken,
    userId: user.id,
    expires,
  });

  const response = NextResponse.redirect(new URL(callbackUrl, request.url));
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    expires,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: false,
  });

  return response;
}
