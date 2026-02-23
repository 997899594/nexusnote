/**
 * Auth utilities for Server Components
 *
 * Auth.js v5 (formerly NextAuth v5)
 * 直接使用从 route.ts 导出的 auth 函数
 */

import { redirect } from "next/navigation";
import { auth as nextAuth } from "@/app/api/auth/[...nextauth]/route";

/**
 * 获取当前用户会话（服务端组件专用）
 * 如果未登录，返回 null
 */
export async function auth() {
  return await nextAuth();
}

/**
 * 获取当前用户，未登录时重定向到登录页
 */
export async function requireAuth() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
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
