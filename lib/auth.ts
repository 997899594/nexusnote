/**
 * Auth utilities for Server Components
 *
 * 提供服务端组件使用的认证工具
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * 获取当前用户会话（服务端组件专用）
 * 如果未登录，返回 null
 */
export async function auth() {
  return await getServerSession(authOptions);
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
