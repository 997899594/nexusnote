/**
 * 统一 API 错误处理
 * 参考 app/api/chat/route.ts
 */

import { type NextRequest, NextResponse } from "next/server";

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

export function errorResponse(
  message: string,
  statusCode: number,
  code: string,
) {
  return NextResponse.json(
    { error: { message, code } },
    { status: statusCode },
  );
}

export function handleError(error: unknown): NextResponse {
  console.error("[API Error]", error);

  if (error instanceof APIError) {
    return errorResponse(error.message, error.statusCode, error.code);
  }

  if (error instanceof Error) {
    if (error.name === "ZodError") {
      return errorResponse("请求参数错误", 400, "VALIDATION_ERROR");
    }
    return errorResponse(error.message, 500, "INTERNAL_ERROR");
  }

  return errorResponse("未知错误", 500, "UNKNOWN_ERROR");
}
