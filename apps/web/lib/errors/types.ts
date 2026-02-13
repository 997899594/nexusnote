/**
 * Error Types
 *
 * 自定义错误类型，用于精确处理不同类型的错误
 */

// ============================================
// Base Error Class
// ============================================

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly isOperational: boolean;
  readonly timestamp: string;

  constructor(message: string, code: string, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    Error.captureStackTrace?.(this, this.constructor);
  }
}

// ============================================
// Auth Errors (4xx)
// ============================================

export class AuthError extends AppError {
  constructor(message = "Authentication required") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, "FORBIDDEN", 403);
  }
}

// ============================================
// Validation Errors (4xx)
// ============================================

export class ValidationError extends AppError {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message, "VALIDATION_ERROR", 400);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, "NOT_FOUND", 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}

// ============================================
// Rate Limit Errors (4xx)
// ============================================

export class RateLimitError extends AppError {
  constructor(
    message = "Rate limit exceeded",
    public retryAfter?: number,
  ) {
    super(message, "RATE_LIMIT_EXCEEDED", 429);
  }
}

// ============================================
// Service Errors (5xx)
// ============================================

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service temporarily unavailable") {
    super(message, "SERVICE_UNAVAILABLE", 503);
  }
}

export class ExternalServiceError extends AppError {
  constructor(
    message: string,
    public service: string,
    public originalError?: unknown,
  ) {
    super(message, "EXTERNAL_SERVICE_ERROR", 502, false);
  }
}

// ============================================
// AI Errors
// ============================================

export class AIError extends AppError {
  constructor(
    message: string,
    public provider: string,
    public originalError?: unknown,
  ) {
    super(message, "AI_ERROR", 500, false);
  }
}

export class AIRateLimitError extends RateLimitError {
  constructor(provider: string, retryAfter?: number) {
    super(`AI provider rate limit exceeded: ${provider}`, retryAfter);
    // Cannot reassign readonly property, use Object.defineProperty to override
    Object.defineProperty(this, "code", {
      value: "AI_RATE_LIMIT",
      enumerable: true,
      configurable: true,
    });
  }
}

export class AIConfigurationError extends AppError {
  constructor(message = "AI service not configured") {
    super(message, "AI_NOT_CONFIGURED", 500);
  }
}

// ============================================
// Database Errors
// ============================================

export class DatabaseError extends AppError {
  constructor(
    message: string,
    public query?: string,
    public originalError?: unknown,
  ) {
    super(message, "DATABASE_ERROR", 500, false);
  }
}

export class RecordNotFoundError extends NotFoundError {
  constructor(record: string, identifier?: string) {
    super(identifier ? `${record} with id "${identifier}" not found` : `${record} not found`);
    // Cannot reassign readonly property, use Object.defineProperty to override
    Object.defineProperty(this, "code", {
      value: "RECORD_NOT_FOUND",
      enumerable: true,
      configurable: true,
    });
  }
}

// ============================================
// Type Guards
// ============================================

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

// ============================================
// Error Utilities
// ============================================

/**
 * 获取用户友好的错误消息
 */
export function getUserMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    // 生产环境隐藏内部错误详情
    if (process.env.NODE_ENV === "production") {
      return "An unexpected error occurred. Please try again.";
    }
    return error.message;
  }

  return "An unexpected error occurred.";
}

/**
 * 获取错误代码
 */
export function getErrorCode(error: unknown): string {
  if (isAppError(error)) {
    return error.code;
  }
  return "UNKNOWN_ERROR";
}

/**
 * 获取 HTTP 状态码
 */
export function getStatusCode(error: unknown): number {
  if (isAppError(error)) {
    return error.statusCode;
  }
  return 500;
}
