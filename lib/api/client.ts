"use client";

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
    errorMessage = error.message;
  }

  return { message: errorMessage, status, code };
}

export function isApiError(error: unknown, statusCode?: number): boolean {
  if (!error) return false;
  if (error instanceof Error) {
    const apiError = error as ApiError;
    if (statusCode) return apiError.status === statusCode;
    return apiError.status !== undefined;
  }
  return false;
}
