"use client";

import { createLoginPath, getCurrentCallbackUrl } from "@/lib/auth/redirect";

export interface ApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  message?: string;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

function parseErrorMessagePayload(message: string): ApiErrorResponse | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as ApiErrorResponse;
  } catch {
    return null;
  }
}

function normalizeApiErrorMessage(message: string, code?: string): string {
  const lowerMessage = message.toLowerCase();

  if (
    code === "INTERNAL_ERROR" &&
    (lowerMessage.includes("timed out") || lowerMessage.includes("timeout"))
  ) {
    return "AI 响应超时了，请稍后重试，或先把目标说得更短一点。";
  }

  if (message.trim().startsWith("{")) {
    return "操作失败，请稍后重试";
  }

  return message;
}

export async function parseApiError(error: unknown): Promise<{
  message: string;
  status?: number;
  code?: string;
}> {
  const defaultMessage = "操作失败，请稍后重试";

  let errorMessage = defaultMessage;
  let status: number | undefined;
  let code: string | undefined;

  if (error instanceof Response || (error && typeof error === "object" && "status" in error)) {
    const response = error as Response;
    status = response.status;

    try {
      const data: ApiErrorResponse = await response.json();
      errorMessage = data.error?.message || data.message || defaultMessage;
      code = data.error?.code;
    } catch {
      errorMessage = defaultMessage;
    }
  } else if (error instanceof Error) {
    const payload = parseErrorMessagePayload(error.message);
    if (payload) {
      errorMessage = payload.error?.message || payload.message || defaultMessage;
      code = payload.error?.code;
    } else {
      errorMessage = error.message;
    }
  }

  errorMessage = normalizeApiErrorMessage(errorMessage, code);

  return { message: errorMessage, status, code };
}

export function isUnauthorizedError(status?: number, code?: string): boolean {
  return status === 401 || code === "UNAUTHORIZED";
}

export function redirectToLogin(callbackUrl = getCurrentCallbackUrl()): void {
  if (typeof window === "undefined") {
    return;
  }

  window.location.assign(createLoginPath(callbackUrl));
}
