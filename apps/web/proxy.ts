/**
 * Next.js 16 Proxy — 路由级认证守卫
 *
 * 替代 middleware.ts，作为第一道防线拦截未认证请求。
 * 受保护路由在此统一管理，新增页面不再需要手动加 auth() 检查。
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthenticated = !!req.auth?.user;

  // 未认证用户访问受保护路由 → 重定向到登录页
  if (!isAuthenticated) {
    // API 路由返回 401 JSON，不做重定向
    if (pathname.startsWith("/api/")) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 页面路由重定向到登录页，带上回调地址
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/editor/:path*", "/create/:path*", "/learn/:path*", "/api/chat/:path*"],
};
