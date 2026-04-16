/**
 * Auth utilities for Server Components
 *
 * Auth.js v5 (formerly NextAuth v5)
 * 直接使用从 route.ts 导出的 auth 函数
 */

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth as nextAuth } from "@/app/api/auth/[...nextauth]/auth";
import { createLoginPath } from "@/lib/auth-redirect";

/**
 * 获取当前用户会话（服务端组件专用）
 * 如果未登录，返回 null
 *
 * Auth execution must not branch on build-time env flags.
 * Under Next.js cache components, hiding request-time auth during image build
 * can misclassify a route as static and trigger runtime DYNAMIC_SERVER_USAGE
 * failures later. `SKIP_ENV_VALIDATION` is only for config validation, not auth.
 */
export async function auth() {
  try {
    return await nextAuth();
  } catch (error) {
    if (error instanceof AuthError && error.type === "Verification") {
      console.warn("[Auth] Ignoring invalid verification token or expired auth state");
      return null;
    }

    throw error;
  }
}

/**
 * 获取当前用户，未登录时重定向到登录页
 */
export async function requireAuth(callbackUrl?: string) {
  const session = await auth();

  if (!session?.user) {
    redirect(createLoginPath(callbackUrl));
  }

  return session;
}

/**
 * 获取用户 ID，未登录时返回 null
 */
export async function getUserId() {
  const session = await auth();
  return session?.user?.id || null;
}
