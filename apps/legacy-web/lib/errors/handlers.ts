/**
 * Error Handlers
 *
 * 统一的错误处理函数
 */

import { isAppError, isAuthError, isValidationError } from "./types";

// ============================================
// Server Action Response Types
// ============================================

export interface ActionSuccess<T = unknown> {
  success: true;
  data: T;
}

export interface ActionError {
  success: false;
  error: string;
  code: string;
}

export type ActionResult<T = unknown> = ActionSuccess<T> | ActionError;

// ============================================
// Response Builders
// ============================================

/**
 * 创建成功响应
 */
export function success<T = void>(data?: T): ActionSuccess<T> {
  return {
    success: true,
    data: data as T,
  };
}

/**
 * 创建错误响应
 */
export function error(message: string, code = "INTERNAL_ERROR"): ActionError {
  return {
    success: false,
    error: message,
    code,
  };
}

/**
 * 创建验证错误响应
 */
export function validationError(message: string, _field?: string): ActionError {
  return {
    success: false,
    error: message,
    code: "VALIDATION_ERROR",
  };
}

/**
 * 创建未授权响应
 */
export function unauthorizedError(message = "Authentication required"): ActionError {
  return {
    success: false,
    error: message,
    code: "UNAUTHORIZED",
  };
}

// ============================================
// Error Handlers
// ============================================

/**
 * 将任意错误转换为 ActionResult
 */
export function handleActionError(err: unknown): ActionError {
  // 自定义 AppError
  if (isAppError(err)) {
    return error(err.message, err.code);
  }

  // 标准 Error
  if (err instanceof Error) {
    // 生产环境隐藏内部错误详情
    const message =
      process.env.NODE_ENV === "production" ? "An unexpected error occurred" : err.message;

    return error(message, "INTERNAL_ERROR");
  }

  // 未知错误类型
  return error("An unexpected error occurred", "UNKNOWN_ERROR");
}

/**
 * 异步操作包装器 - 自动处理错误
 */
export async function tryAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return success(data);
  } catch (err) {
    return handleActionError(err);
  }
}

// ============================================
// Logging
// ============================================

/**
 * 结构化日志记录
 */
export function logError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>,
): void {
  const timestamp = new Date().toISOString();

  if (isAppError(error)) {
    // AppError 已有足够结构化信息
    console.error(`[${timestamp}] [${context}]`, {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      ...metadata,
    });
  } else if (error instanceof Error) {
    console.error(`[${timestamp}] [${context}]`, {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...metadata,
    });
  } else {
    console.error(`[${timestamp}] [${context}]`, {
      error,
      ...metadata,
    });
  }
}

// ============================================
// Toast/Notification Helpers
// ============================================

/**
 * 根据错误类型获取 Toast 配置
 */
export function getToastConfig(error: unknown) {
  if (isAuthError(error)) {
    return {
      type: "error" as const,
      message: "请先登录",
    };
  }

  if (isValidationError(error)) {
    return {
      type: "warning" as const,
      message: error.message,
    };
  }

  if (isAppError(error)) {
    return {
      type: "error" as const,
      message: error.message,
    };
  }

  return {
    type: "error" as const,
    message: "操作失败，请重试",
  };
}
