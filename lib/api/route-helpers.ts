/**
 * API 路由辅助函数
 * 提供认证和错误处理的高阶函数封装
 */

import { connection, type NextRequest, type NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { APIError, handleError } from "./errors";

type RouteHandler<T = unknown> = (
  request: NextRequest,
  context: { userId: string },
) => Promise<Response | NextResponse<T>>;

type OptionalAuthHandler<T = unknown> = (
  request: NextRequest,
  context: { userId: string | null },
) => Promise<Response | NextResponse<T>>;

/**
 * 认证路由高阶函数
 * 自动处理认证检查和错误处理
 *
 * @example
 * export const GET = withAuth(async (request, { userId }) => {
 *   const data = await getData(userId);
 *   return Response.json(data);
 * });
 */
export function withAuth<T>(
  handler: RouteHandler<T>,
): (request: NextRequest) => Promise<Response | NextResponse<T>> {
  return async (request: NextRequest): Promise<Response | NextResponse<T>> => {
    try {
      await connection();
      const session = await auth();
      if (!session?.user) {
        throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
      }
      return handler(request, { userId: session.user.id });
    } catch (error) {
      return handleError(error);
    }
  };
}

/**
 * 可选认证路由高阶函数
 * 允许匿名访问，但提供用户信息（如有）
 *
 * @example
 * export const GET = withOptionalAuth(async (request, { userId }) => {
 *   const data = userId ? await getPrivateData(userId) : await getPublicData();
 *   return Response.json(data);
 * });
 */
export function withOptionalAuth<T>(
  handler: OptionalAuthHandler<T>,
): (request: NextRequest) => Promise<Response | NextResponse<T>> {
  return async (request: NextRequest): Promise<Response | NextResponse<T>> => {
    try {
      await connection();
      const session = await auth();
      return handler(request, {
        userId: session?.user?.id ?? null,
      });
    } catch (error) {
      return handleError(error);
    }
  };
}

// Dynamic route types (for routes with params)
type DynamicRouteHandler<T = unknown, P = Record<string, string>> = (
  request: NextRequest,
  context: { userId: string; params: P },
) => Promise<Response | NextResponse<T>>;

type DynamicOptionalAuthHandler<T = unknown, P = Record<string, string>> = (
  request: NextRequest,
  context: { userId: string | null; params: P },
) => Promise<Response | NextResponse<T>>;

/**
 * 动态路由认证高阶函数
 * 用于带 params 参数的动态路由
 *
 * @example
 * export const GET = withDynamicAuth(async (request, { userId, params }) => {
 *   const data = await getData(userId, params.id);
 *   return Response.json(data);
 * });
 */
export function withDynamicAuth<T, P = Record<string, string>>(
  handler: DynamicRouteHandler<T, P>,
): (request: NextRequest, context: { params: Promise<P> }) => Promise<Response | NextResponse<T>> {
  return async (
    request: NextRequest,
    context: { params: Promise<P> },
  ): Promise<Response | NextResponse<T>> => {
    try {
      await connection();
      const session = await auth();
      if (!session?.user) {
        throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
      }
      const params = await context.params;
      return handler(request, { userId: session.user.id, params });
    } catch (error) {
      return handleError(error);
    }
  };
}

/**
 * 动态路由可选认证高阶函数
 * 允许匿名访问，但提供用户信息和 params
 *
 * @example
 * export const GET = withDynamicOptionalAuth(async (request, { userId, params }) => {
 *   const data = userId ? await getPrivateData(userId, params.id) : await getPublicData(params.id);
 *   return Response.json(data);
 * });
 */
export function withDynamicOptionalAuth<T, P = Record<string, string>>(
  handler: DynamicOptionalAuthHandler<T, P>,
): (request: NextRequest, context: { params: Promise<P> }) => Promise<Response | NextResponse<T>> {
  return async (
    request: NextRequest,
    context: { params: Promise<P> },
  ): Promise<Response | NextResponse<T>> => {
    try {
      await connection();
      const session = await auth();
      const params = await context.params;
      return handler(request, {
        userId: session?.user?.id ?? null,
        params,
      });
    } catch (error) {
      return handleError(error);
    }
  };
}
