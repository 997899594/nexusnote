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

type RouteResult<T> = Promise<Response | NextResponse<T>>;
type RouteContextResolver<C> = () => Promise<C>;
type DynamicRouteContextResolver<C, P> = (params: Promise<P>) => Promise<C>;

function createRouteHandler<T, C>(
  resolveContext: RouteContextResolver<C>,
  handler: (request: NextRequest, context: C) => RouteResult<T>,
): (request: NextRequest) => RouteResult<T> {
  return async (request: NextRequest): Promise<Response | NextResponse<T>> => {
    return withHandledRoute(async () => handler(request, await resolveContext()));
  };
}

function createDynamicRouteHandler<T, C, P = Record<string, string>>(
  resolveContext: DynamicRouteContextResolver<C, P>,
  handler: (request: NextRequest, context: C) => RouteResult<T>,
): (request: NextRequest, context: { params: Promise<P> }) => RouteResult<T> {
  return async (
    request: NextRequest,
    context: { params: Promise<P> },
  ): Promise<Response | NextResponse<T>> => {
    return withHandledRoute(async () => handler(request, await resolveContext(context.params)));
  };
}

async function withHandledRoute<T>(handler: () => RouteResult<T>): RouteResult<T> {
  try {
    return await handler();
  } catch (error) {
    return handleError(error);
  }
}

async function resolveRouteUserId(required: true): Promise<string>;
async function resolveRouteUserId(required: false): Promise<string | null>;
async function resolveRouteUserId(required: boolean): Promise<string | null> {
  await connection();
  const userId = (await auth())?.user?.id ?? null;

  if (required && !userId) {
    throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
  }

  return userId;
}

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
  return createRouteHandler(async () => ({ userId: await resolveRouteUserId(true) }), handler);
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
  return createRouteHandler(async () => ({ userId: await resolveRouteUserId(false) }), handler);
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
  return createDynamicRouteHandler(async (paramsPromise) => {
    const [userId, params] = await Promise.all([resolveRouteUserId(true), paramsPromise]);
    return { userId, params };
  }, handler);
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
  return createDynamicRouteHandler(async (paramsPromise) => {
    const [userId, params] = await Promise.all([resolveRouteUserId(false), paramsPromise]);
    return { userId, params };
  }, handler);
}
