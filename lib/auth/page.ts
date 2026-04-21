import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth, requireAuth } from "@/lib/auth";
import { createLoginPath } from "@/lib/auth/redirect";

export type PageSession = Awaited<ReturnType<typeof auth>>;
export type AuthenticatedPageSession = NonNullable<PageSession>;

// In Next.js 16 with Cache Components enabled, any page that reads auth/cookies/headers
// must establish an explicit dynamic boundary first.
export async function getDynamicPageSession(): Promise<PageSession> {
  await connection();
  return auth();
}

export async function requireDynamicPageAuth(
  callbackUrl?: string,
): Promise<AuthenticatedPageSession> {
  await connection();
  return requireAuth(callbackUrl);
}

export async function redirectIfUnauthenticated(
  callbackUrl: string,
): Promise<AuthenticatedPageSession> {
  const session = await getDynamicPageSession();

  if (!session?.user?.id) {
    redirect(createLoginPath(callbackUrl));
  }

  return session;
}
