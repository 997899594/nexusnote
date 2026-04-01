/**
 * 统一 API 错误处理
 * 参考 app/api/chat/route.ts
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

export function errorResponse(message: string, statusCode: number, code: string) {
  return NextResponse.json({ error: { message, code } }, { status: statusCode });
}

function isBuildPhasePrerenderRequestApiError(error: unknown): boolean {
  const digest = typeof error === "object" && error !== null ? Reflect.get(error, "digest") : null;
  const message = error instanceof Error ? error.message : String(error ?? "");

  return (
    process.env.NEXT_PHASE === "phase-production-build" &&
    digest === "HANGING_PROMISE_REJECTION" &&
    message.includes("During prerendering") &&
    (message.includes("`headers()`") || message.includes("`connection()`"))
  );
}

export function handleError(error: unknown): NextResponse {
  if (isBuildPhasePrerenderRequestApiError(error)) {
    return new NextResponse(null, { status: 204 });
  }

  if (error instanceof APIError) {
    if (error.statusCode >= 500) {
      console.error("[API Error]", error);
    }
    return errorResponse(error.message, error.statusCode, error.code);
  }

  if (error instanceof ZodError) {
    return errorResponse("请求参数错误", 400, "VALIDATION_ERROR");
  }

  if (error instanceof Error) {
    return errorResponse(error.message, 500, "INTERNAL_ERROR");
  }

  return errorResponse("未知错误", 500, "UNKNOWN_ERROR");
}
