import { connection, type NextRequest, type NextResponse } from "next/server";
import type { z } from "zod";
import { auth } from "@/lib/auth";
import { handleError, unauthorized } from "./errors";
import { parseJsonBodyWithinLimit, parseUnknownJsonBodyWithinLimit } from "./request-body";

export * from "./errors";

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

const DEFAULT_JSON_BODY_LIMIT_BYTES = 256 * 1024;

export async function parseJsonBody(
  request: NextRequest,
  maxBytes = DEFAULT_JSON_BODY_LIMIT_BYTES,
): Promise<unknown> {
  return parseUnknownJsonBodyWithinLimit(request, maxBytes);
}

export async function parseJsonBodyAs<T>(
  request: NextRequest,
  schema: z.ZodType<T>,
  maxBytes = DEFAULT_JSON_BODY_LIMIT_BYTES,
): Promise<T> {
  return parseJsonBodyWithinLimit(request, schema, maxBytes);
}

export function parseSearchParamsAs<T>(request: NextRequest, schema: z.ZodType<T>): T {
  const searchParams = new URL(request.url).searchParams;
  const values: Record<string, string> = {};

  searchParams.forEach((value, key) => {
    values[key] = value;
  });

  return schema.parse(values);
}

async function resolveRouteUserId(required: true): Promise<string>;
async function resolveRouteUserId(required: false): Promise<string | null>;
async function resolveRouteUserId(required: boolean): Promise<string | null> {
  await connection();
  const userId = (await auth())?.user?.id ?? null;

  if (required && !userId) {
    throw unauthorized();
  }

  return userId;
}

export function withAuth<T>(
  handler: RouteHandler<T>,
): (request: NextRequest) => Promise<Response | NextResponse<T>> {
  return createRouteHandler(async () => ({ userId: await resolveRouteUserId(true) }), handler);
}

export function withOptionalAuth<T>(
  handler: OptionalAuthHandler<T>,
): (request: NextRequest) => Promise<Response | NextResponse<T>> {
  return createRouteHandler(async () => ({ userId: await resolveRouteUserId(false) }), handler);
}

type DynamicRouteHandler<T = unknown, P = Record<string, string>> = (
  request: NextRequest,
  context: { userId: string; params: P },
) => Promise<Response | NextResponse<T>>;

type DynamicOptionalAuthHandler<T = unknown, P = Record<string, string>> = (
  request: NextRequest,
  context: { userId: string | null; params: P },
) => Promise<Response | NextResponse<T>>;

export function withDynamicAuth<T, P = Record<string, string>>(
  handler: DynamicRouteHandler<T, P>,
): (request: NextRequest, context: { params: Promise<P> }) => Promise<Response | NextResponse<T>> {
  return createDynamicRouteHandler(async (paramsPromise) => {
    const [userId, params] = await Promise.all([resolveRouteUserId(true), paramsPromise]);
    return { userId, params };
  }, handler);
}

export function withDynamicOptionalAuth<T, P = Record<string, string>>(
  handler: DynamicOptionalAuthHandler<T, P>,
): (request: NextRequest, context: { params: Promise<P> }) => Promise<Response | NextResponse<T>> {
  return createDynamicRouteHandler(async (paramsPromise) => {
    const [userId, params] = await Promise.all([resolveRouteUserId(false), paramsPromise]);
    return { userId, params };
  }, handler);
}
